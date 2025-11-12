-- ============================================
-- FIX FOREIGN KEY CONSTRAINTS FOR ROOM DELETION
-- This will allow rooms to be deleted with CASCADE behavior
-- ============================================

-- First, let's check the current foreign key constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'games'
  AND ccu.table_name = 'rooms';

-- Drop the existing foreign key constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_room_id_fkey;

-- Recreate the foreign key constraint with CASCADE delete
ALTER TABLE games 
ADD CONSTRAINT games_room_id_fkey 
FOREIGN KEY (room_id) 
REFERENCES rooms(id) 
ON DELETE CASCADE;

-- Also fix any other related tables that might reference rooms

-- Fix room_players table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_players') THEN
    -- Drop existing constraint if any
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_room_id_fkey;
    
    -- Add new constraint with CASCADE
    ALTER TABLE room_players 
    ADD CONSTRAINT room_players_room_id_fkey 
    FOREIGN KEY (room_id) 
    REFERENCES rooms(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Fix game_sessions table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_sessions') THEN
    -- Drop existing constraint if any
    ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_room_id_fkey;
    
    -- Add new constraint with CASCADE
    ALTER TABLE game_sessions 
    ADD CONSTRAINT game_sessions_room_id_fkey 
    FOREIGN KEY (room_id) 
    REFERENCES rooms(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Verify the changes
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'rooms'
ORDER BY tc.table_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ FOREIGN KEY CONSTRAINTS UPDATED!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Updated constraints:';
  RAISE NOTICE '   • games.room_id → rooms.id (CASCADE DELETE)';
  RAISE NOTICE '   • room_players.room_id → rooms.id (CASCADE DELETE)';
  RAISE NOTICE '   • game_sessions.room_id → rooms.id (CASCADE DELETE)';
  RAISE NOTICE '';
  RAISE NOTICE '🗑️  You can now delete rooms directly!';
  RAISE NOTICE '   All associated games and data will be automatically deleted.';
  RAISE NOTICE '';
END $$;
