import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
});

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

// Join a game (NO money deducted yet - only when game starts)
export async function joinGame(gameId, userId, card, entryFee, selectedNumbers = []) {
  // Check if game has already started
  const { data: gameData } = await supabase
    .from('games')
    .select('status')
    .eq('id', gameId)
    .single();
  
  if (!gameData) {
    return { success: false, error: 'Game not found' };
  }
  
  if (gameData.status !== 'waiting') {
    return { success: false, error: 'Game has already started. Please wait for the next game.' };
  }
  
  // Check if already joined
  const { data: existing } = await supabase
    .from('game_players')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single();
  
  if (existing) {
    return { success: true, data: existing, alreadyJoined: true };
  }
  
  // Check user balance (but don't deduct yet)
  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single();
  
  if (!user || user.balance < entryFee) {
    return { success: false, error: 'Insufficient balance' };
  }
  
  // Join game (money will be deducted when game starts)
  const { data, error } = await supabase
    .from('game_players')
    .insert({
      game_id: gameId,
      user_id: userId,
      card: card,
      marked_numbers: [],
      selected_numbers: selectedNumbers,
      paid: false  // Track if player has paid
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error joining game:', error);
    return { success: false, error: error.message };
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
