-- ============================================
-- FIX FUNCTIONS ONLY (RLS already enabled)
-- Run this if you already ran enable_rls_security.sql
-- ============================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.deduct_balance(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.add_to_prize_pool(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.award_prize(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.log_transaction(UUID, TEXT, NUMERIC, TEXT);

-- Recreate with secure search_path
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

-- Verify functions are now secure
SELECT 
  routine_name,
  security_type,
  routine_definition LIKE '%SET search_path%' as has_secure_search_path
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('deduct_balance', 'add_to_prize_pool', 'award_prize', 'log_transaction');

-- ✅ Functions are now secure!
