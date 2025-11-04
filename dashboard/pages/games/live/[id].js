import { useState, useEffect } from 'react';
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
      }, () => {
        loadGameData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      if (autoInterval) clearInterval(autoInterval);
    };
  }, [id]);

  async function loadGameData() {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single();

      if (gameError) throw gameError;
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
      console.error('Error deducting fees:', error);
    }
  }

  async function callNumber() {
    if (calling) return;
    setCalling(true);

    try {
      const calledNumbers = game.called_numbers || [];
      
      // If first number, deduct fees from all players
      if (calledNumbers.length === 0) {
        await deductAllPlayersFees();
      }
      
      const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
        .filter(n => !calledNumbers.includes(n));

      if (availableNumbers.length === 0) {
        alert('All numbers have been called!');
        return;
      }

      // Random number from available
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const newNumber = availableNumbers[randomIndex];

      const updatedNumbers = [...calledNumbers, newNumber];

      const { error } = await supabase
        .from('games')
        .update({ called_numbers: updatedNumbers })
        .eq('id', id);

      if (error) throw error;

      // Check for winners after calling number
      await checkForWinners();
    } catch (error) {
      console.error('Error calling number:', error);
      alert('Failed to call number');
    } finally {
      setCalling(false);
    }
  }

  async function checkForWinners() {
    // Check each player for BINGO
    for (const player of players) {
      const hasBingo = checkPlayerBingo(player);
      if (hasBingo) {
        await declareWinner(player);
        break;
      }
    }
  }

  function checkPlayerBingo(player) {
    const card = player.card;
    const marked = player.marked_numbers || [];
    const called = game.called_numbers || [];

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

      alert(`🎉 BINGO! Winner: ${player.users?.username || 'Player'}\nPrize: ${game.prize_pool} Birr`);
      router.push('/games');
    } catch (error) {
      console.error('Error declaring winner:', error);
      alert('Failed to declare winner');
    }
  }

  function toggleAutoCalling() {
    if (autoCalling) {
      // Stop auto-calling
      if (autoInterval) {
        clearInterval(autoInterval);
        setAutoInterval(null);
      }
      setAutoCalling(false);
    } else {
      // Start auto-calling (every 5 seconds)
      setAutoCalling(true);
      const interval = setInterval(() => {
        callNumber();
      }, 5000);
      setAutoInterval(interval);
    }
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

  return (
    <>
      <Head>
        <title>Live Game Control - {game.entry_fee} Birr</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/games')}
              className="text-blue-600 hover:text-blue-700 mb-4"
            >
              ← Back to Games
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{game.entry_fee} Birr Game - Live Control</h1>
                <p className="text-gray-600 mt-1">
                  {players.length} players • Prize Pool: {game.prize_pool} Birr
                </p>
              </div>
              <span className="bg-red-100 text-red-800 px-4 py-2 rounded-full font-semibold animate-pulse">
                🔴 LIVE
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Number Calling */}
            <div className="lg:col-span-2 space-y-6">
              {/* Last Called Number */}
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-center text-white">
                <div className="text-sm opacity-80 mb-2">Last Called Number</div>
                <div className="text-8xl font-bold mb-4">
                  {lastNumber || '-'}
                </div>
                <div className="text-sm opacity-80">
                  {calledNumbers.length} of 75 numbers called • {remainingNumbers} remaining
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Game Controls</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={callNumber}
                    disabled={calling || autoCalling || remainingNumbers === 0}
                    className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg"
                  >
                    {calling ? 'Calling...' : 'Call Number'}
                  </button>
                  <button
                    onClick={toggleAutoCalling}
                    disabled={remainingNumbers === 0}
                    className={`px-6 py-4 rounded-lg transition-colors font-semibold text-lg ${
                      autoCalling
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    {autoCalling ? 'Stop Auto-Call' : 'Start Auto-Call'}
                  </button>
                </div>
                <button
                  onClick={endGame}
                  className="w-full mt-4 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  End Game
                </button>
              </div>

              {/* All Numbers Grid (1-75) */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Number Board (1-75)</h3>
                <div className="grid grid-cols-10 gap-2">
                  {Array.from({ length: 75 }, (_, i) => i + 1).map((num) => {
                    const isCalled = calledNumbers.includes(num);
                    const isLast = num === lastNumber;
                    return (
                      <div
                        key={num}
                        className={`
                          w-12 h-12 flex items-center justify-center rounded-lg font-bold text-sm
                          transition-all duration-300
                          ${isCalled 
                            ? isLast
                              ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-4 ring-yellow-200 scale-110 shadow-lg'
                              : 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-400'
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

            {/* Right Column - Players */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Players ({players.length})
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {players.map((player, index) => {
                    const hasBingo = checkPlayerBingo(player);
                    const selectedNums = player.selected_numbers || [];
                    return (
                      <div
                        key={player.id}
                        className={`p-4 rounded-lg border-2 ${
                          hasBingo
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">
                            {player.users?.username || `Player ${index + 1}`}
                          </div>
                          {hasBingo && (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                              BINGO!
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          Marked: {player.marked_numbers?.length || 0} numbers
                        </div>
                        {selectedNums.length > 0 && (
                          <div className="text-xs text-gray-500">
                            <div className="font-medium mb-1">Selected:</div>
                            <div className="flex flex-wrap gap-1">
                              {selectedNums.map((num, i) => (
                                <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
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
        </div>
      </div>
    </>
  );
}
