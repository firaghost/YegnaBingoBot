import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../../lib/supabaseClient';

export default function LiveGameControl() {
  const router = useRouter();
  const { id } = router.query;
  
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [autoCalling, setAutoCalling] = useState(false);
  const [autoInterval, setAutoInterval] = useState(null);

  useEffect(() => {
    if (!id) return;
    
    loadGameData();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`game-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${id}`
      }, (payload) => {
        console.log('Game updated:', payload);
        loadGameData();
        
        // Check if game completed
        if (payload.new?.status === 'completed' && payload.old?.status === 'active') {
          // Stop auto-calling
          if (autoInterval) {
            clearInterval(autoInterval);
            setAutoInterval(null);
            setAutoCalling(false);
          }
          
          // Show winner notification
          const winnerId = payload.new.winner_id;
          if (winnerId) {
            // Find winner's username
            const winner = players.find(p => p.user_id === winnerId);
            const winnerName = winner?.users?.username || 'Unknown';
            const prize = (payload.new.prize_pool * 0.9).toFixed(0);
            
            alert(`🎉 GAME ENDED!\n\n🏆 Winner: ${winnerName}\n💰 Prize: ${prize} Birr\n\nThe game has been completed.`);
          }
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (autoInterval) clearInterval(autoInterval);
    };
  }, [id, autoInterval, players]);

  async function loadGameData() {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single();

      if (gameError) throw gameError;
      
      // If game is completed, redirect to details page after 3 seconds
      if (gameData.status === 'completed' && game?.status !== 'completed') {
        setTimeout(() => {
          router.push(`/games/details/${id}`);
        }, 3000);
      }
      
      setGame(gameData);

      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select(`
          *,
          users (username, telegram_id)
        `)
        .eq('game_id', id);

      if (playersError) throw playersError;
      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error loading game:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deductAllPlayersFees() {
    // Deduct entry fee from all players and add to prize pool
    try {
      for (const player of players) {
        if (player.paid) continue; // Skip if already paid
        
        // Deduct balance
        await supabase.rpc('deduct_balance', {
          user_id: player.user_id,
          amount: game.entry_fee
        });
        
        // Mark as paid
        await supabase
          .from('game_players')
          .update({ paid: true })
          .eq('id', player.id);
      }
      
      // Update prize pool
      const totalPrize = game.entry_fee * players.length;
      await supabase
        .from('games')
        .update({ prize_pool: totalPrize })
        .eq('id', id);
        
      console.log(`Deducted ${game.entry_fee} Birr from ${players.length} players. Prize pool: ${totalPrize} Birr`);
    } catch (error) {
    }
  }

  const callNumber = useCallback(async () => {
    setCalling(prev => {
      if (prev) {
        console.log('⏭️ Already calling, skipping...');
        return prev;
      }
      return true;
    });
    
    try {
      // Fetch fresh game data
      const { data: freshGame } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single();
      
      // Check if game is still active
      if (freshGame?.status !== 'active') {
        console.log('Game not active, stopping auto-call');
        setAutoCalling(false);
        setCalling(false);
        return;
      }
      
      const calledNumbers = freshGame.called_numbers || [];
      
      // All numbers 1-75
      const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
      const availableNumbers = allNumbers.filter(n => !calledNumbers.includes(n));

      if (availableNumbers.length === 0) {
        alert('All numbers have been called!');
        setAutoCalling(false);
        setCalling(false);
        return;
      }

      // Random number from available
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const newNumber = availableNumbers[randomIndex];

      const updatedNumbers = [...calledNumbers, newNumber];

      console.log('🎲 Calling number:', newNumber);

      const { error } = await supabase
        .from('games')
        .update({ called_numbers: updatedNumbers })
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('✅ Number called successfully');

      // Check for winners after calling number (exclude players who left)
      const { data: playersData } = await supabase
        .from('game_players')
        .select('*, users (username, telegram_id)')
        .eq('game_id', id)
        .eq('has_left', false);
      
      for (const player of playersData || []) {
        const hasBingo = checkPlayerBingo(player, updatedNumbers);
        if (hasBingo) {
          await declareWinner(player);
          break;
        }
      }
    } catch (error) {
      console.error('Error calling number:', error);
      alert(`Failed to call number: ${error.message}`);
    } finally {
      setCalling(false);
    }
  }, [id]);

  // Restore auto-calling state on mount
  useEffect(() => {
    if (!id) return;
    const savedAutoCall = localStorage.getItem(`autoCall-${id}`);
    if (savedAutoCall === 'true') {
      console.log('🔄 Restoring auto-call state');
      setAutoCalling(true);
    }
  }, [id]);

  // Auto-calling interval effect
  useEffect(() => {
    if (!autoCalling || !id) {
      localStorage.removeItem(`autoCall-${id}`);
      return;
    }
    
    console.log('▶️ Starting auto-call (every 5 seconds)');
    localStorage.setItem(`autoCall-${id}`, 'true');
    
    const interval = setInterval(() => {
      console.log('⏰ Auto-call interval triggered');
      callNumber();
    }, 5000);
    
    return () => {
      console.log('⏹️ Clearing auto-call interval');
      clearInterval(interval);
    };
  }, [autoCalling, id, callNumber]);

  async function checkForWinners() {
    // Check each player for BINGO (exclude players who left)
    for (const player of players) {
      if (player.has_left) {
        console.log(`⏭️ Skipping player ${player.users?.username} - has left game`);
        continue;
      }
      
      const hasBingo = checkPlayerBingo(player);
      if (hasBingo) {
        await declareWinner(player);
        break;
      }
    }
  }

  function checkPlayerBingo(player, calledNumbers = null) {
    const card = player.card;
    const marked = player.marked_numbers || [];
    const called = calledNumbers || game?.called_numbers || [];

    // Only check numbers that have been called
    const validMarked = marked.filter(n => called.includes(n));

    // Check rows
    for (let row = 0; row < 5; row++) {
      let rowComplete = true;
      for (let col = 0; col < 5; col++) {
        const num = card[col][row];
        if (num !== '#' && !validMarked.includes(num)) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) return true;
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      let colComplete = true;
      for (let row = 0; row < 5; row++) {
        const num = card[col][row];
        if (num !== '#' && !validMarked.includes(num)) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) return true;
    }

    // Check diagonals
    let diag1 = true, diag2 = true;
    for (let i = 0; i < 5; i++) {
      const num1 = card[i][i];
      const num2 = card[i][4 - i];
      if (num1 !== '#' && !validMarked.includes(num1)) diag1 = false;
      if (num2 !== '#' && !validMarked.includes(num2)) diag2 = false;
    }

    return diag1 || diag2;
  }

  async function declareWinner(player) {
    try {
      // Stop auto-calling
      if (autoInterval) {
        clearInterval(autoInterval);
        setAutoInterval(null);
        setAutoCalling(false);
      }

      // Update game status
      const { error: gameError } = await supabase
        .from('games')
        .update({
          status: 'completed',
          winner_id: player.user_id,
          ended_at: new Date().toISOString()
        })
        .eq('id', id);

      if (gameError) throw gameError;

      // Award prize
      const { error: prizeError } = await supabase.rpc('award_prize', {
        winner_user_id: player.user_id,
        game_id: id
      });

      if (prizeError) throw prizeError;

      const winnerPrize = (game.prize_pool * 0.9).toFixed(0);
      alert(`🎉 BINGO! Winner: ${player.users?.username || 'Player'}\nPrize: ${winnerPrize} Birr (after 10% commission)`);
      router.push('/games');
    } catch (error) {
      console.error('Error declaring winner:', error);
      alert('Failed to declare winner');
    }
  }

  function toggleAutoCalling() {
    // Just toggle the state - the effect will handle starting/stopping
    setAutoCalling(!autoCalling);
  }

  async function endGame() {
    if (!confirm('Are you sure you want to end this game without a winner?')) return;

    try {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      alert('Game ended');
      router.push('/games');
    } catch (error) {
      console.error('Error ending game:', error);
      alert('Failed to end game');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">Game not found</div>
          <button
            onClick={() => router.push('/games')}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const calledNumbers = game.called_numbers || [];
  const lastNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;
  const remainingNumbers = 75 - calledNumbers.length;

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  return (
    <>
      <Head>
        <title>🔴 LIVE - {game.entry_fee} ETB Game</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="fixed inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <header className="relative bg-black/40 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button onClick={() => router.push('/games/active')} className="text-white hover:text-purple-300 transition-colors">← Back</button>
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500 rounded-xl blur-lg animate-pulse"></div>
                  <div className="relative w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <span className="text-2xl animate-pulse">🔴</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">{game.entry_fee} ETB GAME - LIVE CONTROL</h1>
                  <p className="text-sm text-gray-300">
                    👥 {players.filter(p => !p.has_left).length} Active • 💰 Pool: {game.prize_pool} ETB • 🏆 Winner: {(game.prize_pool * 0.9).toFixed(0)} ETB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-sm animate-pulse shadow-lg shadow-red-500/50">
                  🔴 LIVE NOW
                </span>
                <button onClick={handleLogout} className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all font-bold">🚪</button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Last Called Number - Massive Display */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/30 to-orange-600/30 rounded-2xl blur-2xl animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 rounded-2xl p-12 text-center shadow-2xl border-4 border-yellow-300">
                  <div className="text-white text-lg font-bold mb-2 opacity-90">LAST CALLED NUMBER</div>
                  <div className="text-white text-9xl font-black mb-4 drop-shadow-2xl" style={{textShadow: '0 0 30px rgba(0,0,0,0.5)'}}>
                    {lastNumber || '-'}
                  </div>
                  <div className="text-white text-xl font-bold">
                    {calledNumbers.length} / 75 • {remainingNumbers} REMAINING
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                  <h3 className="font-black text-white mb-4 text-xl">🎮 GAME CONTROLS</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={callNumber}
                      disabled={calling || autoCalling || remainingNumbers === 0}
                      className="px-6 py-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-black text-xl shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      {calling ? '⏳ CALLING...' : '🎲 CALL NUMBER'}
                    </button>
                    <button
                      onClick={toggleAutoCalling}
                      disabled={remainingNumbers === 0}
                      className={`px-6 py-6 rounded-xl transition-all font-black text-xl shadow-lg transform hover:scale-105 ${
                        autoCalling
                          ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white animate-pulse'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {autoCalling ? '⏹️ STOP AUTO' : '▶️ AUTO CALL'}
                    </button>
                  </div>
                  <button
                    onClick={endGame}
                    className="w-full px-6 py-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-xl hover:from-gray-800 hover:to-black transition-all font-bold shadow-lg"
                  >
                    🛑 END GAME
                  </button>
                </div>
              </div>

              {/* Number Board */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                  <h3 className="font-black text-white mb-4 text-xl">🎯 NUMBER BOARD (1-75)</h3>
                  <div className="grid grid-cols-10 gap-2">
                    {Array.from({ length: 75 }, (_, i) => i + 1).map((num) => {
                      const isCalled = calledNumbers.includes(num);
                      const isLast = num === lastNumber;
                      return (
                        <div
                          key={num}
                          className={`
                            w-12 h-12 flex items-center justify-center rounded-xl font-black text-lg
                            transition-all duration-300 transform
                            ${isCalled 
                              ? isLast
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-4 ring-yellow-300 scale-125 shadow-2xl shadow-yellow-500/50 animate-pulse'
                                : 'bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg'
                              : 'bg-white/10 text-gray-500 border border-white/20'
                            }
                          `}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Players */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-2xl blur-xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <h3 className="font-black text-white mb-4 text-xl">
                  👥 PLAYERS ({players.filter(p => !p.has_left).length}/{players.length})
                </h3>
                <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar">
                  {players.map((player, index) => {
                    const hasBingo = checkPlayerBingo(player);
                    const selectedNums = player.selected_numbers || [];
                    const hasLeft = player.has_left;
                    return (
                      <div
                        key={player.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          hasLeft
                            ? 'border-red-400/50 bg-red-500/20 opacity-60'
                            : hasBingo
                            ? 'border-green-400 bg-green-500/30 shadow-lg shadow-green-500/50 animate-pulse'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-white">
                            {player.users?.username || `Player ${index + 1}`}
                          </div>
                          {hasLeft && (
                            <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-black">
                              LEFT
                            </span>
                          )}
                          {hasBingo && !hasLeft && (
                            <span className="bg-green-500 text-black text-xs px-3 py-1 rounded-full font-black animate-pulse">
                              🏆 BINGO!
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-300 mb-2">
                          {hasLeft ? '❌ Left game - stake forfeited' : `✅ Marked: ${player.marked_numbers?.length || 0} numbers`}
                        </div>
                        {selectedNums.length > 0 && !hasLeft && (
                          <div className="text-xs">
                            <div className="font-medium text-gray-400 mb-1">Selected:</div>
                            <div className="flex flex-wrap gap-1">
                              {selectedNums.map((num, i) => (
                                <span key={i} className="bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded border border-blue-400/30 font-bold">
                                  {num}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
