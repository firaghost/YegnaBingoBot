-- TEMPORARY: Disable RLS for testing
-- Run this in Supabase SQL Editor to fix 406 errors

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Add selected_numbers column if not exists
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS selected_numbers jsonb DEFAULT '[]'::jsonb;

-- Verify
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'games', 'game_players', 'payments', 'transaction_history', 'game_history', 'admin_users');
