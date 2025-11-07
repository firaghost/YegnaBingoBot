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
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Animated Background Pattern */}
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '48px 48px'
          }}></div>
        </div>

        {/* Gradient Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        {/* Header */}
        <header className="relative bg-black/30 backdrop-blur-2xl border-b border-white/10 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => router.push('/games/active')} 
                  className="flex items-center gap-2 px-3 py-2 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-200 border border-white/10"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-medium">Back</span>
                </button>
                
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500 rounded-2xl blur-xl opacity-60 animate-pulse"></div>
                  <div className="relative w-14 h-14 bg-gradient-to-br from-red-500 via-red-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{game.entry_fee} ETB GAME</h1>
                    <span className="px-3 py-1 bg-red-500/90 text-white rounded-lg font-bold text-xs uppercase tracking-wide animate-pulse shadow-lg shadow-red-500/30">
                      Live
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span className="font-semibold">{players.filter(p => !p.has_left).length}</span> Active
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      Pool: <span className="font-semibold text-emerald-400">{game.prize_pool}</span> ETB
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Winner: <span className="font-semibold text-amber-400">{(game.prize_pool * 0.9).toFixed(0)}</span> ETB
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleLogout} 
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-all duration-200 border border-white/10 flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Last Called Number Display */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition duration-1000"></div>
                <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 rounded-3xl p-8 sm:p-12 text-center shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative z-10">
                    <div className="text-white/90 text-sm sm:text-base font-bold mb-3 uppercase tracking-widest">Last Called Number</div>
                    <div className="text-white text-7xl sm:text-9xl font-black mb-4 drop-shadow-2xl tracking-tighter" style={{textShadow: '0 4px 20px rgba(0,0,0,0.4)'}}>
                      {lastNumber || '—'}
                    </div>
                    <div className="flex items-center justify-center gap-4 text-white/90 text-base sm:text-lg font-semibold">
                      <span>{calledNumbers.length} / 75</span>
                      <span className="w-1.5 h-1.5 bg-white/60 rounded-full"></span>
                      <span>{remainingNumbers} Remaining</span>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
                </div>
              </div>

              {/* Game Controls */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600 to-violet-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <svg className="w-6 h-6 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-black text-white text-lg sm:text-xl">Game Controls</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={callNumber}
                      disabled={calling || autoCalling || remainingNumbers === 0}
                      className="group relative px-6 py-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-800 transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
                      <div className="relative flex items-center justify-center gap-2">
                        {calling ? (
                          <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Calling...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                            </svg>
                            <span>Call Number</span>
                          </>
                        )}
                      </div>
                    </button>
                    
                    <button
                      onClick={toggleAutoCalling}
                      disabled={remainingNumbers === 0}
                      className={`group relative px-6 py-5 rounded-xl transition-all duration-200 font-bold text-lg shadow-lg disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden ${
                        autoCalling
                          ? 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white animate-pulse hover:shadow-red-500/50'
                          : 'bg-gradient-to-br from-violet-500 to-violet-700 hover:from-violet-600 hover:to-violet-800 text-white hover:shadow-violet-500/50'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
                      <div className="relative flex items-center justify-center gap-2">
                        {autoCalling ? (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            <span>Stop Auto</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            <span>Auto Call</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                  
                  <button
                    onClick={endGame}
                    className="w-full px-6 py-4 bg-slate-800/80 hover:bg-slate-700/80 text-white/80 hover:text-white rounded-xl transition-all duration-200 font-semibold border border-white/10 hover:border-white/20 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                    End Game
                  </button>
                </div>
              </div>

              {/* Number Board */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <svg className="w-6 h-6 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-black text-white text-lg sm:text-xl">Number Board (1-75)</h3>
                  </div>
                  <div className="grid grid-cols-10 gap-2">
                    {Array.from({ length: 75 }, (_, i) => i + 1).map((num) => {
                      const isCalled = calledNumbers.includes(num);
                      const isLast = num === lastNumber;
                      return (
                        <div
                          key={num}
                          className={`
                            w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg font-bold text-sm sm:text-base
                            transition-all duration-300 transform
                            ${isCalled 
                              ? isLast
                                ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white ring-2 ring-amber-300 scale-110 shadow-xl shadow-amber-500/50 animate-pulse'
                                : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md'
                              : 'bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:border-slate-600/50'
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
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <h3 className="font-black text-white text-lg sm:text-xl">Players</h3>
                  </div>
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm font-bold border border-cyan-500/30">
                    {players.filter(p => !p.has_left).length}/{players.length}
                  </span>
                </div>
                <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(148, 163, 184, 0.3) transparent'
                }}>
                  {players.map((player, index) => {
                    const hasBingo = checkPlayerBingo(player);
                    const selectedNums = player.selected_numbers || [];
                    const hasLeft = player.has_left;
                    return (
                      <div
                        key={player.id}
                        className={`p-4 rounded-xl border transition-all ${
                          hasLeft
                            ? 'border-red-500/30 bg-red-500/10 opacity-50'
                            : hasBingo
                            ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/20 animate-pulse'
                            : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${hasLeft ? 'bg-red-500' : hasBingo ? 'bg-emerald-500 animate-pulse' : 'bg-cyan-500'}`}></div>
                            <div className="font-bold text-white text-sm">
                              {player.users?.username || `Player ${index + 1}`}
                            </div>
                          </div>
                          {hasLeft && (
                            <span className="bg-red-500/20 text-red-300 text-xs px-2.5 py-1 rounded-md font-bold border border-red-500/30">
                              Left
                            </span>
                          )}
                          {hasBingo && !hasLeft && (
                            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 rounded-md font-bold border border-emerald-500/30 animate-pulse flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              Bingo!
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                          {hasLeft ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Left game - stake forfeited
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Marked: <span className="font-semibold text-slate-300">{player.marked_numbers?.length || 0}</span> numbers
                            </>
                          )}
                        </div>
                        {selectedNums.length > 0 && !hasLeft && (
                          <div className="text-xs">
                            <div className="font-medium text-slate-400 mb-1.5">Selected Numbers:</div>
                            <div className="flex flex-wrap gap-1">
                              {selectedNums.map((num, i) => (
                                <span key={i} className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded border border-violet-500/30 font-semibold">
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
