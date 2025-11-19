-- ============================================
-- ANTI-ABUSE: OTP + DEVICE + IP RATE LIMITS (FREE)
-- Date: 2025-11-19
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Admin config defaults (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='admin_config') THEN
    CREATE TABLE admin_config (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by UUID
    );
  END IF;
END $$;

INSERT INTO admin_config(config_key, config_value)
VALUES
  ('require_otp_on_withdrawal', 'false'),
  ('ip_withdraw_max_per_min', '5'),
  ('ip_withdraw_window_seconds', '60')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- Tables
-- ============================================

-- OTP tokens storage
CREATE TABLE IF NOT EXISTS otp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_tokens(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_tokens(expires_at);

-- User devices
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen_ip INET,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip INET,
  is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_unique ON user_devices(user_id, device_hash);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);

-- One welcome bonus per device (recording)
CREATE TABLE IF NOT EXISTS device_bonus_claims (
  device_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION can_claim_welcome_bonus(p_user_id UUID, p_device_hash TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_exists BOOLEAN;
BEGIN
  IF p_device_hash IS NULL OR length(p_device_hash) < 16 THEN RETURN FALSE; END IF;
  SELECT EXISTS(SELECT 1 FROM device_bonus_claims WHERE device_hash = p_device_hash) INTO v_exists;
  RETURN NOT COALESCE(v_exists, TRUE);
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_welcome_bonus_claimed(p_user_id UUID, p_device_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_device_hash IS NULL OR length(p_device_hash) < 16 THEN RETURN FALSE; END IF;
  INSERT INTO device_bonus_claims(device_hash, user_id) VALUES (p_device_hash, p_user_id)
  ON CONFLICT (device_hash) DO NOTHING;
  RETURN TRUE;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IP action counters (simple fixed-window rate limit)
CREATE TABLE IF NOT EXISTS ip_action_counters (
  id BIGSERIAL PRIMARY KEY,
  ip INET NOT NULL,
  action_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ip_action_window ON ip_action_counters(ip, action_key, window_start);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ip_action_counters' AND c.conname = 'ip_action_unique_window'
  ) THEN
    ALTER TABLE ip_action_counters
    ADD CONSTRAINT ip_action_unique_window UNIQUE (ip, action_key, window_start);
  END IF;
END $$;

-- ============================================
-- Helper functions
-- ============================================

-- Normalize window start for a given window size
CREATE OR REPLACE FUNCTION _window_start(p_now TIMESTAMPTZ, p_window_seconds INT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN to_timestamp(floor(extract(epoch FROM p_now)::NUMERIC / p_window_seconds) * p_window_seconds);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Register/update device
CREATE OR REPLACE FUNCTION register_device(
  p_user_id UUID,
  p_device_hash TEXT,
  p_ip TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_ip INET;
BEGIN
  IF p_device_hash IS NULL OR length(p_device_hash) < 16 THEN
    RAISE EXCEPTION 'Invalid device hash';
  END IF;

  BEGIN
    v_ip := NULLIF(p_ip, '')::INET;
  EXCEPTION WHEN others THEN
    v_ip := NULL; -- ignore invalid IP formats
  END;

  INSERT INTO user_devices(user_id, device_hash, first_seen_ip, last_ip)
  VALUES (p_user_id, p_device_hash, v_ip, v_ip)
  ON CONFLICT (user_id, device_hash) DO UPDATE
  SET last_seen_at = NOW(),
      last_ip = COALESCE(EXCLUDED.last_ip, user_devices.last_ip);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rate limit per IP for an action (fixed window)
CREATE OR REPLACE FUNCTION record_ip_action(
  p_ip TEXT,
  p_action_key TEXT,
  p_window_seconds INT,
  p_max_count INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_ip INET;
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF p_action_key IS NULL OR p_action_key = '' THEN
    RAISE EXCEPTION 'action_key required';
  END IF;

  BEGIN
    v_ip := NULLIF(p_ip, '')::INET;
  EXCEPTION WHEN others THEN
    v_ip := NULL; -- allow NULL IP
  END;

  v_window := _window_start(NOW(), GREATEST(p_window_seconds, 1));

  LOOP
    BEGIN
      INSERT INTO ip_action_counters(ip, action_key, window_start, count)
      VALUES (v_ip, p_action_key, v_window, 1)
      ON CONFLICT (ip, action_key, window_start) DO UPDATE
      SET count = ip_action_counters.count + 1
      RETURNING count INTO v_count;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- retry
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count <= p_max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate OTP (returns token id + code for server to send via Telegram)
CREATE OR REPLACE FUNCTION generate_otp(
  p_user_id UUID,
  p_purpose TEXT,
  p_ttl_seconds INT DEFAULT 600,
  p_max_attempts INT DEFAULT 5
) RETURNS TABLE(token_id UUID, code TEXT, expires_at TIMESTAMPTZ) AS $$
DECLARE
  v_code_int INT;
  v_code TEXT;
  v_salt TEXT;
  v_hash TEXT;
  v_expires TIMESTAMPTZ;
  v_id UUID;
BEGIN
  -- 6-digit code using cryptographic RNG
  v_code_int := (get_byte(gen_random_bytes(2),0) * 256 + get_byte(gen_random_bytes(2),1)) % 900000 + 100000;
  v_code := lpad(v_code_int::TEXT, 6, '0');
  v_salt := encode(gen_random_bytes(8), 'hex');
  v_hash := encode(digest(v_code || v_salt, 'sha256'), 'hex');
  v_expires := NOW() + make_interval(secs => GREATEST(p_ttl_seconds, 60));

  INSERT INTO otp_tokens(id, user_id, purpose, code_hash, salt, expires_at, max_attempts)
  VALUES (uuid_generate_v4(), p_user_id, p_purpose, v_hash, v_salt, v_expires, p_max_attempts)
  RETURNING id INTO v_id;

  token_id := v_id;
  code := v_code;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify OTP
CREATE OR REPLACE FUNCTION verify_otp(
  p_user_id UUID,
  p_token_id UUID,
  p_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
  v_salt TEXT;
  v_attempts INT;
  v_max INT;
  v_expires TIMESTAMPTZ;
  v_used TIMESTAMPTZ;
BEGIN
  SELECT code_hash, salt, attempts, max_attempts, expires_at, used_at
    INTO v_hash, v_salt, v_attempts, v_max, v_expires, v_used
  FROM otp_tokens
  WHERE id = p_token_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_used IS NOT NULL THEN RETURN FALSE; END IF;
  IF NOW() > v_expires THEN RETURN FALSE; END IF;
  IF v_attempts >= v_max THEN RETURN FALSE; END IF;

  IF encode(digest(p_code || v_salt, 'sha256'), 'hex') = v_hash THEN
    UPDATE otp_tokens SET used_at = NOW() WHERE id = p_token_id;
    RETURN TRUE;
  ELSE
    UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = p_token_id;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if OTP was used recently for a purpose
CREATE OR REPLACE FUNCTION is_otp_fresh(
  p_user_id UUID,
  p_token_id UUID,
  p_purpose TEXT,
  p_max_age_seconds INT DEFAULT 600
) RETURNS BOOLEAN AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT used_at IS NOT NULL AND used_at > NOW() - make_interval(secs => GREATEST(p_max_age_seconds, 60))
    INTO v_ok
  FROM otp_tokens
  WHERE id = p_token_id AND user_id = p_user_id AND purpose = p_purpose;

  RETURN COALESCE(v_ok, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Marker to trust a device (optional)
CREATE OR REPLACE FUNCTION mark_device_trusted(p_user_id UUID, p_device_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_devices SET is_trusted = TRUE, last_seen_at = NOW()
  WHERE user_id = p_user_id AND device_hash = p_device_hash;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Done
-- ============================================
