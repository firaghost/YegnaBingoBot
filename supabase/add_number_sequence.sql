-- Add number_sequence column to games table for tick-based game progression
-- This stores the pre-shuffled number sequence for provably fair gaming

-- Add number_sequence column (stores the shuffled array of numbers)
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS number_sequence integer[] DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN games.number_sequence IS 'Pre-shuffled sequence of numbers (1-75) for provably fair number calling';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Added number_sequence column to games table';
  RAISE NOTICE '📝 This enables tick-based game progression for Vercel compatibility';
  RAISE NOTICE '';
END $$;
