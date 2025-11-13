-- ============================================
-- CREATE PERMANENT WAITING BOTS SYSTEM
-- ============================================

-- 1. First ensure we have the required tables and columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_level TEXT DEFAULT 'medium';
ALTER TABLE games ADD COLUMN IF NOT EXISTS stake DECIMAL(10,2) DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_id TEXT;

-- 2. Create or update bot users for each bot
DO $$
DECLARE
    bot_record RECORD;
    bot_user_id UUID;
BEGIN
    FOR bot_record IN SELECT * FROM bot_players WHERE is_enabled = true LOOP
        -- Check if bot user already exists
        SELECT id INTO bot_user_id 
        FROM users 
        WHERE bot_id = bot_record.id;
        
        IF bot_user_id IS NULL THEN
            -- Create bot user
            INSERT INTO users (
                username,
                telegram_id,
                balance,
                is_bot,
                bot_id
            ) VALUES (
                bot_record.username,
                'bot_' || bot_record.id || '_' || EXTRACT(epoch FROM NOW())::bigint,
                1000000,
                true,
                bot_record.id
            ) RETURNING id INTO bot_user_id;
            
            RAISE NOTICE 'Created user for bot: %', bot_record.name;
        END IF;
    END LOOP;
END $$;

-- 3. Create permanent waiting games for bots in each room
DO $$
DECLARE
    room_record RECORD;
    bot_user_record RECORD;
    existing_game_id UUID;
BEGIN
    -- For each room, add 2-3 bots permanently waiting
    FOR room_record IN SELECT id, name, stake FROM rooms LOOP
        RAISE NOTICE 'Setting up bots for room: %', room_record.name;
        
        -- Add 2-3 bots to each room
        FOR bot_user_record IN 
            SELECT u.id as user_id, bp.name, bp.skill_level
            FROM users u
            JOIN bot_players bp ON u.bot_id = bp.id
            WHERE u.is_bot = true AND bp.is_enabled = true
            LIMIT 3
        LOOP
            -- Check if bot already has a waiting game in this room
            SELECT id INTO existing_game_id
            FROM games 
            WHERE user_id = bot_user_record.user_id 
            AND room_id = room_record.id 
            AND status = 'waiting';
            
            IF existing_game_id IS NULL THEN
                -- Create permanent waiting game for this bot
                INSERT INTO games (
                    room_id,
                    user_id,
                    stake,
                    status,
                    game_level
                ) VALUES (
                    room_record.id,
                    bot_user_record.user_id,
                    room_record.stake,
                    'waiting',
                    bot_user_record.skill_level
                );
                
                RAISE NOTICE 'Added bot % to room %', bot_user_record.name, room_record.name;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 4. Update room waiting_players count
UPDATE rooms 
SET waiting_players = (
    SELECT COUNT(*) 
    FROM games 
    WHERE games.room_id = rooms.id AND games.status = 'waiting'
)
WHERE id IS NOT NULL;

-- 5. Create function to maintain permanent bot presence
CREATE OR REPLACE FUNCTION maintain_bot_presence()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    bot_count INTEGER;
    bot_user_record RECORD;
BEGIN
    -- Ensure each room has at least 2 waiting bots
    FOR room_record IN SELECT id, name, stake FROM rooms LOOP
        -- Count current waiting bots in this room
        SELECT COUNT(*) INTO bot_count
        FROM games g
        JOIN users u ON g.user_id = u.id
        WHERE g.room_id = room_record.id 
        AND g.status = 'waiting' 
        AND u.is_bot = true;
        
        -- If less than 2 bots, add more
        WHILE bot_count < 2 LOOP
            -- Find an available bot not in this room
            SELECT u.id as user_id, bp.name, bp.skill_level
            INTO bot_user_record
            FROM users u
            JOIN bot_players bp ON u.bot_id = bp.id
            WHERE u.is_bot = true 
            AND bp.is_enabled = true
            AND u.id NOT IN (
                SELECT user_id FROM games 
                WHERE room_id = room_record.id AND status = 'waiting'
            )
            LIMIT 1;
            
            IF bot_user_record.user_id IS NOT NULL THEN
                INSERT INTO games (
                    room_id,
                    user_id,
                    stake,
                    status,
                    game_level
                ) VALUES (
                    room_record.id,
                    bot_user_record.user_id,
                    room_record.stake,
                    'waiting',
                    bot_user_record.skill_level
                );
                
                bot_count := bot_count + 1;
            ELSE
                EXIT; -- No more available bots
            END IF;
        END LOOP;
    END LOOP;
    
    -- Update waiting_players counts for all rooms
    UPDATE rooms 
    SET waiting_players = (
        SELECT COUNT(*) 
        FROM games 
        WHERE games.room_id = rooms.id AND games.status = 'waiting'
    )
    WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Run the maintenance function
SELECT maintain_bot_presence();

-- 7. Show results
SELECT 'PERMANENT WAITING BOTS CREATED!' as status;

SELECT 
    r.name as room_name,
    r.waiting_players,
    COUNT(g.id) as actual_waiting_games
FROM rooms r
LEFT JOIN games g ON r.id = g.room_id AND g.status = 'waiting'
GROUP BY r.id, r.name, r.waiting_players
ORDER BY r.name;

SELECT 'Bot users in waiting games:' as info;
SELECT 
    r.name as room_name,
    bp.name as bot_name,
    g.status
FROM games g
JOIN rooms r ON g.room_id = r.id
JOIN users u ON g.user_id = u.id
JOIN bot_players bp ON u.bot_id = bp.id
WHERE u.is_bot = true
ORDER BY r.name, bp.name;
