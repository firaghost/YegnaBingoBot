-- Link tournament_promos to broadcasts for per-campaign stats
-- Date: 2025-11-22

ALTER TABLE public.tournament_promos
  ADD COLUMN IF NOT EXISTS broadcast_id uuid;

CREATE INDEX IF NOT EXISTS idx_tpromo_broadcast
  ON public.tournament_promos (broadcast_id, status);
