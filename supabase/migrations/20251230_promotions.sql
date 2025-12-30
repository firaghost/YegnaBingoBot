CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,

  promo_type text NOT NULL DEFAULT 'bonus' CHECK (promo_type IN ('bonus','deposit_match','cashback','reload','free_spins')),

  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ETB',
  is_non_withdrawable boolean NOT NULL DEFAULT true,

  wagering_multiplier numeric(10,2) NOT NULL DEFAULT 0,
  min_deposit numeric(18,2) NOT NULL DEFAULT 0,
  min_bet numeric(18,2) NOT NULL DEFAULT 0,

  vip_tier_min integer,
  game_code text,
  spin_count integer,
  spin_value numeric(18,2),

  start_at timestamptz,
  end_at timestamptz,

  image_url text,
  tags text[] NOT NULL DEFAULT '{}'::text[],

  is_enabled boolean NOT NULL DEFAULT true,
  disabled_at timestamptz,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_code_unique
  ON public.promotions (upper(code));

CREATE INDEX IF NOT EXISTS idx_promotions_status_time
  ON public.promotions (is_enabled, start_at, end_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promotions_tags
  ON public.promotions USING gin (tags);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_promotions_updated'
  ) THEN
    CREATE TRIGGER trg_promotions_updated
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
