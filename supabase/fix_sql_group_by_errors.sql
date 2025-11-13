-- ============================================
-- FIX SQL GROUP BY ERRORS IN BOT FUNCTIONS
-- ============================================

-- Fix the trigger function that has GROUP BY issues
CREATE OR REPLACE FUNCTION update_prize_pool_on_player_change()
RETURNS TRIGGER AS $$
DECLARE
    room_stake DECIMAL;
    waiting_count INTEGER;
    calculated_pool DECIMAL;
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Get room stake
        SELECT stake INTO room_stake FROM rooms WHERE id = NEW.room_id;
        
        -- Count waiting players
        SELECT COUNT(*) INTO waiting_count
        FROM games 
        WHERE room_id = NEW.room_id AND status = 'waiting';
        
        -- Calculate prize pool (BEFORE commission - full amount)
        calculated_pool := COALESCE(room_stake * waiting_count, 0);
        
        -- Update room
        UPDATE rooms 
        SET prize_pool = calculated_pool,
            waiting_players = waiting_count
        WHERE id = NEW.room_id;
        
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        -- Get room stake
        SELECT stake INTO room_stake FROM rooms WHERE id = OLD.room_id;
        
        -- Count remaining waiting players
        SELECT COUNT(*) INTO waiting_count
        FROM games 
        WHERE room_id = OLD.room_id AND status = 'waiting';
        
        -- Calculate prize pool (BEFORE commission - full amount)
        calculated_pool := COALESCE(room_stake * waiting_count, 0);
        
        -- Update room
        UPDATE rooms 
        SET prize_pool = calculated_pool,
            waiting_players = waiting_count
        WHERE id = OLD.room_id;
        
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Update new room
        SELECT stake INTO room_stake FROM rooms WHERE id = NEW.room_id;
        
        SELECT COUNT(*) INTO waiting_count
        FROM games 
        WHERE room_id = NEW.room_id AND status = 'waiting';
        
        calculated_pool := COALESCE(room_stake * waiting_count, 0);
        
        UPDATE rooms 
        SET prize_pool = calculated_pool,
            waiting_players = waiting_count
        WHERE id = NEW.room_id;
        
        -- If room changed, update old room too
        IF OLD.room_id != NEW.room_id THEN
            SELECT stake INTO room_stake FROM rooms WHERE id = OLD.room_id;
            
            SELECT COUNT(*) INTO waiting_count
            FROM games 
            WHERE room_id = OLD.room_id AND status = 'waiting';
            
            calculated_pool := COALESCE(room_stake * waiting_count, 0);
            
            UPDATE rooms 
            SET prize_pool = calculated_pool,
                waiting_players = waiting_count
            WHERE id = OLD.room_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Fix the rotate_room_bots function
CREATE OR REPLACE FUNCTION rotate_room_bots(room_id_param TEXT)
RETURNS void AS $$
DECLARE
    config_record RECORD;
    current_bot_count INTEGER;
    target_bot_count INTEGER;
    bots_to_remove INTEGER;
    bots_to_add INTEGER;
    bot_to_remove UUID;
    available_bot RECORD;
    room_stake DECIMAL;
BEGIN
    -- Get room configuration (use default if not exists)
    SELECT * INTO config_record FROM bot_room_config WHERE room_id = room_id_param;
    
    IF config_record IS NULL THEN
        -- Use default config
        config_record.min_bots := 2;
        config_record.max_bots := 4;
        config_record.rotation_interval := 300;
    END IF;
    
    -- Get room stake
    SELECT stake INTO room_stake FROM rooms WHERE id = room_id_param;
    
    -- Count current bots in room
    SELECT COUNT(*) INTO current_bot_count
    FROM games g
    JOIN users u ON g.user_id = u.id
    WHERE g.room_id = room_id_param 
    AND g.status = 'waiting' 
    AND u.is_bot = true;
    
    -- Determine target bot count (random between min and max)
    target_bot_count := config_record.min_bots + 
        FLOOR(RANDOM() * (config_record.max_bots - config_record.min_bots + 1));
    
    RAISE NOTICE 'Room %: Current bots: %, Target: %', room_id_param, current_bot_count, target_bot_count;
    
    -- Remove excess bots
    IF current_bot_count > target_bot_count THEN
        bots_to_remove := current_bot_count - target_bot_count;
        
        FOR i IN 1..bots_to_remove LOOP
            -- Select a random bot to remove
            SELECT g.user_id INTO bot_to_remove
            FROM games g
            JOIN users u ON g.user_id = u.id
            WHERE g.room_id = room_id_param 
            AND g.status = 'waiting' 
            AND u.is_bot = true
            ORDER BY RANDOM()
            LIMIT 1;
            
            IF bot_to_remove IS NOT NULL THEN
                -- Remove bot from room
                DELETE FROM games 
                WHERE room_id = room_id_param 
                AND user_id = bot_to_remove 
                AND status = 'waiting';
                
                RAISE NOTICE 'Removed bot % from room %', bot_to_remove, room_id_param;
            END IF;
        END LOOP;
    END IF;
    
    -- Add new bots if needed
    IF current_bot_count < target_bot_count THEN
        bots_to_add := target_bot_count - current_bot_count;
        
        FOR i IN 1..bots_to_add LOOP
            -- Find an available bot not already in this room
            SELECT u.id as user_id, bp.name, bp.skill_level
            INTO available_bot
            FROM users u
            JOIN bot_players bp ON u.bot_id = bp.id
            WHERE u.is_bot = true 
            AND bp.is_enabled = true
            AND u.id NOT IN (
                SELECT user_id FROM games 
                WHERE room_id = room_id_param AND status = 'waiting'
            )
            ORDER BY RANDOM()
            LIMIT 1;
            
            IF available_bot.user_id IS NOT NULL THEN
                -- Add bot to room
                INSERT INTO games (
                    room_id,
                    user_id,
                    stake,
                    status,
                    game_level
                ) VALUES (
                    room_id_param,
                    available_bot.user_id,
                    room_stake,
                    'waiting',
                    available_bot.skill_level
                );
                
                RAISE NOTICE 'Added bot % to room %', available_bot.name, room_id_param;
            END IF;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fix the maintain_bot_presence function
CREATE OR REPLACE FUNCTION maintain_bot_presence()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    room_stake DECIMAL;
    waiting_count INTEGER;
    calculated_pool DECIMAL;
BEGIN
    -- For each room, ensure proper bot presence
    FOR room_record IN SELECT id, name FROM rooms LOOP
        -- Rotate bots in this room
        PERFORM rotate_room_bots(room_record.id);
        
        -- Update room statistics
        SELECT stake INTO room_stake FROM rooms WHERE id = room_record.id;
        
        SELECT COUNT(*) INTO waiting_count
        FROM games 
        WHERE room_id = room_record.id AND status = 'waiting';
        
        calculated_pool := COALESCE(room_stake * waiting_count, 0);
        
        UPDATE rooms 
        SET prize_pool = calculated_pool,
            waiting_players = waiting_count
        WHERE id = room_record.id;
    END LOOP;
    
    RAISE NOTICE 'Bot presence maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'SQL GROUP BY ERRORS FIXED!' as status;
SELECT 'All bot functions updated with proper SQL syntax' as result;
