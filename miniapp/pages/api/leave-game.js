import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId, userId } = req.body;

  if (!gameId || !userId) {
    return res.status(400).json({ error: 'Game ID and User ID are required' });
  }

  try {
    // Get game and player info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*, game_players(*)')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;

    const player = game.game_players?.find(p => p.user_id === userId);
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found in game' });
    }

    // If game is waiting, delete the player entry (they can leave without penalty)
    if (game.status === 'waiting') {
      const { error: deleteError } = await supabase
        .from('game_players')
        .delete()
        .eq('id', player.id);

      if (deleteError) throw deleteError;

      console.log(`✅ Player ${userId} left waiting game ${gameId}`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Left game successfully',
        refunded: false
      });
    }

    // If game is active, mark as left (they lose their stake)
    if (game.status === 'active') {
      const { error: updateError } = await supabase
        .from('game_players')
        .update({ 
          has_left: true,
          left_at: new Date().toISOString()
        })
        .eq('id', player.id);

      if (updateError) throw updateError;

      console.log(`⚠️ Player ${userId} left active game ${gameId} - stake forfeited`);

      // Get user info for notification
      const { data: userData } = await supabase
        .from('users')
        .select('username, telegram_id')
        .eq('id', userId)
        .single();

      // Notify admin (optional - you can implement this later)
      // await notifyAdminPlayerLeft(gameId, userData);

      return res.status(200).json({ 
        success: true, 
        message: 'Marked as left - stake forfeited',
        refunded: false
      });
    }

    return res.status(400).json({ error: 'Cannot leave completed game' });

  } catch (error) {
    console.error('Leave game error:', error);
    return res.status(500).json({ error: error.message || 'Failed to leave game' });
  }
}
