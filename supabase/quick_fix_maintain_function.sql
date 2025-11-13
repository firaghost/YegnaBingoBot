-- ============================================
-- QUICK FIX FOR MAINTAIN_BOT_PRESENCE FUNCTION
-- ============================================

-- Fix the maintain_bot_presence function to include WHERE clause
CREATE OR REPLACE FUNCTION maintain_bot_presence()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    bot_count INTEGER;
    bot_user_record RECORD;
BEGIN
    -- Ensure each room has at least 2 waiting bots
    FOR room_record IN SELECT id, name, stake FROM rooms WHERE id IS NOT NULL LOOP
        -- Count current waiting bots in this room
        SELECT COUNT(*) INTO bot_count
        FROM games g
        JOIN users u ON g.user_id = u.id
        WHERE g.room_id = room_record.id 
        AND g.status = 'waiting' 
        AND u.is_bot = true;
        
        RAISE NOTICE 'Room %: % bots waiting', room_record.name, bot_count;
        
        -- If less than 2 bots, add more (but only if we have available bots)
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
                
                RAISE NOTICE 'Added bot % to room %', bot_user_record.name, room_record.name;
                bot_count := bot_count + 1;
            ELSE
                RAISE NOTICE 'No more available bots for room %', room_record.name;
                EXIT; -- No more available bots
            END IF;
        END LOOP;
    END LOOP;
    
    -- Update waiting_players counts for all rooms (with WHERE clause)
    UPDATE rooms 
    SET waiting_players = (
        SELECT COUNT(*) 
        FROM games 
        WHERE games.room_id = rooms.id AND games.status = 'waiting'
    )
    WHERE id IS NOT NULL;
    
    RAISE NOTICE 'Bot presence maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'TESTING MAINTAIN FUNCTION:' as test;
SELECT maintain_bot_presence();

-- Show current status
SELECT 'CURRENT ROOM STATUS:' as info;
SELECT 
    name,
    waiting_players,
    stake
FROM rooms 
ORDER BY name;
