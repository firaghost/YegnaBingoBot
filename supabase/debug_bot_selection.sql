-- ============================================
-- DEBUG BOT SELECTION ISSUES
-- ============================================

-- 1. Check if bots exist and their configuration
SELECT 'CHECKING BOT CONFIGURATION:' as debug_step;
SELECT 
    name,
    username,
    is_enabled,
    auto_join_enabled,
    skill_level,
    max_concurrent_games,
    preferred_rooms
FROM bot_players 
ORDER BY name;

-- 2. Check if the function exists
SELECT 'CHECKING FUNCTION EXISTENCE:' as debug_step;
SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.proname = 'get_available_bots_for_room'
) as function_exists;

-- 3. Test the function with speed room
SELECT 'TESTING FUNCTION WITH SPEED ROOM:' as debug_step;
SELECT * FROM get_available_bots_for_room('speed'::UUID, 'medium', 5);

-- 4. Test the function with NULL room (should work for any room)
SELECT 'TESTING FUNCTION WITH NULL ROOM:' as debug_step;
SELECT * FROM get_available_bots_for_room(gen_random_uuid(), NULL, 5);

-- 5. Check bot_game_sessions table (might be blocking bots)
SELECT 'CHECKING ACTIVE BOT SESSIONS:' as debug_step;
SELECT 
    bp.name,
    bgs.status,
    bgs.joined_at
FROM bot_players bp
LEFT JOIN bot_game_sessions bgs ON bp.id = bgs.bot_id AND bgs.status = 'active'
ORDER BY bp.name;

-- 6. Simple bot availability check
SELECT 'SIMPLE BOT AVAILABILITY CHECK:' as debug_step;
SELECT 
    name,
    username,
    CASE 
        WHEN is_enabled = false THEN 'Bot disabled'
        WHEN auto_join_enabled = false THEN 'Auto-join disabled'
        ELSE 'Available'
    END as availability_status
FROM bot_players
ORDER BY name;
