-- ============================================
-- CLEANUP DUPLICATE FUNCTIONS
-- Remove all versions and recreate clean
-- ============================================

-- Drop ALL versions of these functions (including duplicates)
-- Specify argument types to handle duplicates
DROP FUNCTION IF EXISTS public.deduct_balance(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.add_to_prize_pool(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.award_prize(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.log_transaction(UUID, TEXT, NUMERIC, TEXT) CASCADE;

-- Also try to drop any other possible signatures
DO $$ 
BEGIN
    -- Try to drop any remaining versions
    EXECUTE 'DROP FUNCTION IF EXISTS public.award_prize() CASCADE';
    EXECUTE 'DROP FUNCTION IF EXISTS public.log_transaction() CASCADE';
EXCEPTION 
    WHEN OTHERS THEN 
        NULL; -- Ignore errors if functions don't exist
END $$;

-- Recreate ONLY the secure versions
CREATE FUNCTION public.deduct_balance(
  user_id_param UUID,
  amount_param NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET balance = balance - amount_param
  WHERE id = user_id_param AND balance >= amount_param;
  
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.add_to_prize_pool(
  game_id_param UUID,
  amount_param NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.games
  SET prize_pool = prize_pool + amount_param
  WHERE id = game_id_param;
END;
$$;

CREATE FUNCTION public.award_prize(
  user_id_param UUID,
  amount_param NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET balance = balance + amount_param
  WHERE id = user_id_param;
END;
$$;

CREATE FUNCTION public.log_transaction(
  user_id_param UUID,
  type_param TEXT,
  amount_param NUMERIC,
  description_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.transaction_history (user_id, type, amount, description)
  VALUES (user_id_param, type_param, amount_param, description_param);
END;
$$;

-- Verify only ONE secure version of each function exists
SELECT 
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  CASE 
    WHEN p.proconfig IS NOT NULL THEN 
      array_to_string(p.proconfig, ', ')
    ELSE 
      'No config'
  END as config_settings,
  COUNT(*) OVER (PARTITION BY p.proname) as duplicate_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('deduct_balance', 'add_to_prize_pool', 'award_prize', 'log_transaction')
ORDER BY p.proname;

-- ============================================
-- EXPECTED RESULT:
-- ============================================
-- 
-- All functions should show:
-- - is_security_definer: true
-- - config_settings: search_path=public
-- - duplicate_count: 1 (only one version)
-- 
-- ✅ All security warnings will be resolved!
-- ============================================
