-- ============================================
-- DIAGNOSE BOT SYSTEM STATUS
-- ============================================

-- 1. Check if bot_players table exists
SELECT 'CHECKING BOT_PLAYERS TABLE:' as step;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'bot_players'
) as bot_players_table_exists;

-- 2. Count bot players if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bot_players') THEN
        RAISE NOTICE 'Bot players count: %', (SELECT COUNT(*) FROM bot_players);
        RAISE NOTICE 'Enabled bots: %', (SELECT COUNT(*) FROM bot_players WHERE is_enabled = true);
    ELSE
        RAISE NOTICE 'bot_players table does not exist!';
    END IF;
END $$;

-- 3. Check if bot users exist
SELECT 'CHECKING BOT USERS:' as step;
SELECT COUNT(*) as bot_user_count FROM users WHERE is_bot = true;

-- 4. Check waiting games in speed room
SELECT 'CHECKING SPEED ROOM GAMES:' as step;
SELECT 
    g.id,
    g.user_id,
    u.username,
    u.is_bot,
    g.status,
    g.created_at
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' AND g.status = 'waiting'
ORDER BY g.created_at;

-- 5. Check if bot functions exist
SELECT 'CHECKING BOT FUNCTIONS:' as step;
SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'maintain_bot_presence'
) as maintain_bot_presence_exists;

SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'rotate_room_bots'
) as rotate_room_bots_exists;

-- 6. Show room status
SELECT 'ROOM STATUS:' as step;
SELECT 
    id,
    name,
    waiting_players,
    prize_pool,
    stake
FROM rooms 
ORDER BY name;
