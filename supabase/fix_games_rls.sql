-- ============================================
-- FIX RLS POLICIES FOR GAMES TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop ALL existing policies on games
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'games') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON games';
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read games (for viewing game state)
CREATE POLICY "Allow read access to games"
ON games FOR SELECT
USING (true);

-- Allow anyone to insert games (for creating new games)
CREATE POLICY "Allow insert for games"
ON games FOR INSERT
WITH CHECK (true);

-- Allow anyone to update games (for game state updates)
CREATE POLICY "Allow update for games"
ON games FOR UPDATE
USING (true)
WITH CHECK (true);

-- Fix player_cards RLS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'player_cards') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON player_cards';
    END LOOP;
END $$;

ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to player_cards"
ON player_cards FOR SELECT
USING (true);

CREATE POLICY "Allow insert for player_cards"
ON player_cards FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update for player_cards"
ON player_cards FOR UPDATE
USING (true)
WITH CHECK (true);

-- Fix transactions RLS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'transactions') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON transactions';
    END LOOP;
END $$;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read transactions"
ON transactions FOR SELECT
USING (true);

CREATE POLICY "Allow insert transactions"
ON transactions FOR INSERT
WITH CHECK (true);

-- Fix rooms RLS (for admin management)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'rooms') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON rooms';
    END LOOP;
END $$;

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read rooms"
ON rooms FOR SELECT
USING (true);

CREATE POLICY "Allow insert rooms"
ON rooms FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update rooms"
ON rooms FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete rooms"
ON rooms FOR DELETE
USING (true);

-- Fix admin_settings RLS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'admin_settings') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON admin_settings';
    END LOOP;
END $$;

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read admin_settings"
ON admin_settings FOR SELECT
USING (true);

CREATE POLICY "Allow update admin_settings"
ON admin_settings FOR UPDATE
USING (true)
WITH CHECK (true);

-- Fix users RLS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read users"
ON users FOR SELECT
USING (true);

CREATE POLICY "Allow insert users"
ON users FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update users"
ON users FOR UPDATE
USING (true)
WITH CHECK (true);
