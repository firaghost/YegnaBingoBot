import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId, winnerId } = req.body;

  if (!gameId || !winnerId) {
    return res.status(400).json({ error: 'Game ID and Winner ID required' });
  }

  try {
    // Get game details
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('prize_pool')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;

    const totalPrize = game?.prize_pool || 0;
    const commission = totalPrize * 0.10; // 10% commission
    const winnerPrize = totalPrize - commission;

    console.log(`💰 Prize Distribution:
      Total Prize Pool: ${totalPrize} Birr
      Commission (10%): ${commission} Birr
      Winner Gets: ${winnerPrize} Birr`);

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

    // Award prize to winner (after commission)
    const { data: winner, error: winnerError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', winnerId)
      .single();

    if (winnerError) throw winnerError;

    const newBalance = (winner?.balance || 0) + winnerPrize;

    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', winnerId);

    // Log transaction
    await supabase
      .from('transaction_history')
      .insert({
        user_id: winnerId,
        type: 'game_win',
        amount: winnerPrize,
        description: `Won game ${gameId} - Prize: ${winnerPrize} Birr (after 10% commission)`
      });

    console.log(`🏆 Winner ${winnerId} received ${winnerPrize} Birr (Commission: ${commission} Birr)`);

    return res.status(200).json({
      success: true,
      prizeAmount: winnerPrize,
      commission: commission,
      totalPrize: totalPrize
    });
  } catch (error) {
    console.error('End game API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to end game' });
  }
}
