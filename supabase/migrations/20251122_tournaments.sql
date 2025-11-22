-- Tournaments system: core tables and wallet RPC
-- Date: 2025-11-22

-- 1) Helper: set_updated_at trigger function (only create if missing)
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$;
  END IF;
END
$$ LANGUAGE plpgsql;


-- 2) tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('daily','weekly','custom')),
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','paused','ended','cancelled')),
  is_enabled boolean NOT NULL DEFAULT true,

  start_at timestamptz NOT NULL,
  end_at   timestamptz NOT NULL,

  prize_mode text NOT NULL DEFAULT 'fixed' CHECK (prize_mode IN ('fixed','percentage','pool')),
  prize_config jsonb NOT NULL DEFAULT '{}'::jsonb,

  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_time
  ON public.tournaments (is_enabled, status, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_tournaments_type
  ON public.tournaments (type, status);

-- Trigger for updated_at on tournaments
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_tournaments_updated'
  ) THEN
    CREATE TRIGGER trg_tournaments_updated
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$ LANGUAGE plpgsql;


-- 3) tournament_metrics table
CREATE TABLE IF NOT EXISTS public.tournament_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  deposited_total numeric(18,2) NOT NULL DEFAULT 0,
  plays_count     integer       NOT NULL DEFAULT 0,

  last_deposit_at timestamptz,
  last_play_at    timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tournament_metrics_unique UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tmetrics_tournament_deposits
  ON public.tournament_metrics (tournament_id, deposited_total DESC);

CREATE INDEX IF NOT EXISTS idx_tmetrics_tournament_plays
  ON public.tournament_metrics (tournament_id, plays_count DESC);

CREATE INDEX IF NOT EXISTS idx_tmetrics_updated_at
  ON public.tournament_metrics (updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_tmetrics_updated'
  ) THEN
    CREATE TRIGGER trg_tmetrics_updated
    BEFORE UPDATE ON public.tournament_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;


-- 4) tournament_winners table
CREATE TABLE IF NOT EXISTS public.tournament_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  rank   integer NOT NULL,
  metric text    NOT NULL CHECK (metric IN ('deposits','plays')),

  metric_value numeric(18,2) NOT NULL,
  prize_amount numeric(18,2) NOT NULL,

  paid   boolean    NOT NULL DEFAULT false,
  paid_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  meta       jsonb        NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_twinners_unique
  ON public.tournament_winners (tournament_id, metric, rank);

CREATE INDEX IF NOT EXISTS idx_twinners_tournament
  ON public.tournament_winners (tournament_id, created_at DESC);


-- 5) tournament_audit_logs table
CREATE TABLE IF NOT EXISTS public.tournament_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor  uuid NULL, -- admin or system
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taudit_tournament
  ON public.tournament_audit_logs (tournament_id, created_at DESC);


-- 6) Wallet RPC for awarding tournament prizes
-- This function is invoked by lib/server/tournament-service.ts (awardPrize)
-- It is responsible for:
--   - inserting a transaction row (type = 'tournament_prize')
--   - crediting the user's real balance (or equivalent wallet logic)
-- Adjust the internal logic if your schema differs.

CREATE OR REPLACE FUNCTION public.wallet_award_tournament_prize(
  p_user_id uuid,
  p_tournament_id uuid,
  p_metric text,
  p_rank integer,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  -- Basic validation
  IF p_user_id IS NULL OR p_tournament_id IS NULL THEN
    RAISE EXCEPTION 'wallet_award_tournament_prize: user_id and tournament_id are required';
  END IF;

  -- Start transaction block implicitly (Supabase wraps in its own tx)

  -- 1) Insert transaction record
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    metadata
  ) VALUES (
    p_user_id,
    'tournament_prize',
    p_amount,
    'completed',
    jsonb_build_object(
      'tournament_id', p_tournament_id,
      'metric', p_metric,
      'rank', p_rank
    )
  )
  RETURNING id INTO v_tx_id;

  -- 2) Credit real balance directly on users table
  -- If you use a wallet ledger or RPC-based wallet, replace this logic accordingly.
  UPDATE public.users
  SET balance = COALESCE(balance, 0) + p_amount
  WHERE id = p_user_id;

  -- 3) Optionally, you can emit NOTIFY or write to a log table here

  RETURN;
END;
$$;
