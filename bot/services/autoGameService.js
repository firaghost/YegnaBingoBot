import { supabase } from '../utils/supabaseClient.js';
import { startGame } from './gameService.js';

// Store active countdowns
const activeCountdowns = new Map();
const activeGames = new Map();

/**
 * Check if game should start countdown (2+ players)
 */
export async function checkAndStartCountdown(gameId) {
  try {
    // Check if countdown already active
    if (activeCountdowns.has(gameId)) {
      console.log(`⏰ Countdown already active for game ${gameId}`);
      return;
    }

    // Get game and player count
    const { data: game, error } = await supabase
      .from('games')
      .select(`
        *,
        game_players (id)
      `)
      .eq('id', gameId)
      .single();

    if (error) throw error;

    const playerCount = game.game_players?.length || 0;

    // Start countdown if 2+ players and game is waiting
    if (playerCount >= 2 && game.status === 'waiting') {
      console.log(`🎮 Starting countdown for game ${gameId} with ${playerCount} players`);
      await startCountdown(gameId);
    }
  } catch (error) {
    console.error('Error checking countdown:', error);
  }
}

/**
 * Start 60-second countdown
 */
async function startCountdown(gameId) {
  try {
    const countdownEnd = new Date(Date.now() + 60000); // 60 seconds from now

    // Update game with countdown end time
    await supabase
      .from('games')
      .update({ 
        countdown_end: countdownEnd.toISOString(),
        status: 'countdown'
      })
      .eq('id', gameId);

    console.log(`⏰ Countdown started for game ${gameId}, ends at ${countdownEnd.toISOString()}`);

    // Set timeout to auto-start game
    const timeout = setTimeout(async () => {
      await autoStartGame(gameId);
      activeCountdowns.delete(gameId);
    }, 60000);

    activeCountdowns.set(gameId, timeout);
  } catch (error) {
    console.error('Error starting countdown:', error);
  }
}

/**
 * Auto-start game after countdown
 */
async function autoStartGame(gameId) {
  try {
    console.log(`🚀 Auto-starting game ${gameId}`);

    // Start the game (deduct money, set status to active)
    const result = await startGame(gameId);

    if (result.success) {
      console.log(`✅ Game ${gameId} auto-started with ${result.playersCharged} players`);
      
      // Start auto-calling numbers
      await startAutoNumberCalling(gameId);
    } else {
      console.error(`❌ Failed to auto-start game ${gameId}:`, result.error);
    }
  } catch (error) {
    console.error('Error auto-starting game:', error);
  }
}

/**
 * Auto-call numbers every 5 seconds
 */
async function startAutoNumberCalling(gameId) {
  try {
    console.log(`🔢 Starting auto number calling for game ${gameId}`);

    const interval = setInterval(async () => {
      try {
        // Get current game state
        const { data: game, error } = await supabase
          .from('games')
          .select('status, called_numbers')
          .eq('id', gameId)
          .single();

        if (error) throw error;

        // Stop if game is no longer active
        if (game.status !== 'active') {
          console.log(`🛑 Stopping auto-call for game ${gameId} (status: ${game.status})`);
          clearInterval(interval);
          activeGames.delete(gameId);
          return;
        }

        // Get called numbers
        const calledNumbers = game.called_numbers || [];

        // Stop if all numbers called
        if (calledNumbers.length >= 75) {
          console.log(`🛑 All numbers called for game ${gameId}`);
          clearInterval(interval);
          activeGames.delete(gameId);
          return;
        }

        // Generate next number
        const availableNumbers = [];
        for (let i = 1; i <= 75; i++) {
          if (!calledNumbers.includes(i)) {
            availableNumbers.push(i);
          }
        }

        if (availableNumbers.length === 0) {
          clearInterval(interval);
          activeGames.delete(gameId);
          return;
        }

        // Pick random number
        const nextNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
        const updatedNumbers = [...calledNumbers, nextNumber];

        // Update game with new number
        await supabase
          .from('games')
          .update({ 
            called_numbers: updatedNumbers,
            last_number: nextNumber
          })
          .eq('id', gameId);

        console.log(`🔢 Called number ${nextNumber} for game ${gameId} (${updatedNumbers.length}/75)`);

        // Check for winners
        await checkForWinners(gameId, updatedNumbers);
      } catch (error) {
        console.error('Error calling number:', error);
      }
    }, 5000); // Call number every 5 seconds

    activeGames.set(gameId, interval);
  } catch (error) {
    console.error('Error starting auto number calling:', error);
  }
}

/**
 * Check if any player has won
 */
async function checkForWinners(gameId, calledNumbers) {
  try {
    // Get all players in the game
    const { data: players, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId);

    if (error) throw error;

    // Check each player's card
    for (const player of players) {
      const card = player.card || [];
      const markedNumbers = player.marked_numbers || [];

      // Check if player has bingo
      const hasBingo = checkBingo(card, markedNumbers, calledNumbers);

      if (hasBingo) {
        console.log(`🎉 WINNER! Player ${player.user_id} won game ${gameId}`);
        await endGame(gameId, player.user_id);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking winners:', error);
    return false;
  }
}

/**
 * Check if player has bingo
 */
function checkBingo(card, markedNumbers, calledNumbers) {
  if (!card || card.length !== 25) return false;

  // Create 5x5 grid
  const grid = [];
  for (let i = 0; i < 5; i++) {
    grid[i] = card.slice(i * 5, (i + 1) * 5);
  }

  // Check if number is marked (either manually or called)
  const isMarked = (num) => {
    return markedNumbers.includes(num) || calledNumbers.includes(num);
  };

  // Check rows
  for (let row = 0; row < 5; row++) {
    if (grid[row].every(num => num === 0 || isMarked(num))) {
      return true;
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (grid.every(row => row[col] === 0 || isMarked(row[col]))) {
      return true;
    }
  }

  // Check diagonals
  if (grid.every((row, i) => row[i] === 0 || isMarked(row[i]))) {
    return true;
  }
  if (grid.every((row, i) => row[4 - i] === 0 || isMarked(row[4 - i]))) {
    return true;
  }

  return false;
}

/**
 * End game and award prize
 */
async function endGame(gameId, winnerId) {
  try {
    // Get game details
    const { data: game } = await supabase
      .from('games')
      .select('prize_pool')
      .eq('id', gameId)
      .single();

    const prizePool = game?.prize_pool || 0;
    const commission = prizePool * 0.10;
    const playerPrize = prizePool - commission;

    // Update winner's balance
    const { data: winner } = await supabase
      .from('users')
      .select('balance')
      .eq('id', winnerId)
      .single();

    const newBalance = (winner?.balance || 0) + playerPrize;

    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', winnerId);

    // Update game status
    await supabase
      .from('games')
      .update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString()
      })
      .eq('id', gameId);

    // Log transaction
    await supabase
      .from('transaction_history')
      .insert({
        user_id: winnerId,
        type: 'game_win',
        amount: playerPrize,
        description: `Won game ${gameId} - Prize: ${playerPrize} Birr`
      });

    console.log(`✅ Game ${gameId} ended. Winner: ${winnerId}, Prize: ${playerPrize} Birr`);

    // Stop auto-calling
    const interval = activeGames.get(gameId);
    if (interval) {
      clearInterval(interval);
      activeGames.delete(gameId);
    }

    // Send notifications (implement later)
    // await notifyGameResult(gameId, winnerId, playerPrize);
  } catch (error) {
    console.error('Error ending game:', error);
  }
}

/**
 * Cancel countdown if player leaves
 */
export async function cancelCountdownIfNeeded(gameId) {
  try {
    // Check player count
    const { data: players } = await supabase
      .from('game_players')
      .select('id')
      .eq('game_id', gameId);

    const playerCount = players?.length || 0;

    // Cancel countdown if less than 2 players
    if (playerCount < 2) {
      const timeout = activeCountdowns.get(gameId);
      if (timeout) {
        clearTimeout(timeout);
        activeCountdowns.delete(gameId);
        
        // Reset game status
        await supabase
          .from('games')
          .update({ 
            countdown_end: null,
            status: 'waiting'
          })
          .eq('id', gameId);

        console.log(`⏰ Countdown cancelled for game ${gameId} (not enough players)`);
      }
    }
  } catch (error) {
    console.error('Error cancelling countdown:', error);
  }
}

/**
 * Clean up on server restart
 */
export function cleanupAutoGames() {
  activeCountdowns.forEach((timeout) => clearTimeout(timeout));
  activeGames.forEach((interval) => clearInterval(interval));
  activeCountdowns.clear();
  activeGames.clear();
  console.log('🧹 Cleaned up auto-game timers');
}
