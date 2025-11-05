import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status } = req.query;
    
    // Parse status filter
    const statusFilter = status 
      ? status.split(',').map(s => s.trim())
      : ['waiting', 'countdown', 'active'];

    const { data, error } = await supabase
      .from('games')
      .select(`
        *,
        game_players (
          id,
          user_id,
          paid,
          users (username, telegram_id)
        )
      `)
      .in('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return res.status(200).json({ games: data || [] });
  } catch (error) {
    console.error('Error fetching games:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch games' });
  }
}
