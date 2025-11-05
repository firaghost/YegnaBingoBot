-- Add countdown_end and last_number fields to games table

-- Add new columns
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS countdown_end TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_number INTEGER;

-- Create index for faster countdown queries
CREATE INDEX IF NOT EXISTS idx_games_countdown ON games(countdown_end) WHERE countdown_end IS NOT NULL;

-- Verify changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'games'
AND column_name IN ('countdown_end', 'last_number')
ORDER BY ordinal_position;

-- Note: We don't need to add 'countdown' to the status enum
-- The countdown will be tracked by the countdown_end timestamp
-- Status will remain 'waiting' during countdown, then change to 'active' when game starts
