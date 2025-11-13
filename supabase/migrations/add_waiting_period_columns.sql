-- Add columns for waiting period and countdown management
-- This ensures the database has all necessary columns for the new timing system

-- Add waiting_started_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'waiting_started_at') THEN
        ALTER TABLE games ADD COLUMN waiting_started_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add countdown_started_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'countdown_started_at') THEN
        ALTER TABLE games ADD COLUMN countdown_started_at TIMESTAMPTZ;
    END IF;
END $$;

-- Update the games table to include the new waiting_for_players status in any constraints
-- (This is just a safety check - most databases don't enforce enum constraints on text fields)

-- Show current games table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
ORDER BY ordinal_position;

RAISE NOTICE 'Added waiting period columns to games table';
