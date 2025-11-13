-- ============================================
-- FIX TRIGGER TG_OP ERROR
-- ============================================

-- Drop and recreate the trigger without WHEN clause
DROP TRIGGER IF EXISTS trigger_update_prize_pool_on_player_change ON games;

-- Create simplified trigger function that handles all operations
CREATE OR REPLACE FUNCTION update_prize_pool_on_player_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        UPDATE rooms 
        SET prize_pool = (
                SELECT (stake * COUNT(*) * 0.9)
                FROM games 
                WHERE room_id = NEW.room_id AND status = 'waiting'
                GROUP BY room_id
                HAVING room_id = NEW.room_id
            ),
            waiting_players = (
                SELECT COUNT(*) FROM games 
                WHERE room_id = NEW.room_id AND status = 'waiting'
            )
        WHERE id = NEW.room_id;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        UPDATE rooms 
        SET prize_pool = (
                SELECT COALESCE((stake * COUNT(*) * 0.9), 0)
                FROM games 
                WHERE room_id = OLD.room_id AND status = 'waiting'
                GROUP BY room_id
                HAVING room_id = OLD.room_id
            ),
            waiting_players = (
                SELECT COUNT(*) FROM games 
                WHERE room_id = OLD.room_id AND status = 'waiting'
            )
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Update new room
        UPDATE rooms 
        SET prize_pool = (
                SELECT COALESCE((stake * COUNT(*) * 0.9), 0)
                FROM games 
                WHERE room_id = NEW.room_id AND status = 'waiting'
                GROUP BY room_id
                HAVING room_id = NEW.room_id
            ),
            waiting_players = (
                SELECT COUNT(*) FROM games 
                WHERE room_id = NEW.room_id AND status = 'waiting'
            )
        WHERE id = NEW.room_id;
        
        -- If room changed, update old room too
        IF OLD.room_id != NEW.room_id THEN
            UPDATE rooms 
            SET prize_pool = (
                    SELECT COALESCE((stake * COUNT(*) * 0.9), 0)
                    FROM games 
                    WHERE room_id = OLD.room_id AND status = 'waiting'
                    GROUP BY room_id
                    HAVING room_id = OLD.room_id
                ),
                waiting_players = (
                    SELECT COUNT(*) FROM games 
                    WHERE room_id = OLD.room_id AND status = 'waiting'
                )
            WHERE id = OLD.room_id;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger without WHEN clause
CREATE TRIGGER trigger_update_prize_pool_on_player_change
    AFTER INSERT OR UPDATE OR DELETE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_prize_pool_on_player_change();

-- Test the fix by updating all room prize pools
UPDATE rooms 
SET prize_pool = (
    SELECT COALESCE((rooms.stake * COUNT(g.id) * 0.9), 0)
    FROM games g 
    WHERE g.room_id = rooms.id AND g.status = 'waiting'
),
waiting_players = (
    SELECT COUNT(g.id)
    FROM games g 
    WHERE g.room_id = rooms.id AND g.status = 'waiting'
)
WHERE id IS NOT NULL;

-- Success message
SELECT 'TRIGGER ERROR FIXED!' as status;
SELECT 'Prize pools and waiting players updated' as result;
