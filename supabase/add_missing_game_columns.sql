-- ============================================
-- Add missing columns to games table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add last_call_time column for tracking when numbers are called
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS last_call_time TIMESTAMP WITH TIME ZONE;

-- Add number_sequence_hash for provably fair gaming
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS number_sequence_hash TEXT;

-- Add min_players column if it doesn't exist
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;

-- Add waiting status to games table
ALTER TABLE games 
DROP CONSTRAINT IF EXISTS games_status_check;

ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('waiting', 'countdown', 'active', 'finished'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_games_last_call_time ON games(last_call_time);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Missing game columns added successfully!';
END $$;
