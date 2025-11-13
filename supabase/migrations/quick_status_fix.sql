-- Quick fix for games status constraint
-- Run this to allow 'waiting_for_players' status

-- Drop existing constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;

-- Add new constraint with waiting_for_players
ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('waiting', 'waiting_for_players', 'countdown', 'active', 'finished', 'cancelled'));

-- Add missing columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS waiting_started_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS countdown_started_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_number_called INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS latest_number JSONB;

-- Show result
SELECT 'Status constraint fixed - waiting_for_players now allowed and number calling columns added' as result;
