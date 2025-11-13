-- ============================================
-- FIX BOT FUNCTION FOR STRING ROOM IDs
-- ============================================

-- Drop the old function that expects UUID
DROP FUNCTION IF EXISTS get_available_bots_for_room(UUID, TEXT, INTEGER);

-- Create new function that accepts TEXT room IDs
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
    AND (
      bp.preferred_rooms IS NULL 
      OR bp.preferred_rooms = '{}' 
      OR room_id_param = ANY(bp.preferred_rooms)
    )
    -- Check if bot is not already in too many games
    AND (
      SELECT COUNT(*) 
      FROM bot_game_sessions bgs 
      WHERE bgs.bot_id = bp.id AND bgs.status = 'active'
    ) < bp.max_concurrent_games
  ORDER BY 
    -- Prioritize bots with fewer active games
    (SELECT COUNT(*) FROM bot_game_sessions bgs WHERE bgs.bot_id = bp.id AND bgs.status = 'active'),
    RANDOM()
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Test the function with string room ID
SELECT 'TESTING FIXED FUNCTION:' as test_step;
SELECT * FROM get_available_bots_for_room('speed', 'medium', 5);

-- Test with any skill level
SELECT 'TESTING WITH ANY SKILL LEVEL:' as test_step;
SELECT * FROM get_available_bots_for_room('speed', NULL, 5);

-- Show available bots
SELECT 'AVAILABLE BOTS:' as info;
SELECT name, username, is_enabled, auto_join_enabled, skill_level 
FROM bot_players 
WHERE is_enabled = true AND auto_join_enabled = true
ORDER BY name;

-- Success message
SELECT 'BOT FUNCTION FIXED FOR STRING ROOM IDs!' as status;
SELECT 'Bots should now be available for rooms like "speed"' as message;
