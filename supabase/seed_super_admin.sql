-- Seed Super Admin Account
-- This script creates a super admin account for the YegnaBingo system
-- Run this in your Supabase SQL editor

-- Step 1: Drop existing table if it has wrong structure
DROP TABLE IF EXISTS super_admins CASCADE;

-- Step 2: Create super_admins table with correct structure
CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  -- Store hashed password here
  full_name TEXT,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Step 3: Create indexes for faster lookups
CREATE INDEX idx_super_admins_username ON super_admins(username);
CREATE INDEX idx_super_admins_email ON super_admins(email);

-- Step 4: Enable Row Level Security
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Step 5: Create policies
CREATE POLICY "Allow public read for authentication" ON super_admins
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access" ON super_admins
  FOR ALL
  TO service_role
  USING (true);

-- Step 6: Create sessions and activity log tables
CREATE TABLE IF NOT EXISTS super_admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID REFERENCES super_admins(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS super_admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID REFERENCES super_admins(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Insert super admin account
-- Username: superadmin
-- Password: SuperAdmin2025! (plain text, will be hashed on first login)
INSERT INTO super_admins (username, email, password, full_name, is_active)
VALUES (
  'superadmin',
  'superadmin@yegnabingo.com',
  'SuperAdmin2025!',
  'Super Administrator',
  true
)
ON CONFLICT (username) 
DO UPDATE SET 
  password = EXCLUDED.password,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active,
  login_attempts = 0,
  locked_until = NULL;

-- Step 8: Display success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Super Admin account created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Username: superadmin';
  RAISE NOTICE 'Email: superadmin@yegnabingo.com';
  RAISE NOTICE 'Password: SuperAdmin2025!';
  RAISE NOTICE 'Login URL: /super-login';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Change the password immediately after first login!';
  RAISE NOTICE '========================================';
END $$;
