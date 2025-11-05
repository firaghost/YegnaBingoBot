-- ============================================
-- FIX ADMIN_USERS RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Service role only" ON public.admin_users;
DROP POLICY IF EXISTS "Service role full access" ON public.admin_users;
DROP POLICY IF EXISTS "Allow public read" ON public.admin_users;
DROP POLICY IF EXISTS "Allow public access" ON public.admin_users;

-- Create proper RLS policy for admin_users
-- Only service role can access (backend API only)
CREATE POLICY "Service role full access" ON public.admin_users
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Verify RLS is enabled
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'admin_users';
