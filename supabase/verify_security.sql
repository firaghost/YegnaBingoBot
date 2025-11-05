-- ============================================
-- VERIFY SECURITY SETTINGS
-- ============================================

-- Check function settings directly from pg_proc
SELECT 
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proconfig IS NOT NULL THEN 
      array_to_string(p.proconfig, ', ')
    ELSE 
      'No config'
  END as config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('deduct_balance', 'add_to_prize_pool', 'award_prize', 'log_transaction')
ORDER BY p.proname;

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- INTERPRETATION:
-- ============================================
-- 
-- is_security_definer should be TRUE
-- config_settings should show "search_path=public"
-- rls_enabled should be TRUE for all tables
-- Each table should have multiple policies
-- 
-- ============================================
