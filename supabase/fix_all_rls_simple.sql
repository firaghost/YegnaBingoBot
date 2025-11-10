-- ============================================
-- SIMPLE FIX FOR ALL RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- Disable RLS temporarily to clean up
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings DISABLE ROW LEVEL SECURITY;

-- Drop all policies (brute force)
DROP POLICY IF EXISTS "Allow read access to games" ON games CASCADE;
DROP POLICY IF EXISTS "Allow insert for games" ON games CASCADE;
DROP POLICY IF EXISTS "Allow update for games" ON games CASCADE;
DROP POLICY IF EXISTS "Allow read access to player_cards" ON player_cards CASCADE;
DROP POLICY IF EXISTS "Allow insert for player_cards" ON player_cards CASCADE;
DROP POLICY IF EXISTS "Allow update for player_cards" ON player_cards CASCADE;
DROP POLICY IF EXISTS "Allow read transactions" ON transactions CASCADE;
DROP POLICY IF EXISTS "Allow insert transactions" ON transactions CASCADE;
DROP POLICY IF EXISTS "Allow read rooms" ON rooms CASCADE;
DROP POLICY IF EXISTS "Allow insert rooms" ON rooms CASCADE;
DROP POLICY IF EXISTS "Allow update rooms" ON rooms CASCADE;
DROP POLICY IF EXISTS "Allow delete rooms" ON rooms CASCADE;
DROP POLICY IF EXISTS "Allow read users" ON users CASCADE;
DROP POLICY IF EXISTS "Allow insert users" ON users CASCADE;
DROP POLICY IF EXISTS "Allow update users" ON users CASCADE;
DROP POLICY IF EXISTS "Allow read admin_settings" ON admin_settings CASCADE;
DROP POLICY IF EXISTS "Allow update admin_settings" ON admin_settings CASCADE;

-- Re-enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Create new policies for games
CREATE POLICY "games_select_policy" ON games FOR SELECT USING (true);
CREATE POLICY "games_insert_policy" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "games_update_policy" ON games FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "games_delete_policy" ON games FOR DELETE USING (true);

-- Create new policies for player_cards
CREATE POLICY "player_cards_select_policy" ON player_cards FOR SELECT USING (true);
CREATE POLICY "player_cards_insert_policy" ON player_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "player_cards_update_policy" ON player_cards FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "player_cards_delete_policy" ON player_cards FOR DELETE USING (true);

-- Create new policies for transactions
CREATE POLICY "transactions_select_policy" ON transactions FOR SELECT USING (true);
CREATE POLICY "transactions_insert_policy" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "transactions_update_policy" ON transactions FOR UPDATE USING (true) WITH CHECK (true);

-- Create new policies for rooms
CREATE POLICY "rooms_select_policy" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert_policy" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update_policy" ON rooms FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "rooms_delete_policy" ON rooms FOR DELETE USING (true);

-- Create new policies for users
CREATE POLICY "users_select_policy" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_policy" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_policy" ON users FOR UPDATE USING (true) WITH CHECK (true);

-- Create new policies for admin_settings
CREATE POLICY "admin_settings_select_policy" ON admin_settings FOR SELECT USING (true);
CREATE POLICY "admin_settings_update_policy" ON admin_settings FOR UPDATE USING (true) WITH CHECK (true);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All RLS policies have been reset successfully!';
END $$;
