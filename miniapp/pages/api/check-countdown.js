import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Store active countdowns and games
const activeCountdowns = new Map();
const activeGames = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'Game ID required' });
  }

  try {
    await checkAndStartCountdown(gameId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Countdown check error:', error);
    return res.status(500).json({ error: 'Failed to check countdown' });
  }
}

async function checkAndStartCountdown(gameId) {
  // Check if countdown already active
  if (activeCountdowns.has(gameId)) {
    console.log(`⏰ Countdown already active for game ${gameId}`);
    return;
  }

  // Get game and player count
  const { data: game, error } = await supabase
    .from('games')
    .select('*, game_players(id)')
    .eq('id', gameId)
    .single();

  if (error) throw error;

  const playerCount = game.game_players?.length || 0;
  console.log(`👥 Game ${gameId} has ${playerCount} players`);

  // Start countdown if 2+ players and game is waiting
  if (playerCount >= 2 && game.status === 'waiting') {
    console.log(`🎮 Starting countdown for game ${gameId} with ${playerCount} players`);
    await startCountdown(gameId);
  }
}

async function startCountdown(gameId) {
  const countdownEnd = new Date(Date.now() + 59000); // 59 seconds

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
  }, 59000);

  activeCountdowns.set(gameId, timeout);
}

async function autoStartGame(gameId) {
  console.log(`🚀 Auto-starting game ${gameId}`);

  // Get game details
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .select('entry_fee, status')
    .eq('id', gameId)
    .single();

  if (gameError || gameData.status !== 'countdown') {
    console.log('Game already started or not in countdown');
    return;
  }

  const entryFee = gameData.entry_fee || 5;

  // Get all players who haven't paid yet
  const { data: players, error: playersError } = await supabase
    .from('game_players')
    .select('*, users(balance)')
    .eq('game_id', gameId)
    .eq('paid', false);

  if (playersError) throw playersError;

  if (!players || players.length === 0) {
    console.log('No players to charge');
    return;
  }

  let totalPrizePool = 0;
  let successfulPlayers = 0;

  // Deduct entry fee from each player
  for (const player of players) {
    const userBalance = player.users?.balance || 0;
    
    if (userBalance < entryFee) {
      console.warn(`Player ${player.user_id} has insufficient balance`);
      await supabase.from('game_players').delete().eq('id', player.id);
      continue;
    }

    // Deduct money
    await supabase
      .from('users')
      .update({ balance: userBalance - entryFee })
      .eq('id', player.user_id);

    // Mark as paid
    await supabase
      .from('game_players')
      .update({ paid: true })
      .eq('id', player.id);

    totalPrizePool += entryFee;
    successfulPlayers++;

    // Log transaction
    await supabase
      .from('transaction_history')
      .insert({
        user_id: player.user_id,
        type: 'game_entry',
        amount: -entryFee,
        description: `Joined game ${gameId} - ${entryFee} Birr entry fee`
      });
  }

  // Update game status
  await supabase
    .from('games')
    .update({
      status: 'active',
      prize_pool: totalPrizePool,
      started_at: new Date().toISOString()
    })
    .eq('id', gameId);

  console.log(`✅ Game ${gameId} auto-started with ${successfulPlayers} players, prize pool: ${totalPrizePool}`);

  // Start auto-calling numbers
  await startAutoNumberCalling(gameId);
}

async function startAutoNumberCalling(gameId) {
  if (activeGames.has(gameId)) {
    console.log(`🎲 Number calling already active for game ${gameId}`);
    return;
  }

  console.log(`🎲 Starting auto number calling for game ${gameId}`);

  const interval = setInterval(async () => {
    try {
      // Get game status
      const { data: game } = await supabase
        .from('games')
        .select('status, called_numbers')
        .eq('id', gameId)
        .single();

      if (!game || game.status !== 'active') {
        console.log(`🛑 Stopping number calling for game ${gameId} - game ended`);
        clearInterval(interval);
        activeGames.delete(gameId);
        return;
      }

      // Generate next number
      const calledNumbers = game.called_numbers || [];
      if (calledNumbers.length >= 75) {
        console.log('All numbers called');
        clearInterval(interval);
        activeGames.delete(gameId);
        return;
      }

      let nextNumber;
      do {
        nextNumber = Math.floor(Math.random() * 75) + 1;
      } while (calledNumbers.includes(nextNumber));

      calledNumbers.push(nextNumber);

      // Update game with new number
      await supabase
        .from('games')
        .update({ called_numbers: calledNumbers })
        .eq('id', gameId);

      console.log(`🎲 Called number ${nextNumber} for game ${gameId} (${calledNumbers.length}/75)`);
    } catch (error) {
      console.error('Error calling number:', error);
    }
  }, 5000); // Call number every 5 seconds

  activeGames.set(gameId, interval);
}
