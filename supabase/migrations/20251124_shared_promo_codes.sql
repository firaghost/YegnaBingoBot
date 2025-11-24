-- Allow shared promo codes (same code string for multiple users)
-- Date: 2025-11-24

-- Drop unique constraint on code so the same code can be issued to multiple users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tournament_promos'::regclass
      AND conname = 'tournament_promos_code_key'
  ) THEN
    ALTER TABLE public.tournament_promos
      DROP CONSTRAINT tournament_promos_code_key;
  END IF;
END $$;

-- Ensure we still have an index on code for lookups
CREATE INDEX IF NOT EXISTS idx_tpromo_code_shared ON public.tournament_promos (code);
