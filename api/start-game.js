import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }

  try {
    // Get game details first to get the entry fee
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('entry_fee, status')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;
    
    if (gameData.status !== 'waiting') {
      return res.status(400).json({ error: 'Game already started or completed' });
    }

    const entryFee = gameData.entry_fee || 5;
    console.log(`💰 Starting game ${gameId} with entry fee: ${entryFee} Birr`);

    // Get all players who haven't paid yet
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('*, users(balance)')
      .eq('game_id', gameId)
      .eq('paid', false);

    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      return res.status(400).json({ error: 'No players in game' });
    }

    let totalPrizePool = 0;
    let successfulPlayers = 0;

    // Deduct entry fee from each player
    for (const player of players) {
      const userBalance = player.users?.balance || 0;
      
      console.log(`Checking player ${player.user_id}: Balance ${userBalance}, Entry Fee ${entryFee}`);
      
      if (userBalance < entryFee) {
        console.warn(`Player ${player.user_id} has insufficient balance (${userBalance} < ${entryFee})`);
        // Remove player from game
        await supabase
          .from('game_players')
          .delete()
          .eq('id', player.id);
        continue;
      }

      // Deduct money from user
      const { error: balanceError } = await supabase
        .from('users')
        .update({ balance: userBalance - entryFee })
        .eq('id', player.user_id);

      if (balanceError) {
        console.error(`Failed to deduct from player ${player.user_id}:`, balanceError);
        continue;
      }

      // Mark player as paid
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

      console.log(`✅ Charged player ${player.user_id}: ${entryFee} Birr`);
    }

    console.log(`💰 Total Prize Pool: ${totalPrizePool} Birr from ${successfulPlayers} players`);

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
    
    console.log(`🎮 Game ${gameId} started successfully!`);
    
    return res.status(200).json({
      success: true,
      game: data,
      playersCharged: successfulPlayers,
      prizePool: totalPrizePool
    });
  } catch (error) {
    console.error('Start game API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start game' });
  }
}
