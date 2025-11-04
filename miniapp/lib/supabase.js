import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get user by Telegram ID
export async function getUserByTelegramId(telegramId) {
  if (!telegramId) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId.toString())
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user:', error);
    return null;
  }
  
  return data;
}

// Get user by ID
export async function getUserById(userId) {
  if (!userId) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  
  return data;
}

// Get available games by entry fee
export async function getGamesByFee(entryFee) {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      game_players (
        id,
        user_id,
        users (username)
      )
    `)
    .eq('entry_fee', entryFee)
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error('Error fetching games:', error);
    return null;
  }
  
  return data && data.length > 0 ? data[0] : null;
}

// Create a new game
export async function createGame(entryFee) {
  const { data, error } = await supabase
    .from('games')
    .insert({
      entry_fee: entryFee,
      status: 'waiting',
      prize_pool: 0,
      called_numbers: []
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating game:', error);
    return null;
  }
  
  return data;
}

// Join a game
export async function joinGame(gameId, userId, card, entryFee) {
  // Check if already joined
  const { data: existing } = await supabase
    .from('game_players')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single();
  
  if (existing) {
    return { success: false, error: 'Already joined this game' };
  }
  
  // Join game
  const { data, error } = await supabase
    .from('game_players')
    .insert({
      game_id: gameId,
      user_id: userId,
      card: card,
      marked_numbers: []
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error joining game:', error);
    return { success: false, error: error.message };
  }
  
  // Update user balance
  const { error: balanceError } = await supabase.rpc('deduct_balance', {
    user_id: userId,
    amount: entryFee
  });
  
  if (balanceError) {
    console.error('Error updating balance:', balanceError);
  }
  
  // Update prize pool
  const { error: poolError } = await supabase.rpc('add_to_prize_pool', {
    game_id: gameId,
    amount: entryFee
  });
  
  if (poolError) {
    console.error('Error updating prize pool:', poolError);
  }
  
  return { success: true, data };
}

// Get game details
export async function getGameDetails(gameId) {
  const { data, error } = await supabase
    .from('games')
    .select(`
      *,
      game_players (
        *,
        users (id, username, telegram_id)
      )
    `)
    .eq('id', gameId)
    .single();
  
  if (error) {
    console.error('Error fetching game details:', error);
    return null;
  }
  
  return data;
}

// Get player's game
export async function getPlayerGame(userId) {
  const { data, error } = await supabase
    .from('game_players')
    .select(`
      *,
      games (
        *,
        game_players (
          id,
          users (username)
        )
      )
    `)
    .eq('user_id', userId)
    .in('games.status', ['waiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching player game:', error);
    return null;
  }
  
  return data;
}

// Mark number on card
export async function markNumber(gamePlayerId, number) {
  const { data: player } = await supabase
    .from('game_players')
    .select('marked_numbers')
    .eq('id', gamePlayerId)
    .single();
  
  if (!player) return { success: false };
  
  const markedNumbers = player.marked_numbers || [];
  if (!markedNumbers.includes(number)) {
    markedNumbers.push(number);
  }
  
  const { error } = await supabase
    .from('game_players')
    .update({ marked_numbers: markedNumbers })
    .eq('id', gamePlayerId);
  
  if (error) {
    console.error('Error marking number:', error);
    return { success: false };
  }
  
  return { success: true, markedNumbers };
}

// Check for BINGO
export async function checkBingo(gamePlayerId) {
  const { data: player } = await supabase
    .from('game_players')
    .select('card, marked_numbers')
    .eq('id', gamePlayerId)
    .single();
  
  if (!player) return false;
  
  const card = player.card;
  const marked = player.marked_numbers || [];
  
  // Check rows
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    for (let col = 0; col < 5; col++) {
      const num = card[col][row];
      if (num !== '#' && !marked.includes(num)) {
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
      if (num !== '#' && !marked.includes(num)) {
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
    if (num1 !== '#' && !marked.includes(num1)) diag1 = false;
    if (num2 !== '#' && !marked.includes(num2)) diag2 = false;
  }
  
  return diag1 || diag2;
}

// Subscribe to game updates
export function subscribeToGame(gameId, callback) {
  return supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, callback)
    .subscribe();
}
