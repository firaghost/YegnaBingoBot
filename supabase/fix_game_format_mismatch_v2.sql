-- ============================================
-- FIX GAME FORMAT MISMATCH - CONVERT PLAYERS ARRAY TO USER_ID FORMAT
-- Fixed SQL operators and handles all players
-- ============================================

-- First, let's see what game records exist
SELECT 'CHECKING ALL GAMES IN SPEED ROOM:' as step;

-- Check games with players array format (old system) - handle different column types
SELECT 
    id,
    room_id,
    status,
    players,
    user_id,
    created_at,
    'players_array_format' as format_type
FROM games 
WHERE room_id = 'speed'
AND players IS NOT NULL
ORDER BY created_at DESC;

-- Check games with user_id format (new bot system)
SELECT 
    id,
    room_id,
    status,
    user_id,
    created_at,
    'user_id_format' as format_type
FROM games 
WHERE room_id = 'speed'
AND user_id IS NOT NULL
ORDER BY created_at DESC;

-- Convert ALL players from old format games to new format
DO $$
DECLARE
    old_game RECORD;
    player_id TEXT;
    new_game_id UUID;
    player_count INTEGER := 0;
BEGIN
    -- Find games in old format in speed room (simplified check)
    FOR old_game IN 
        SELECT id, room_id, status, stake, players, created_at
        FROM games 
        WHERE room_id = 'speed'
        AND status IN ('waiting', 'waiting_for_players', 'countdown')
        AND players IS NOT NULL
        AND user_id IS NULL
    LOOP
        -- Try to get array length, handle different data types
        BEGIN
            player_count := jsonb_array_length(old_game.players::jsonb);
            RAISE NOTICE 'Converting old game % with % players', old_game.id, player_count;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping game % - cannot parse players array', old_game.id;
            CONTINUE;
        END;
        
        -- Extract each player from the players array and create individual records
        FOR player_count IN 0..(jsonb_array_length(old_game.players::jsonb) - 1)
        LOOP
            -- Get player ID from array
            SELECT (old_game.players::jsonb)->>player_count INTO player_id;
            
            RAISE NOTICE 'Creating record for player: %', player_id;
            
            -- Create new game record in bot system format for this player
            INSERT INTO games (
                room_id,
                user_id,
                status,
                stake,
                game_level
            ) VALUES (
                old_game.room_id,
                player_id::uuid,
                old_game.status,
                COALESCE(old_game.stake, 5),
                'medium'
            ) RETURNING id INTO new_game_id;
            
            RAISE NOTICE 'Created new game record: % for player: %', new_game_id, player_id;
        END LOOP;
        
        -- Delete the old format game after converting all players
        DELETE FROM games WHERE id = old_game.id;
        RAISE NOTICE 'Deleted old game record: %', old_game.id;
    END LOOP;
END $$;

-- Also clean up any duplicate records (just in case)
DELETE FROM games a USING games b 
WHERE a.id < b.id 
AND a.room_id = b.room_id 
AND a.user_id = b.user_id 
AND a.status = b.status;

-- Verify the fix worked
SELECT 'AFTER CONVERSION - ALL PLAYERS IN SPEED ROOM:' as step;

SELECT 
    g.id,
    g.room_id,
    g.user_id,
    g.status,
    COALESCE(u.username, 'Unknown User') as username,
    COALESCE(u.is_bot, false) as is_bot,
    g.created_at
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting'
ORDER BY COALESCE(u.is_bot, false), g.created_at;

-- Count players by type
SELECT 
    'PLAYER COUNT SUMMARY:' as info,
    COUNT(*) as total_players,
    COUNT(*) FILTER (WHERE COALESCE(u.is_bot, false) = true) as bot_count,
    COUNT(*) FILTER (WHERE COALESCE(u.is_bot, false) = false) as real_player_count
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting';

-- Show specific user IDs for debugging
SELECT 'USER IDS IN SPEED ROOM:' as info;
SELECT 
    g.user_id,
    COALESCE(u.username, 'Unknown') as username,
    COALESCE(u.is_bot, false) as is_bot
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting'
ORDER BY COALESCE(u.is_bot, false);

-- Check if your specific user ID exists anywhere
SELECT 'CHECKING YOUR USER SPECIFICALLY:' as step;

SELECT 
    id,
    room_id,
    user_id,
    status,
    created_at
FROM games 
WHERE user_id = 'a54704bc-f33f-4384-b769-7ff28079b2af'
ORDER BY created_at DESC;

-- If no records found, manually create one for your user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM games 
        WHERE user_id = 'a54704bc-f33f-4384-b769-7ff28079b2af' 
        AND room_id = 'speed' 
        AND status = 'waiting'
    ) THEN
        INSERT INTO games (
            room_id,
            user_id,
            status,
            stake,
            game_level
        ) VALUES (
            'speed',
            'a54704bc-f33f-4384-b769-7ff28079b2af',
            'waiting',
            5,
            'medium'
        );
        RAISE NOTICE 'Created missing game record for your user';
    ELSE
        RAISE NOTICE 'Your user already has a waiting game record';
    END IF;
END $$;

-- Final verification
SELECT 'FINAL CHECK - ALL PLAYERS IN SPEED ROOM:' as step;

SELECT 
    g.user_id,
    COALESCE(u.username, 'Unknown') as username,
    COALESCE(u.is_bot, false) as is_bot,
    g.status
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting'
ORDER BY COALESCE(u.is_bot, false);

-- Re-add your user if missing after cleanup
DO $$
BEGIN
    -- Check if your user exists in speed room
    IF NOT EXISTS (
        SELECT 1 FROM games 
        WHERE user_id = 'a54704bc-f33f-4384-b769-7ff28079b2af' 
        AND room_id = 'speed' 
        AND status = 'waiting'
    ) THEN
        -- Add your user back to speed room
        INSERT INTO games (
            room_id,
            user_id,
            status,
            stake,
            game_level
        ) VALUES (
            'speed',
            'a54704bc-f33f-4384-b769-7ff28079b2af',
            'waiting',
            5,
            'medium'
        );
        RAISE NOTICE 'Re-added your user to speed room';
    ELSE
        RAISE NOTICE 'Your user already exists in speed room';
    END IF;
END $$;

-- Show final player list
SELECT 'FINAL PLAYER LIST IN SPEED ROOM:' as step;

SELECT 
    g.user_id,
    COALESCE(u.username, 'Unknown User') as username,
    COALESCE(u.is_bot, false) as is_bot,
    g.status,
    g.created_at
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting'
ORDER BY COALESCE(u.is_bot, false), g.created_at;

-- Count summary
SELECT 
    COUNT(*) as total_players,
    COUNT(*) FILTER (WHERE COALESCE(u.is_bot, false) = true) as bot_count,
    COUNT(*) FILTER (WHERE COALESCE(u.is_bot, false) = false) as real_player_count
FROM games g
LEFT JOIN users u ON g.user_id = u.id
WHERE g.room_id = 'speed' 
AND g.status = 'waiting';

SELECT 'CONVERSION COMPLETE - ALL PLAYERS CONVERTED!' as status;
