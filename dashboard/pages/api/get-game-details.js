import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Game ID required' });
  }

  try {
    const { data: game, error } = await supabase
      .from('games')
      .select(`
        *,
        game_players (
          id,
          user_id,
          paid,
          card,
          marked_numbers,
          users (username, telegram_id)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return res.status(200).json({ game });
  } catch (error) {
    console.error('Error fetching game details:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch game details' });
  }
}
