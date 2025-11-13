-- Fix games status constraint to include 'waiting_for_players'
-- This constraint is preventing the new status from being used

-- First, let's see the current constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'games'::regclass 
AND contype = 'c';

-- Drop the existing status constraint if it exists
DO $$ 
BEGIN
    -- Try to drop the constraint (it might have different names)
    BEGIN
        ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'games_status_check constraint not found or already dropped';
    END;
    
    BEGIN
        ALTER TABLE games DROP CONSTRAINT IF EXISTS status_check;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'status_check constraint not found or already dropped';
    END;
    
    BEGIN
        ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_constraint;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'games_status_constraint constraint not found or already dropped';
    END;
END $$;

-- Add the new constraint with all required status values
ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('waiting', 'waiting_for_players', 'countdown', 'active', 'finished', 'cancelled'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'games'::regclass 
AND contype = 'c'
AND conname = 'games_status_check';

RAISE NOTICE 'Fixed games status constraint to include waiting_for_players';
