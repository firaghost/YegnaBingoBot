-- ============================================
-- SUPER ADMIN TABLE (Basic Version)
-- Simple password storage (change via settings page)
-- ============================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS public.super_admin_activity_log CASCADE;
DROP TABLE IF EXISTS public.super_admin_sessions CASCADE;
DROP TABLE IF EXISTS public.super_admins CASCADE;

-- Create super_admins table
CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create super_admin_sessions table
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID REFERENCES public.super_admins(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create super_admin_activity_log table
CREATE TABLE IF NOT EXISTS public.super_admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID REFERENCES public.super_admins(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service role only" ON public.super_admins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON public.super_admin_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON public.super_admin_activity_log FOR ALL USING (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_token ON public.super_admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_expires ON public.super_admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_super_admin_activity_log_admin ON public.super_admin_activity_log(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_activity_log_created ON public.super_admin_activity_log(created_at DESC);

-- Function to create/update super admin
CREATE OR REPLACE FUNCTION public.upsert_super_admin(
  p_username VARCHAR(50),
  p_password TEXT,
  p_email VARCHAR(255) DEFAULT NULL,
  p_full_name VARCHAR(100) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  INSERT INTO public.super_admins (username, password, email, full_name)
  VALUES (p_username, p_password, p_email, p_full_name)
  ON CONFLICT (username) 
  DO UPDATE SET 
    password = EXCLUDED.password,
    email = COALESCE(EXCLUDED.email, super_admins.email),
    full_name = COALESCE(EXCLUDED.full_name, super_admins.full_name),
    updated_at = NOW()
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

-- Function to verify super admin login
CREATE OR REPLACE FUNCTION public.verify_super_admin(
  p_username VARCHAR(50),
  p_password TEXT
)
RETURNS TABLE(
  admin_id UUID,
  username VARCHAR(50),
  email VARCHAR(255),
  full_name VARCHAR(100),
  is_locked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_is_locked BOOLEAN;
BEGIN
  SELECT * INTO v_admin
  FROM public.super_admins
  WHERE super_admins.username = p_username
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  v_is_locked := v_admin.locked_until IS NOT NULL AND v_admin.locked_until > NOW();
  
  IF v_is_locked THEN
    RETURN QUERY SELECT v_admin.id, v_admin.username, v_admin.email, v_admin.full_name, true;
    RETURN;
  END IF;
  
  -- Verify password (plain text comparison)
  IF v_admin.password = p_password THEN
    UPDATE public.super_admins
    SET login_attempts = 0, last_login = NOW(), updated_at = NOW()
    WHERE id = v_admin.id;
    
    RETURN QUERY SELECT v_admin.id, v_admin.username, v_admin.email, v_admin.full_name, false;
  ELSE
    UPDATE public.super_admins
    SET 
      login_attempts = login_attempts + 1,
      locked_until = CASE WHEN login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes' ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_admin.id;
    RETURN;
  END IF;
END;
$$;

-- Function to create session
CREATE OR REPLACE FUNCTION public.create_super_admin_session(
  p_admin_id UUID,
  p_ip_address VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_token TEXT;
BEGIN
  v_session_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  
  INSERT INTO public.super_admin_sessions (super_admin_id, session_token, ip_address, user_agent, expires_at)
  VALUES (p_admin_id, v_session_token, p_ip_address, p_user_agent, NOW() + INTERVAL '2 hours');
  
  RETURN v_session_token;
END;
$$;

-- Function to verify session
CREATE OR REPLACE FUNCTION public.verify_super_admin_session(p_session_token TEXT)
RETURNS TABLE(admin_id UUID, username VARCHAR(50), email VARCHAR(255))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.username, sa.email
  FROM public.super_admin_sessions sas
  JOIN public.super_admins sa ON sas.super_admin_id = sa.id
  WHERE sas.session_token = p_session_token
  AND sas.expires_at > NOW()
  AND sa.is_active = true;
END;
$$;

-- Function to log activity
CREATE OR REPLACE FUNCTION public.log_super_admin_activity(
  p_admin_id UUID,
  p_action VARCHAR(100),
  p_details JSONB DEFAULT NULL,
  p_ip_address VARCHAR(45) DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.super_admin_activity_log (super_admin_id, action, details, ip_address)
  VALUES (p_admin_id, p_action, p_details, p_ip_address);
END;
$$;

-- Function to change password
CREATE OR REPLACE FUNCTION public.change_super_admin_password(
  p_admin_id UUID,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_password TEXT;
BEGIN
  SELECT password INTO v_current_password
  FROM public.super_admins
  WHERE id = p_admin_id;
  
  IF v_current_password != p_old_password THEN
    RETURN false;
  END IF;
  
  UPDATE public.super_admins
  SET password = p_new_password, updated_at = NOW()
  WHERE id = p_admin_id;
  
  PERFORM log_super_admin_activity(p_admin_id, 'password_changed', '{"success": true}'::jsonb);
  
  RETURN true;
END;
$$;

-- Insert default super admin
-- Password starts as plain text, but backend auto-hashes on first login
INSERT INTO public.super_admins (username, password, email, full_name)
VALUES ('superadmin', 'SuperAdmin@2025!', 'admin@yegnabingo.com', 'System Owner')
ON CONFLICT (username) DO NOTHING;

-- Security Note:
-- 1. Password stored as plain text initially (only accessible via service role)
-- 2. On first login, backend automatically hashes it (PBKDF2, 100k iterations)
-- 3. All future logins use the hashed version
-- 4. Change password immediately via /super-settings after first login

-- Verify setup
SELECT id, username, email, full_name, is_active, created_at FROM public.super_admins;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- 
-- Default Super Admin Created:
-- Username: superadmin
-- Password: SuperAdmin@2025!
-- 
-- ⚠️ CHANGE THIS PASSWORD IMMEDIATELY!
-- 
-- Features:
-- ✅ Session management (2-hour expiry)
-- ✅ Login attempt tracking
-- ✅ Account locking (5 failed attempts = 30 min lock)
-- ✅ Activity logging
-- ✅ Password change function
-- ✅ RLS enabled (service role only)
-- ✅ Works without pgcrypto
-- 
-- Note: Passwords stored in plain text (only accessible via service role)
-- Change your password immediately after first login!
-- 
-- ============================================
