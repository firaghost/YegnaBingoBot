import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserId, hapticFeedback, setBackButton, showAlert } from '../../lib/telegram';
import { getUserByTelegramId, getGameDetails, subscribeToGame, markNumber, checkBingo } from '../../lib/supabase';

export default function PlayGame() {
  const router = useRouter();
  const { gameId } = router.query;
  
  const [user, setUser] = useState(null);
  const [game, setGame] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState([]);
  const [gameState, setGameState] = useState('loading'); // loading, waiting, playing, won, lost
  const [lastCalledNumber, setLastCalledNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId) {
      console.log('⏳ Waiting for gameId from router...');
      return;
    }
    loadGameData();
    setBackButton(() => router.push('/'));
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    try {
      // Subscribe to real-time game updates
      console.log('Setting up real-time subscription for game:', gameId);
      const channel = subscribeToGame(gameId, async (payload) => {
        try {
          console.log('🔴 REAL-TIME UPDATE:', payload);
          const updatedGame = payload.new;
          setGame(updatedGame);
          
          // Check if game just started
          if (updatedGame.status === 'active' && gameState === 'waiting') {
            console.log('🎮 Game started! Transitioning to playing...');
            setGameState('playing');
            hapticFeedback('heavy');
          }
          
          // Update called numbers
          if (updatedGame.status === 'active') {
            const numbers = updatedGame.called_numbers || [];
            setCalledNumbers(numbers);
            
            // Show last called number
            if (numbers.length > 0) {
              const last = numbers[numbers.length - 1];
              if (last !== lastCalledNumber) {
                setLastCalledNumber(last);
                hapticFeedback('medium');
              }
            }
          }
          
          // Check if game completed
          if (updatedGame.status === 'completed') {
            checkGameResult(updatedGame);
          }
        } catch (err) {
          console.error('Error in real-time update:', err);
          setError('Failed to process game update');
        }
      });

      return () => {
        console.log('Unsubscribing from game updates');
        if (channel) channel.unsubscribe();
      };
    } catch (err) {
      console.error('Error setting up subscription:', err);
      setError('Failed to connect to game');
    }
  }, [gameId, gameState, lastCalledNumber]);

  async function loadGameData() {
    console.log('🎮 Loading game data for gameId:', gameId);
    setLoading(true);
    
    // Add timeout
    const timeout = setTimeout(() => {
      console.error('⏰ Loading timeout!');
      setError('Loading timeout. Please try again.');
      setLoading(false);
      setTimeout(() => router.push('/'), 2000);
    }, 10000); // 10 second timeout
    
    try {
      const telegramUserId = getUserId();
      console.log('👤 Telegram User ID:', telegramUserId);
      const userData = await getUserByTelegramId(telegramUserId) || { id: 'test', balance: 5 };
      console.log('✅ User data loaded:', userData);
      setUser(userData);

      if (!gameId) {
        console.error('❌ No gameId provided');
        clearTimeout(timeout);
        return;
      }

      console.log('🔍 Fetching game details...');
      const gameData = await getGameDetails(gameId);
      console.log('📊 Game data:', gameData);
      clearTimeout(timeout);
      
      if (!gameData) {
        console.error('Game not found');
        setError('Game not found');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      setGame(gameData);
      setCalledNumbers(gameData.called_numbers || []);

      // Find player's data
      const player = gameData.game_players?.find(p => p.user_id === userData.id);
      if (player) {
        setPlayerData(player);
        setMarkedNumbers(player.marked_numbers || []);
      } else {
        console.error('Player not found in game');
        setError('You are not in this game');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      // Set game state
      if (gameData.status === 'waiting') {
        setGameState('waiting');
      } else if (gameData.status === 'active') {
        setGameState('playing');
      } else if (gameData.status === 'completed') {
        checkGameResult(gameData);
      }

      setLoading(false);
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error loading game data:', error);
      setError(error.message || 'Failed to load game');
      setLoading(false);
      setTimeout(() => router.push('/'), 2000);
    }
  }

  function checkGameResult(gameData) {
    if (gameData.winner_id === user?.id) {
      setGameState('won');
    } else {
      setGameState('lost');
    }
  }

  async function handleNumberClick(number) {
    if (gameState !== 'playing') return;
    if (!calledNumbers.includes(number)) return;
    if (markedNumbers.includes(number)) return;

    hapticFeedback('light');

    const result = await markNumber(playerData.id, number);
    if (result.success) {
      setMarkedNumbers(result.markedNumbers);

      // Check for BINGO
      const bingoResult = await checkBingo(playerData.id);
      if (bingoResult.hasBingo) {
        console.log('🎉 BINGO! Game ending...');
        showAlert('🎉 BINGO! You won!');
        hapticFeedback('heavy');
        // Game will be updated via real-time subscription
        // The subscription will detect status change to 'completed'
      }
    }
  }

  const letters = ['B', 'I', 'N', 'G', 'O'];
  const letterColors = ['#EF4444', '#FCD34D', '#60A5FA', '#34D399', '#F97316'];

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-pink-600 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <>
        <Head>
          <title>Waiting for Players - Yegna Bingo</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-4xl">⏳</span>
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-4">
                ተጫዋቾች ይጠብቁ...
              </h1>
              
              <p className="text-white/80 mb-6">
                Waiting for other players to join
              </p>

              <div className="bg-white/20 rounded-2xl p-6 mb-6">
                <div className="text-5xl font-bold text-white mb-2">
                  {game?.game_players?.length || 0}
                </div>
                <div className="text-white/80">
                  Players Joined
                </div>
              </div>

              <div className="space-y-3">
                {game?.game_players?.map((player, index) => (
                  <div key={index} className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">{index + 1}</span>
                    </div>
                    <div className="text-white font-medium">
                      {player.users?.username || 'Player ' + (index + 1)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-white/60 text-sm">
                Game will start automatically when ready
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (gameState === 'won') {
    return (
      <>
        <Head>
          <title>You Won! - Yegna Bingo</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center">
              <div className="mb-6">
                <div className="text-8xl mb-4 animate-bounce">🎉</div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  BINGO!
                </h1>
                <p className="text-2xl text-white/90">
                  You Won!
                </p>
              </div>

              <div className="bg-white/20 rounded-2xl p-6 mb-6">
                <div className="text-white/80 mb-2">Prize</div>
                <div className="text-5xl font-bold text-white">
                  {game?.prize_pool || 0} ብር
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="btn btn-primary w-full text-lg"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (gameState === 'lost') {
    return (
      <>
        <Head>
          <title>Game Over - Yegna Bingo</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center">
              <div className="mb-6">
                <div className="text-6xl mb-4">😔</div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Game Over
                </h1>
                <p className="text-xl text-white/80">
                  Better luck next time!
                </p>
              </div>

              <div className="bg-white/20 rounded-2xl p-6 mb-6">
                <div className="text-white/80 mb-2">Winner</div>
                <div className="text-2xl font-bold text-white">
                  {game?.game_players?.find(p => p.user_id === game.winner_id)?.users?.username || 'Unknown'}
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="btn btn-primary w-full text-lg"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Playing state
  const bingoCard = playerData?.card || [];

  // Safety check - if no card data, show error
  if (!bingoCard || bingoCard.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-pink-600 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Card Error</h2>
          <p className="text-gray-600 mb-4">
            Your Bingo card could not be loaded. Please try rejoining the game.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Playing Yegna Bingo - Live</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 backdrop-blur-sm px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Live Game</h1>
              <p className="text-xs text-purple-200">
                {game?.game_players?.length || 0} Players
              </p>
            </div>
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 rounded-xl shadow-lg">
              <div className="text-sm text-white/80">Prize Pool</div>
              <div className="font-bold text-white">{game?.prize_pool || 0} ብር</div>
            </div>
          </div>
        </div>

        {/* Last Called Number */}
        {lastCalledNumber && (
          <div className="px-4 py-6">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl p-6 text-center shadow-2xl animate-pulse">
              <div className="text-white/80 text-sm mb-2">Last Called</div>
              <div className="text-7xl font-bold text-white">
                {lastCalledNumber}
              </div>
            </div>
          </div>
        )}

        {/* BINGO Letters */}
        <div className="px-4 mb-4">
          <div className="grid grid-cols-5 gap-2">
            {letters.map((letter, index) => (
              <div
                key={letter}
                className="text-center font-bold text-3xl py-2 rounded-xl"
                style={{ 
                  color: letterColors[index],
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        {/* Bingo Card */}
        <div className="px-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4 shadow-2xl">
            {bingoCard.length === 5 && (
              <div className="grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((row) => (
                  <React.Fragment key={row}>
                    {[0, 1, 2, 3, 4].map((col) => {
                      // Safety check for card data
                      if (!bingoCard[col] || bingoCard[col][row] === undefined) {
                        return (
                          <div key={`${row}-${col}`} className="aspect-square bg-gray-500 rounded-xl"></div>
                        );
                      }
                      
                      const number = bingoCard[col][row];
                      const isCalled = calledNumbers.includes(number);
                      const isMarked = markedNumbers.includes(number);
                      const isFree = number === '#';
                      
                      return (
                        <button
                          key={`${row}-${col}`}
                          onClick={() => handleNumberClick(number)}
                          disabled={!isCalled || isMarked || isFree}
                          className={`
                            aspect-square rounded-xl font-bold text-lg
                            transition-all duration-300 transform
                            ${isFree ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-2xl' : ''}
                            ${isMarked ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white scale-95 shadow-lg' : ''}
                            ${isCalled && !isMarked && !isFree ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white animate-pulse' : ''}
                            ${!isCalled && !isFree ? 'bg-white/20 text-white/60' : ''}
                            ${isCalled && !isMarked && !isFree ? 'hover:scale-105' : ''}
                            disabled:cursor-not-allowed
                          `}
                        >
                          {isFree ? '★' : number}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Called Numbers */}
        <div className="px-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
            <h3 className="text-white font-semibold mb-3 text-center">
              Called Numbers ({calledNumbers.length})
            </h3>
            <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto">
              {calledNumbers.length === 0 ? (
                <p className="text-white/60 text-sm">Waiting for numbers...</p>
              ) : (
                calledNumbers.map((num) => (
                  <span 
                    key={num} 
                    className="bg-gradient-to-br from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full font-bold text-sm shadow-lg"
                  >
                    {num}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
