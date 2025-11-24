-- Per-room stake source configuration (real vs bonus)
-- Date: 2025-11-24

-- Add a stake_source column to rooms so we can configure whether a room
-- uses real-balance stakes or bonus-balance stakes.
-- Allowed values for now: 'real' | 'bonus'.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS stake_source TEXT DEFAULT 'real';

DO $$
BEGIN
  BEGIN
    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_stake_source_check;
  EXCEPTION WHEN undefined_table THEN
    RETURN;
  END;
END $$;

ALTER TABLE rooms
  ADD CONSTRAINT rooms_stake_source_check
  CHECK (stake_source IN ('real', 'bonus'));
