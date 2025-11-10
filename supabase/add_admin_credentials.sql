-- ============================================
-- ADD USERNAME/PASSWORD TO ADMIN_USERS TABLE
-- ============================================

-- Add email and password_hash columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'email'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN password_hash TEXT;
  END IF;
END $$;

-- Make telegram_id nullable (for password-based admins)
ALTER TABLE admin_users ALTER COLUMN telegram_id DROP NOT NULL;

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Insert default admin user with username/password
-- Password: admin123 (you should change this after first login)
INSERT INTO admin_users (telegram_id, username, email, password_hash, role, permissions)
VALUES (
  NULL,
  'admin',
  'admin@bingo.com',
  'admin123', -- In production, this should be hashed (bcrypt)
  'super_admin',
  '{"all": true}'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Admin credentials added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Email: admin@bingo.com';
  RAISE NOTICE '🔑 Username: admin';
  RAISE NOTICE '🔒 Password: admin123';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Change the default password after first login!';
  RAISE NOTICE '';
END $$;
