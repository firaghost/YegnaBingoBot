-- Generic (non-tournament) promos support
-- Date: 2025-11-24

ALTER TABLE public.tournament_promos
  ADD COLUMN IF NOT EXISTS promo_type text NOT NULL DEFAULT 'tournament'
    CHECK (promo_type IN ('tournament', 'generic'));

ALTER TABLE public.tournament_promos
  ALTER COLUMN tournament_id DROP NOT NULL;

-- Simple wallet helper to credit real balance for generic promo gifts
CREATE OR REPLACE FUNCTION public.wallet_credit_promo_balance(
  p_user_id uuid,
  p_amount numeric,
  p_promo_id uuid,
  p_code text
)
RETURNS void
LANGUAGE plpgsql
AS $func$
DECLARE
  v_tx_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'wallet_credit_promo_balance: user_id is required';
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    metadata
  ) VALUES (
    p_user_id,
    'bonus',
    p_amount,
    'completed',
    jsonb_build_object(
      'promo_id', p_promo_id,
      'code', p_code
    )
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.users
  SET balance = COALESCE(balance, 0) + p_amount
  WHERE id = p_user_id;

  RETURN;
END;
$func$;

-- Extend redeem_tournament_promo to also support generic promos
CREATE OR REPLACE FUNCTION public.redeem_tournament_promo(
  p_user_id uuid,
  p_code text
)
RETURNS numeric
LANGUAGE plpgsql
AS $func$
DECLARE
  v_promo public.tournament_promos%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'PROMO_INVALID';
  END IF;

  SELECT * INTO v_promo
  FROM public.tournament_promos
  WHERE code = upper(trim(p_code))
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROMO_INVALID';
  END IF;

  IF v_promo.status <> 'unused' THEN
    RAISE EXCEPTION 'PROMO_ALREADY_USED';
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RAISE EXCEPTION 'PROMO_EXPIRED';
  END IF;

  IF v_promo.promo_type = 'generic' THEN
    PERFORM public.wallet_credit_promo_balance(
      v_promo.user_id,
      v_promo.amount,
      v_promo.id,
      v_promo.code
    );
  ELSE
    PERFORM public.wallet_award_tournament_prize(
      v_promo.user_id,
      v_promo.tournament_id,
      v_promo.metric,
      v_promo.rank,
      v_promo.amount
    );
  END IF;

  UPDATE public.tournament_promos
  SET status = 'used', used_at = now()
  WHERE id = v_promo.id;

  RETURN v_promo.amount;
END;
$func$;
