-- ============================================
-- COMPLETE BOT SYSTEM FIX
-- ============================================

-- 1. Ensure bot_game_sessions table exists (simplified version)
CREATE TABLE IF NOT EXISTS bot_game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID REFERENCES bot_players(id) ON DELETE CASCADE,
  game_id UUID,
  user_id UUID,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  won BOOLEAN DEFAULT false,
  winnings DECIMAL(10,2) DEFAULT 0
);

-- 2. Enable RLS for bot_game_sessions
ALTER TABLE bot_game_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Create policy for bot_game_sessions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bot_game_sessions' AND policyname = 'Allow all bot_game_sessions') THEN
        CREATE POLICY "Allow all bot_game_sessions" ON bot_game_sessions FOR ALL USING (true);
    END IF;
END $$;

-- 4. Drop old UUID function and create new TEXT function
DROP FUNCTION IF EXISTS get_available_bots_for_room(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_available_bots_for_room(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_available_bots_for_room(
  room_id_param TEXT,
  skill_level_param TEXT DEFAULT NULL,
  limit_param INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  username TEXT,
  win_rate INTEGER,
  personality TEXT,
  skill_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.name,
    bp.username,
    bp.win_rate,
    bp.personality,
    bp.skill_level
  FROM bot_players bp
  WHERE bp.is_enabled = true
    AND bp.auto_join_enabled = true
    AND (skill_level_param IS NULL OR bp.skill_level = skill_level_param)
    -- Simplified: ignore preferred_rooms for now
    -- Check if bot is not already in too many games
    AND (
      SELECT COUNT(*) 
      FROM bot_game_sessions bgs 
      WHERE bgs.bot_id = bp.id AND bgs.status = 'active'
    ) < bp.max_concurrent_games
  ORDER BY RANDOM()
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- 5. Create update_bot_stats function
CREATE OR REPLACE FUNCTION update_bot_stats(
  bot_id_param UUID,
  won_param BOOLEAN,
  winnings_param DECIMAL DEFAULT 0
)
RETURNS void AS $$
BEGIN
  UPDATE bot_players 
  SET 
    games_played = games_played + 1,
    games_won = CASE WHEN won_param THEN games_won + 1 ELSE games_won END,
    total_winnings = total_winnings + COALESCE(winnings_param, 0),
    updated_at = NOW()
  WHERE id = bot_id_param;
END;
$$ LANGUAGE plpgsql;

-- 6. Ensure all bots are enabled
UPDATE bot_players 
SET 
  is_enabled = true,
  auto_join_enabled = true,
  max_concurrent_games = 3
WHERE is_enabled = false OR auto_join_enabled = false OR max_concurrent_games < 1;

-- 7. Test the function
SELECT 'TESTING BOT FUNCTION:' as test;
SELECT COUNT(*) as available_bots FROM get_available_bots_for_room('mega', NULL, 5);

-- 8. Show bot status
SELECT 'BOT STATUS:' as info;
SELECT 
  name,
  is_enabled,
  auto_join_enabled,
  max_concurrent_games,
  skill_level
FROM bot_players 
ORDER BY name;

-- 9. Clear any stuck bot sessions
DELETE FROM bot_game_sessions WHERE status = 'active' AND joined_at < NOW() - INTERVAL '1 hour';

-- Success message
SELECT 'COMPLETE BOT FIX APPLIED!' as status;
SELECT 'All functions updated to use TEXT room IDs' as fix1;
SELECT 'All bots enabled and configured' as fix2;
SELECT 'Old bot sessions cleared' as fix3;
