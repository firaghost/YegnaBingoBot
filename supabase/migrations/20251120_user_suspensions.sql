-- User suspensions: reason + audit log
-- Date: 2025-11-20

-- 1) Extend users table with suspension fields (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

COMMENT ON COLUMN users.status IS 'Account status: active, inactive (suspended), or other admin-defined states.';
COMMENT ON COLUMN users.suspension_reason IS 'Last known reason why the user was suspended.';
COMMENT ON COLUMN users.suspended_at IS 'Timestamp of the last suspension.';

-- 2) Suspension audit log table
CREATE TABLE IF NOT EXISTS user_suspensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON user_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_created_at ON user_suspensions(created_at DESC);

-- 3) Basic RLS (open for read; admin portal still handles authorization)
ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_suspensions' AND policyname = 'Anyone can read user_suspensions'
  ) THEN
    CREATE POLICY "Anyone can read user_suspensions" ON user_suspensions
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_suspensions' AND policyname = 'Anyone can insert user_suspensions'
  ) THEN
    CREATE POLICY "Anyone can insert user_suspensions" ON user_suspensions
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;
