-- Tournament promo codes for random extra prizes
-- Date: 2025-11-22

CREATE TABLE IF NOT EXISTS public.tournament_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  amount numeric(18,2) NOT NULL,
  metric text NOT NULL CHECK (metric IN ('deposits','plays')),
  rank integer NOT NULL,
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','used','expired')),
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tpromo_tournament
  ON public.tournament_promos (tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tpromo_user
  ON public.tournament_promos (user_id, status);

CREATE INDEX IF NOT EXISTS idx_tpromo_code
  ON public.tournament_promos (code);

-- Redeem function: validates code, marks used, and credits wallet via wallet_award_tournament_prize
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
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROMO_INVALID';
  END IF;

  IF v_promo.user_id <> p_user_id THEN
    RAISE EXCEPTION 'PROMO_WRONG_USER';
  END IF;

  IF v_promo.status <> 'unused' THEN
    RAISE EXCEPTION 'PROMO_ALREADY_USED';
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RAISE EXCEPTION 'PROMO_EXPIRED';
  END IF;

  PERFORM public.wallet_award_tournament_prize(
    v_promo.user_id,
    v_promo.tournament_id,
    v_promo.metric,
    v_promo.rank,
    v_promo.amount
  );

  UPDATE public.tournament_promos
  SET status = 'used', used_at = now()
  WHERE id = v_promo.id;

  RETURN v_promo.amount;
END;
$func$;
