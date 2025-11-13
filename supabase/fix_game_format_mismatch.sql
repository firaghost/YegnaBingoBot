-- ============================================
-- FIX GAME FORMAT MISMATCH - CONVERT PLAYERS ARRAY TO USER_ID FORMAT
-- ============================================

-- First, let's see what game records exist for your user
SELECT 'CHECKING EXISTING GAMES FOR YOUR USER:' as step;

-- Check games with players array format (old system)
SELECT 
    id,
    room_id,
    status,
    players,
    user_id,
    created_at,
    'players_array_format' as format_type
FROM games 
WHERE players @> '["a54704bc-f33f-4384-b769-7ff28079b2af"]'::jsonb
ORDER BY created_at DESC;

-- Check games with user_id format (new bot system)
SELECT 
    id,
    room_id,
    status,
    players,
    user_id,
    created_at,
    'user_id_format' as format_type
FROM games 
WHERE user_id = 'a54704bc-f33f-4384-b769-7ff28079b2af'
ORDER BY created_at DESC;

-- Now let's convert any old format games to new format
DO $$
DECLARE
    old_game RECORD;
    new_game_id UUID;
BEGIN
    -- Find games in old format for your user
    FOR old_game IN 
        SELECT id, room_id, status, stake, created_at
        FROM games 
        WHERE players @> '["a54704bc-f33f-4384-b769-7ff28079b2af"]'::jsonb
        AND room_id = 'speed'
        AND status IN ('waiting', 'waiting_for_players', 'countdown')
    LOOP
        RAISE NOTICE 'Converting old game % to new format', old_game.id;
        
        -- Create new game record in bot system format
        INSERT INTO games (
            room_id,
            user_id,
            status,
            stake,
            game_level
        ) VALUES (
            old_game.room_id,
            'a54704bc-f33f-4384-b769-7ff28079b2af',
            old_game.status,
            COALESCE(old_game.stake, 5),
            'medium'
        ) RETURNING id INTO new_game_id;
        
        RAISE NOTICE 'Created new game record: %', new_game_id;
        
        -- Delete the old format game
        DELETE FROM games WHERE id = old_game.id;
        
        RAISE NOTICE 'Deleted old game record: %', old_game.id;
    END LOOP;
END $$;

-- Verify the fix worked
SELECT 'AFTER CONVERSION - CHECKING SPEED ROOM:' as step;

SELECT 
    g.id,
    g.room_id,
    g.user_id,
    g.status,
    u.username,
    u.is_bot,
    g.created_at
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting'
ORDER BY u.is_bot, g.created_at;

-- Count players by type
SELECT 
    'PLAYER COUNT SUMMARY:' as info,
    COUNT(*) as total_players,
    COUNT(*) FILTER (WHERE u.is_bot = true) as bot_count,
    COUNT(*) FILTER (WHERE u.is_bot = false OR u.is_bot IS NULL) as real_player_count
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting';

SELECT 'CONVERSION COMPLETE!' as status;
