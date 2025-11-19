-- IP and Location tracking for users, withdrawals, and transactions

-- Users: registration + last seen
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS registration_ip INET,
  ADD COLUMN IF NOT EXISTS registration_city TEXT,
  ADD COLUMN IF NOT EXISTS registration_region TEXT,
  ADD COLUMN IF NOT EXISTS registration_country TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_ip INET,
  ADD COLUMN IF NOT EXISTS last_seen_city TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_region TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_country TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Transactions: store IP + coarse geolocation
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS ip INET,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Withdrawals: store IP + coarse geolocation
ALTER TABLE IF EXISTS withdrawals
  ADD COLUMN IF NOT EXISTS ip INET,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Event table for analytics
CREATE TABLE IF NOT EXISTS user_location_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  ip INET,
  city TEXT,
  region TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_location_events_user ON user_location_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_location_events_created ON user_location_events(created_at DESC);
