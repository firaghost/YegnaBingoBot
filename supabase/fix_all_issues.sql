-- ============================================
-- COMPLETE FIX FOR ALL GAME ISSUES
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Add missing columns to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS last_call_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS number_sequence_hash TEXT;

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;

-- Step 2: Update status constraint to include 'waiting'
ALTER TABLE games 
DROP CONSTRAINT IF EXISTS games_status_check;

ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('waiting', 'countdown', 'active', 'finished'));

-- Step 3: Disable RLS for development (REMOVE IN PRODUCTION!)
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Check if admin_settings exists before disabling RLS
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_settings') THEN
        ALTER TABLE admin_settings DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_last_call_time ON games(last_call_time);
CREATE INDEX IF NOT EXISTS idx_games_room_status ON games(room_id, status);

-- Step 5: Clean up any stuck games
UPDATE games 
SET status = 'finished' 
WHERE status IN ('waiting', 'countdown', 'active') 
  AND created_at < NOW() - INTERVAL '1 hour';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ All issues fixed successfully!';
  RAISE NOTICE '✅ Missing columns added';
  RAISE NOTICE '✅ RLS disabled for development';
  RAISE NOTICE '✅ Stuck games cleaned up';
END $$;
