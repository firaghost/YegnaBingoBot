-- Create function to get game with row-level lock
-- This prevents race conditions when multiple clients try to tick the same game
CREATE OR REPLACE FUNCTION get_game_for_update(game_id UUID)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  status TEXT,
  countdown_time INTEGER,
  players UUID[],
  bots UUID[],
  called_numbers INTEGER[],
  latest_number JSONB,
  stake NUMERIC,
  prize_pool NUMERIC,
  winner_id UUID,
  min_players INTEGER,
  number_sequence INTEGER[],
  number_sequence_hash TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  commission_rate NUMERIC,
  commission_amount NUMERIC,
  net_prize NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.room_id,
    g.status,
    g.countdown_time,
    g.players,
    g.bots,
    g.called_numbers,
    g.latest_number,
    g.stake,
    g.prize_pool,
    g.winner_id,
    g.min_players,
    g.number_sequence,
    g.number_sequence_hash,
    g.started_at,
    g.ended_at,
    g.created_at,
    g.commission_rate,
    g.commission_amount,
    g.net_prize
  FROM games g
  WHERE g.id = game_id
  FOR UPDATE SKIP LOCKED; -- Skip if already locked by another transaction
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_game_for_update(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_game_for_update(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_game_for_update(UUID) TO service_role;
