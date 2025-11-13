-- ============================================
-- CREATE DYNAMIC BOT SYSTEM
-- ============================================

-- 1. Add admin configuration for bot behavior
CREATE TABLE IF NOT EXISTS bot_room_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  min_bots INTEGER DEFAULT 2,
  max_bots INTEGER DEFAULT 4,
  rotation_interval INTEGER DEFAULT 300, -- seconds between bot rotations
  auto_start_on_real_player BOOLEAN DEFAULT true,
  prize_pool_includes_bots BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id)
);

-- 2. Insert default config for all rooms
INSERT INTO bot_room_config (room_id, min_bots, max_bots, rotation_interval)
SELECT id, 2, 4, 300 FROM rooms
ON CONFLICT (room_id) DO NOTHING;

-- 3. Add rotation tracking to bot_game_sessions
ALTER TABLE bot_game_sessions ADD COLUMN IF NOT EXISTS last_rotated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE bot_game_sessions ADD COLUMN IF NOT EXISTS rotation_count INTEGER DEFAULT 0;

-- 4. Create function to rotate bots randomly
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
BEGIN
    -- Get room configuration
    SELECT * INTO config_record FROM bot_room_config WHERE room_id = room_id_param;
    
    IF config_record IS NULL THEN
        RAISE NOTICE 'No bot config found for room %', room_id_param;
        RETURN;
    END IF;
    
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
            SELECT u.id as user_id, bp.name, bp.skill_level, r.stake
            INTO available_bot
            FROM users u
            JOIN bot_players bp ON u.bot_id = bp.id
            JOIN rooms r ON r.id = room_id_param
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
                    available_bot.stake,
                    'waiting',
                    available_bot.skill_level
                );
                
                RAISE NOTICE 'Added bot % to room %', available_bot.name, room_id_param;
            END IF;
        END LOOP;
    END IF;
    
    -- Update rotation tracking
    UPDATE bot_game_sessions 
    SET last_rotated = NOW(), rotation_count = rotation_count + 1
    WHERE bot_id IN (
        SELECT bp.id FROM bot_players bp
        JOIN users u ON bp.id = u.bot_id
        JOIN games g ON u.id = g.user_id
        WHERE g.room_id = room_id_param AND g.status = 'waiting'
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to calculate dynamic prize pool
CREATE OR REPLACE FUNCTION calculate_room_prize_pool(room_id_param TEXT)
RETURNS DECIMAL AS $$
DECLARE
    room_stake DECIMAL;
    total_players INTEGER;
    prize_pool DECIMAL;
BEGIN
    -- Get room stake
    SELECT stake INTO room_stake FROM rooms WHERE id = room_id_param;
    
    -- Count all waiting players (bots + real players)
    SELECT COUNT(*) INTO total_players
    FROM games 
    WHERE room_id = room_id_param AND status = 'waiting';
    
    -- Calculate prize pool (90% of total stakes)
    prize_pool := (room_stake * total_players * 0.9);
    
    RETURN COALESCE(prize_pool, 0);
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to update prize pool when players join/leave
CREATE OR REPLACE FUNCTION update_prize_pool_on_player_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update prize pool for the affected room
    IF TG_OP = 'INSERT' THEN
        UPDATE rooms 
        SET prize_pool = calculate_room_prize_pool(NEW.room_id),
            waiting_players = (
                SELECT COUNT(*) FROM games 
                WHERE room_id = NEW.room_id AND status = 'waiting'
            )
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE rooms 
        SET prize_pool = calculate_room_prize_pool(OLD.room_id),
            waiting_players = (
                SELECT COUNT(*) FROM games 
                WHERE room_id = OLD.room_id AND status = 'waiting'
            )
        WHERE id = OLD.room_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle room changes
        IF OLD.room_id != NEW.room_id THEN
            UPDATE rooms 
            SET prize_pool = calculate_room_prize_pool(OLD.room_id),
                waiting_players = (
                    SELECT COUNT(*) FROM games 
                    WHERE room_id = OLD.room_id AND status = 'waiting'
                )
            WHERE id = OLD.room_id;
        END IF;
        
        UPDATE rooms 
        SET prize_pool = calculate_room_prize_pool(NEW.room_id),
            waiting_players = (
                SELECT COUNT(*) FROM games 
                WHERE room_id = NEW.room_id AND status = 'waiting'
            )
        WHERE id = NEW.room_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Create the trigger (without WHEN clause to avoid TG_OP issue)
DROP TRIGGER IF EXISTS trigger_update_prize_pool_on_player_change ON games;
CREATE TRIGGER trigger_update_prize_pool_on_player_change
    AFTER INSERT OR UPDATE OR DELETE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_prize_pool_on_player_change();

-- 8. Create function to check if real players are in room
CREATE OR REPLACE FUNCTION has_real_players_in_room(room_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    real_player_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO real_player_count
    FROM games g
    JOIN users u ON g.user_id = u.id
    WHERE g.room_id = room_id_param 
    AND g.status = 'waiting' 
    AND (u.is_bot = false OR u.is_bot IS NULL);
    
    RETURN real_player_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 9. Update maintain_bot_presence function for rotation
CREATE OR REPLACE FUNCTION maintain_bot_presence()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    config_record RECORD;
    should_rotate BOOLEAN;
BEGIN
    -- For each room with bot config
    FOR room_record IN 
        SELECT r.id, r.name FROM rooms r
        JOIN bot_room_config brc ON r.id = brc.room_id
    LOOP
        -- Get room config
        SELECT * INTO config_record FROM bot_room_config WHERE room_id = room_record.id;
        
        -- Check if it's time to rotate (every rotation_interval seconds)
        SELECT COALESCE(
            EXTRACT(EPOCH FROM (NOW() - MAX(last_rotated))) > config_record.rotation_interval,
            true
        ) INTO should_rotate
        FROM bot_game_sessions bgs
        JOIN users u ON bgs.user_id = u.id
        JOIN games g ON u.id = g.user_id
        WHERE g.room_id = room_record.id AND g.status = 'waiting';
        
        IF should_rotate THEN
            RAISE NOTICE 'Rotating bots in room %', room_record.name;
            PERFORM rotate_room_bots(room_record.id);
        END IF;
    END LOOP;
    
    -- Update all room prize pools and waiting counts
    UPDATE rooms 
    SET prize_pool = calculate_room_prize_pool(id),
        waiting_players = (
            SELECT COUNT(*) FROM games 
            WHERE room_id = rooms.id AND status = 'waiting'
        )
    WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 10. Initialize the system
SELECT maintain_bot_presence();

-- Success message
SELECT 'DYNAMIC BOT SYSTEM CREATED!' as status;
SELECT 'Features: Random rotation, dynamic prize pools, admin controls' as features;
SELECT 'Bots will rotate every 5 minutes to appear more realistic' as behavior;
