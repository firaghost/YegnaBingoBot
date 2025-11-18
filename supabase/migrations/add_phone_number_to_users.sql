-- Add phone number column to users table
-- This migration adds phone number support to the users table

-- Add phone column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add index on phone column for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Phone number column added to users table successfully!';
END $$;