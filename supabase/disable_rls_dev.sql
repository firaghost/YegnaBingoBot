-- ============================================
-- DISABLE RLS FOR DEVELOPMENT
-- Run this in Supabase SQL Editor
-- WARNING: Only use in development!
-- ============================================

-- Simply disable RLS on all tables
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings DISABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS disabled on all tables for development';
END $$;
