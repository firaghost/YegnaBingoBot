-- ============================================
-- UPDATE GAMES TABLE FOR MINIMUM PLAYERS
-- Run this in Supabase SQL Editor
-- ============================================

-- Add min_players column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'min_players'
  ) THEN
    ALTER TABLE games ADD COLUMN min_players INTEGER DEFAULT 2;
  END IF;
END $$;

-- Update status check constraint to include 'waiting'
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check 
  CHECK (status IN ('waiting', 'countdown', 'active', 'finished'));

-- Add latest_number column if it doesn't exist (for realtime updates)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'latest_number'
  ) THEN
    ALTER TABLE games ADD COLUMN latest_number JSONB;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_games_status_room ON games(status, room_id);

-- Enable Realtime for games table
ALTER PUBLICATION supabase_realtime ADD TABLE games;

COMMENT ON COLUMN games.min_players IS 'Minimum number of players required to start the game';
COMMENT ON COLUMN games.latest_number IS 'Latest called number in format {letter: "B", number: 5}';
COMMENT ON COLUMN games.status IS 'Game status: waiting (for players), countdown (starting soon), active (in progress), finished (completed)';
