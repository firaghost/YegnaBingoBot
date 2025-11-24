-- Public promo codes that can be posted in Telegram channels
-- Date: 2025-11-24

CREATE TABLE IF NOT EXISTS public.public_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric(18,2) NOT NULL,
  max_uses integer NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_public_promos_code ON public.public_promos (code);

CREATE TABLE IF NOT EXISTS public.public_promo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.public_promos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_id, user_id)
);

-- Redeem a public promo code: first N users win, each user only once
CREATE OR REPLACE FUNCTION public.redeem_public_promo_code(
  p_user_id uuid,
  p_code text
)
RETURNS numeric
LANGUAGE plpgsql
AS $func$
DECLARE
  v_promo public.public_promos%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'PROMO_INVALID';
  END IF;

  SELECT * INTO v_promo
  FROM public.public_promos
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROMO_INVALID';
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RAISE EXCEPTION 'PROMO_EXPIRED';
  END IF;

  IF v_promo.used_count >= v_promo.max_uses THEN
    RAISE EXCEPTION 'PROMO_EXHAUSTED';
  END IF;

  BEGIN
    INSERT INTO public.public_promo_claims (promo_id, user_id)
    VALUES (v_promo.id, p_user_id);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'PROMO_ALREADY_USED';
  END;

  PERFORM public.wallet_credit_promo_balance(
    p_user_id,
    v_promo.amount,
    v_promo.id,
    v_promo.code
  );

  UPDATE public.public_promos
  SET used_count = used_count + 1
  WHERE id = v_promo.id;

  RETURN v_promo.amount;
END;
$func$;

-- Wrapper that tries tournament/generic promos first, then public promos
CREATE OR REPLACE FUNCTION public.redeem_any_promo(
  p_user_id uuid,
  p_code text
)
RETURNS numeric
LANGUAGE plpgsql
AS $func$
DECLARE
  v_amount numeric;
BEGIN
  BEGIN
    v_amount := public.redeem_tournament_promo(p_user_id, p_code);
    RETURN v_amount;
  EXCEPTION
    WHEN others THEN
      -- Fall through and try public promo; if that also fails it will raise
  END;

  v_amount := public.redeem_public_promo_code(p_user_id, p_code);
  RETURN v_amount;
END;
$func$;
