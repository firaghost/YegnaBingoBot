import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mrayxghardqswonihwjs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yYXl4Z2hhcmRxc3dvbmlod2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDAwMjMsImV4cCI6MjA3NzgxNjAyM30.fccY-cedgjsgsAIefDPFOuF6jtm-vdaA7VYcIFhm1jU';

// Debug log (remove in production)
if (typeof window !== 'undefined') {
  console.log('Supabase Config:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length
  });
}

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
  try {
    console.log('🎮 JOIN GAME - Starting...', { gameId, userId, entryFee });
    
    // Check if game has already started
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('status')
      .eq('id', gameId)
      .single();
    
    if (gameError) {
      console.error('Game check error:', gameError);
      return { success: false, error: 'Failed to check game status' };
    }
    
    if (!gameData) {
      return { success: false, error: 'Game not found' };
    }
    
    console.log('✅ Game status:', gameData.status);
    
    if (gameData.status !== 'waiting') {
      return { success: false, error: 'Game has already started. Please wait for the next game.' };
    }
    
    // Check if already joined - use different query to avoid 406
    const { data: existingList, error: checkError } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .limit(1);
    
    if (checkError) {
      console.error('Player check error:', checkError);
      // Continue anyway - might be first time joining
    }
    
    if (existingList && existingList.length > 0) {
      console.log('✅ Player already joined - no charge');
      return { success: true, data: existingList[0], alreadyJoined: true };
    }
    
    // Check user balance (but don't deduct yet)
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();
    
    console.log('💰 User balance BEFORE join:', user?.balance);
    
    if (!user || user.balance < entryFee) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Join game (money will be deducted when game starts)
    console.log('⚠️ IMPORTANT: NOT deducting money now - will deduct when admin starts game');
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
    
    // Verify balance didn't change
    const { data: userAfter } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();
    
    console.log('💰 User balance AFTER join:', userAfter?.balance);
    console.log('✅ JOIN COMPLETE - Money NOT deducted (paid: false)');
    
    // Trigger countdown check (call bot API)
    try {
      await fetch('/api/check-countdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });
    } catch (error) {
      console.error('Failed to trigger countdown check:', error);
      // Don't fail the join if countdown check fails
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('Join game error:', err);
    return { success: false, error: 'Failed to join game' };
  }
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

// Check for BINGO and end game if won
export async function checkBingo(gamePlayerId) {
  console.log('🔍 checkBingo called for player ID:', gamePlayerId);
  
  const { data: player, error: playerError } = await supabase
    .from('game_players')
    .select('card, marked_numbers, game_id, user_id, games(status, called_numbers, prize_pool)')
    .eq('id', gamePlayerId)
    .single();
  
  if (playerError) {
    console.error('❌ Error fetching player:', playerError);
    return { hasBingo: false };
  }
  
  if (!player) {
    console.log('❌ Player not found');
    return { hasBingo: false };
  }
  
  console.log('📊 Player data:', {
    user_id: player.user_id,
    game_id: player.game_id,
    game_status: player.games?.status,
    called_numbers_count: player.games?.called_numbers?.length || 0,
    marked_numbers_count: player.marked_numbers?.length || 0,
    prize_pool: player.games?.prize_pool
  });
  
  // CRITICAL: Only check BINGO if game is active
  if (!player.games || player.games.status !== 'active') {
    console.log('⚠️ Game not active (status:', player.games?.status, '), skipping BINGO check');
    return { hasBingo: false };
  }
  
  // CRITICAL: Only check if numbers have been called
  const calledNumbers = player.games?.called_numbers || [];
  if (!Array.isArray(calledNumbers) || calledNumbers.length === 0) {
    console.log('⚠️ No numbers called yet (length:', calledNumbers.length, '), skipping BINGO check');
    return { hasBingo: false };
  }
  
  // CRITICAL: Only check if marked numbers exist
  const marked = player.marked_numbers || [];
  if (!Array.isArray(marked) || marked.length === 0) {
    console.log('⚠️ No numbers marked yet, skipping BINGO check');
    return { hasBingo: false };
  }
  
  const card = player.card;
  let hasBingo = false;
  
  console.log('🔍 Checking BINGO for player:', player.user_id);
  console.log('📋 Card structure:', JSON.stringify(card));
  console.log('✅ Marked numbers:', marked);
  console.log('🎲 Called numbers:', calledNumbers.length);
  
  // Check rows - card is stored as [col][row] (column-major)
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    const rowNumbers = [];
    for (let col = 0; col < 5; col++) {
      const num = card[col][row];
      rowNumbers.push(num);
      if (num !== '#' && !marked.includes(num)) {
        rowComplete = false;
      }
    }
    console.log(`Row ${row}: [${rowNumbers.join(', ')}] - Complete: ${rowComplete}`);
    if (rowComplete) {
      console.log(`🎉 BINGO! Row ${row} is complete!`);
      hasBingo = true;
      break;
    }
  }
  
  // Check columns
  if (!hasBingo) {
    for (let col = 0; col < 5; col++) {
      let colComplete = true;
      const colNumbers = [];
      for (let row = 0; row < 5; row++) {
        const num = card[col][row];
        colNumbers.push(num);
        if (num !== '#' && !marked.includes(num)) {
          colComplete = false;
        }
      }
      console.log(`Col ${col}: [${colNumbers.join(', ')}] - Complete: ${colComplete}`);
      if (colComplete) {
        console.log(`🎉 BINGO! Column ${col} is complete!`);
        hasBingo = true;
        break;
      }
    }
  }
  
  // Check diagonals
  if (!hasBingo) {
    let diag1 = true, diag2 = true;
    const diag1Numbers = [];
    const diag2Numbers = [];
    for (let i = 0; i < 5; i++) {
      const num1 = card[i][i];
      const num2 = card[i][4 - i];
      diag1Numbers.push(num1);
      diag2Numbers.push(num2);
      if (num1 !== '#' && !marked.includes(num1)) diag1 = false;
      if (num2 !== '#' && !marked.includes(num2)) diag2 = false;
    }
    console.log(`Diag 1 (\\): [${diag1Numbers.join(', ')}] - Complete: ${diag1}`);
    console.log(`Diag 2 (/): [${diag2Numbers.join(', ')}] - Complete: ${diag2}`);
    if (diag1) console.log('🎉 BINGO! Diagonal \\ is complete!');
    if (diag2) console.log('🎉 BINGO! Diagonal / is complete!');
    hasBingo = diag1 || diag2;
  }
  
  // If BINGO detected, end the game
  if (hasBingo) {
    console.log('🎉 BINGO DETECTED! Ending game...');
    await endGame(player.game_id, player.user_id);
  }
  
  return { hasBingo, gameId: player.game_id, userId: player.user_id };
}

// End game and award winner
export async function endGame(gameId, winnerId) {
  try {
    // Get game details
    const { data: game } = await supabase
      .from('games')
      .select('prize_pool, status, called_numbers')
      .eq('id', gameId)
      .single();
    
    // CRITICAL VALIDATIONS
    if (!game) {
      console.error('❌ Game not found:', gameId);
      return { success: false };
    }
    
    if (game.status !== 'active') {
      console.error('❌ Game not active (status:', game.status, '), cannot end');
      return { success: false };
    }
    
    if (!game.called_numbers || game.called_numbers.length === 0) {
      console.error('❌ No numbers called, cannot have winner yet');
      return { success: false };
    }
    
    if (!game.prize_pool || game.prize_pool === 0) {
      console.error('❌ Prize pool is 0, game not properly started');
      return { success: false };
    }
    
    console.log('✅ Validations passed, ending game:', gameId, 'Winner:', winnerId);
    
    // Calculate commission (10% for app owner)
    const COMMISSION_RATE = 0.10;
    const totalPool = game.prize_pool;
    const commission = totalPool * COMMISSION_RATE;
    const playerPrize = totalPool - commission;
    
    console.log(`💰 Prize breakdown: Total: ${totalPool}, Commission: ${commission}, Player Prize: ${playerPrize}`);
    
    // Update game status and set winner
    const { error: gameError } = await supabase
      .from('games')
      .update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString()
      })
      .eq('id', gameId);
    
    if (gameError) {
      console.error('Error updating game:', gameError);
      return { success: false };
    }
    
    // Award prize to winner (after commission)
    const { error: prizeError } = await supabase
      .from('users')
      .update({
        balance: supabase.raw(`balance + ${playerPrize}`)
      })
      .eq('id', winnerId);
    
    if (prizeError) {
      console.error('Error awarding prize:', prizeError);
    }
    
    // Log commission to transaction_history (optional - for tracking)
    await supabase
      .from('transaction_history')
      .insert({
        user_id: winnerId,
        type: 'game_win',
        amount: playerPrize,
        description: `Won game ${gameId} (Prize: ${playerPrize} ETB, Commission: ${commission} ETB)`
      });
    
    console.log(`✅ Game ${gameId} ended. Winner: ${winnerId}, Prize: ${playerPrize} ETB (Commission: ${commission} ETB)`);
    
    // Send notifications to all players
    try {
      // Get all players in the game
      const { data: allPlayers } = await supabase
        .from('game_players')
        .select('user_id')
        .eq('game_id', gameId);
      
      if (allPlayers) {
        // Notify winner
        await fetch('/api/notify-game-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: winnerId,
            gameId,
            result: 'win',
            prizeAmount: playerPrize
          })
        });
        
        // Notify losers
        for (const player of allPlayers) {
          if (player.user_id !== winnerId) {
            await fetch('/api/notify-game-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: player.user_id,
                gameId,
                result: 'loss',
                winnerId
              })
            });
          }
        }
      }
    } catch (notifyError) {
      console.error('Error sending notifications:', notifyError);
      // Don't fail the game end if notifications fail
    }
    
    return { success: true, winnerId, prizePool: playerPrize, commission };
  } catch (error) {
    console.error('Error ending game:', error);
    return { success: false };
  }
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
