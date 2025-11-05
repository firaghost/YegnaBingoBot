-- ============================================
-- FORCE CLEANUP - Remove ALL function versions
-- ============================================

-- Get all function signatures and drop them
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all matching functions
    FOR func_record IN 
        SELECT 
            p.oid,
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('deduct_balance', 'add_to_prize_pool', 'award_prize', 'log_transaction')
    LOOP
        -- Drop each function with its exact signature
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', 
            func_record.proname, 
            func_record.args);
        RAISE NOTICE 'Dropped function: %.%(%)', 'public', func_record.proname, func_record.args;
    END LOOP;
END $$;

-- Verify all are gone
SELECT 
  p.proname as function_name,
  COUNT(*) as remaining_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('deduct_balance', 'add_to_prize_pool', 'award_prize', 'log_transaction')
GROUP BY p.proname;

-- Should return 0 rows if all are deleted

-- Now recreate ONLY the secure versions
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

-- Final verification - should show 4 functions, all secure
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
-- EXPECTED: 4 functions, all with:
-- - is_security_definer: true
-- - config_settings: search_path=public
-- - duplicate_count: 1
-- ============================================
