-- ============================================
-- FIX ROOMS TABLE FOR BOT SYSTEM
-- ============================================

-- Add missing columns to rooms table for bot system
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS waiting_players INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS prize_pool DECIMAL(10,2) DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_waiting_players ON rooms(waiting_players);
CREATE INDEX IF NOT EXISTS idx_rooms_prize_pool ON rooms(prize_pool);

-- Create function to update room waiting players count
CREATE OR REPLACE FUNCTION update_room_waiting_players()
RETURNS TRIGGER AS $$
BEGIN
    -- Update waiting_players count when games are inserted/updated/deleted
    IF TG_OP = 'INSERT' THEN
        -- Increment waiting players for new game
        UPDATE rooms 
        SET waiting_players = (
            SELECT COUNT(*) 
            FROM games 
            WHERE room_id = NEW.room_id AND status = 'waiting'
        )
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update waiting players for both old and new room (if room changed)
        UPDATE rooms 
        SET waiting_players = (
            SELECT COUNT(*) 
            FROM games 
            WHERE room_id = NEW.room_id AND status = 'waiting'
        )
        WHERE id = NEW.room_id;
        
        IF OLD.room_id != NEW.room_id THEN
            UPDATE rooms 
            SET waiting_players = (
                SELECT COUNT(*) 
                FROM games 
                WHERE room_id = OLD.room_id AND status = 'waiting'
            )
            WHERE id = OLD.room_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement waiting players for deleted game
        UPDATE rooms 
        SET waiting_players = (
            SELECT COUNT(*) 
            FROM games 
            WHERE room_id = OLD.room_id AND status = 'waiting'
        )
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update waiting_players count
DROP TRIGGER IF EXISTS trigger_update_room_waiting_players ON games;
CREATE TRIGGER trigger_update_room_waiting_players
    AFTER INSERT OR UPDATE OR DELETE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_room_waiting_players();

-- Initialize waiting_players count for existing rooms
UPDATE rooms 
SET waiting_players = (
    SELECT COUNT(*) 
    FROM games 
    WHERE games.room_id = rooms.id AND games.status = 'waiting'
);

-- Create function to update prize pool when waiting players change
CREATE OR REPLACE FUNCTION update_room_prize_pool()
RETURNS TRIGGER AS $$
DECLARE
    calculated_pool DECIMAL;
BEGIN
    -- Calculate prize pool directly (90% of total stakes)
    calculated_pool := (NEW.stake * NEW.waiting_players * 0.9);
    
    -- Update the prize pool
    NEW.prize_pool := COALESCE(calculated_pool, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update prize pool
DROP TRIGGER IF EXISTS trigger_update_room_prize_pool ON rooms;
CREATE TRIGGER trigger_update_room_prize_pool
    BEFORE UPDATE OF waiting_players ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_room_prize_pool();

-- Update prize pools for existing rooms (calculate directly)
UPDATE rooms 
SET prize_pool = (stake * waiting_players * 0.9);

-- Success message
SELECT 'ROOMS TABLE UPDATED FOR BOT SYSTEM!' as status;
SELECT 'Added columns: waiting_players, prize_pool' as columns;
SELECT 'Added triggers: auto-update waiting players and prize pools' as triggers;
SELECT 'Added functions: update_room_waiting_players, update_room_prize_pool' as functions;
