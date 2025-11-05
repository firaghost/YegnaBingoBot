-- Add countdown fields to games table

-- Add countdown_end column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'countdown_end'
  ) THEN
    ALTER TABLE games ADD COLUMN countdown_end TIMESTAMP;
  END IF;
END $$;

-- Update status check constraint to include 'countdown'
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check 
  CHECK (status IN ('waiting', 'countdown', 'active', 'completed', 'cancelled'));

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'games' 
AND column_name IN ('status', 'countdown_end');

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'games_status_check';
