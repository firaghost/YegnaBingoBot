-- Complete fix for the waiting system
-- This migration fixes the status constraint and adds missing columns

BEGIN;

-- 1. Fix the status constraint to allow 'waiting_for_players'
DO $$ 
BEGIN
    -- Drop existing status constraints
    BEGIN
        ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
        RAISE NOTICE 'Dropped games_status_check constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'games_status_check constraint not found';
    END;
    
    BEGIN
        ALTER TABLE games DROP CONSTRAINT IF EXISTS status_check;
        RAISE NOTICE 'Dropped status_check constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'status_check constraint not found';
    END;
END $$;

-- Add the new constraint with all required status values
ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('waiting', 'waiting_for_players', 'countdown', 'active', 'finished', 'cancelled'));

RAISE NOTICE 'Added new games_status_check constraint with waiting_for_players';

-- 2. Add missing columns for waiting period tracking
DO $$ 
BEGIN
    -- Add waiting_started_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'waiting_started_at') THEN
        ALTER TABLE games ADD COLUMN waiting_started_at TIMESTAMPTZ;
        RAISE NOTICE 'Added waiting_started_at column';
    ELSE
        RAISE NOTICE 'waiting_started_at column already exists';
    END IF;
    
    -- Add countdown_started_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'countdown_started_at') THEN
        ALTER TABLE games ADD COLUMN countdown_started_at TIMESTAMPTZ;
        RAISE NOTICE 'Added countdown_started_at column';
    ELSE
        RAISE NOTICE 'countdown_started_at column already exists';
    END IF;
END $$;

-- 3. Update any existing games stuck in waiting with 2+ players
UPDATE games 
SET status = 'waiting_for_players',
    countdown_time = 30,
    waiting_started_at = NOW()
WHERE status = 'waiting' 
  AND array_length(players, 1) >= 2
  AND created_at > NOW() - INTERVAL '1 hour';

-- 4. Show current games table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
  AND column_name IN ('status', 'countdown_time', 'waiting_started_at', 'countdown_started_at')
ORDER BY ordinal_position;

-- 5. Show current constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'games'::regclass 
  AND contype = 'c'
  AND conname = 'games_status_check';

COMMIT;

RAISE NOTICE '✅ Complete waiting system fix applied successfully!';
