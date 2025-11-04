import { supabase } from '../utils/supabaseClient.js';
import { generateBingoCard, checkBingoWin } from '../utils/bingoEngine.js';

const GAME_ENTRY_FEE = 5;

/**
 * Get or create an active game
 */
export async function getActiveGame() {
  try {
    // Check for waiting game
    const { data: waitingGame, error: waitingError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (waitingGame) return waitingGame;

    // Check for active game
    const { data: activeGame, error: activeError } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeGame) return activeGame;

    // Create new game
    const { data: newGame, error: createError } = await supabase
      .from('games')
      .insert({
        status: 'waiting',
        prize_pool: 0,
        called_numbers: []
      })
      .select()
      .single();

    if (createError) throw createError;
    return newGame;
  } catch (error) {
    console.error('Error getting active game:', error);
    return null;
  }
}

/**
 * Join a game
 */
export async function joinGame(gameId, userId, userBalance) {
  try {
    // Check if user has enough balance
    if (userBalance < GAME_ENTRY_FEE) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Check if user already joined
    const { data: existing } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return { success: false, error: 'Already joined this game' };
    }

    // Generate Bingo card
    const card = generateBingoCard();

    // Add player to game (DON'T deduct money yet - only when game starts)
    const { data: player, error: playerError } = await supabase
      .from('game_players')
      .insert({
        game_id: gameId,
        user_id: userId,
        card: card,
        marked_numbers: [],
        paid: false  // Money not deducted yet
      })
      .select()
      .single();

    if (playerError) throw playerError;

    // DON'T deduct money here - it will be deducted when admin starts the game

    return { success: true, player, card };
  } catch (error) {
    console.error('Error joining game:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get game players count
 */
export async function getGamePlayersCount(gameId) {
  try {
    const { count, error } = await supabase
      .from('game_players')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting players count:', error);
    return 0;
  }
}

/**
 * Start a game - THIS IS WHERE MONEY IS DEDUCTED
 */
export async function startGame(gameId) {
  try {
    // Get all players who haven't paid yet
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('*, users(balance)')
      .eq('game_id', gameId)
      .eq('paid', false);

    if (playersError) throw playersError;

    let totalPrizePool = 0;

    // Deduct entry fee from each player
    for (const player of players) {
      const userBalance = player.users?.balance || 0;
      
      if (userBalance < GAME_ENTRY_FEE) {
        console.warn(`Player ${player.user_id} has insufficient balance`);
        // Remove player from game
        await supabase
          .from('game_players')
          .delete()
          .eq('id', player.id);
        continue;
      }

      // Deduct money from user
      await supabase
        .from('users')
        .update({ balance: userBalance - GAME_ENTRY_FEE })
        .eq('id', player.user_id);

      // Mark player as paid
      await supabase
        .from('game_players')
        .update({ paid: true })
        .eq('id', player.id);

      totalPrizePool += GAME_ENTRY_FEE;

      // Log transaction
      await supabase
        .from('transaction_history')
        .insert({
          user_id: player.user_id,
          type: 'game_entry',
          amount: -GAME_ENTRY_FEE,
          description: `Joined game ${gameId}`
        });
    }

    // Update game with prize pool and status
    const { data, error } = await supabase
      .from('games')
      .update({
        status: 'active',
        prize_pool: totalPrizePool,
        started_at: new Date().toISOString()
      })
      .eq('id', gameId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, game: data };
  } catch (error) {
    console.error('Error starting game:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for winners after a number is called
 */
export async function checkForWinners(gameId, calledNumbers) {
  try {
    const { data: players, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId);

    if (error) throw error;

    const winners = [];
    for (const player of players) {
      if (checkBingoWin(player.card, calledNumbers)) {
        winners.push(player);
      }
    }

    return winners;
  } catch (error) {
    console.error('Error checking for winners:', error);
    return [];
  }
}

/**
 * End game and award prize
 */
export async function endGame(gameId, winnerId) {
  try {
    // Get game details
    const { data: game } = await supabase
      .from('games')
      .select('prize_pool')
      .eq('id', gameId)
      .single();

    // Mark winner
    await supabase
      .from('game_players')
      .update({ is_winner: true })
      .eq('game_id', gameId)
      .eq('user_id', winnerId);

    // Update game status
    await supabase
      .from('games')
      .update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString()
      })
      .eq('id', gameId);

    // Award prize to winner
    const { data: winner } = await supabase
      .from('users')
      .select('balance')
      .eq('id', winnerId)
      .single();

    await supabase
      .from('users')
      .update({ balance: (winner?.balance || 0) + (game?.prize_pool || 0) })
      .eq('id', winnerId);

    return { success: true, prizeAmount: game?.prize_pool || 0 };
  } catch (error) {
    console.error('Error ending game:', error);
    return { success: false, error: error.message };
  }
}
