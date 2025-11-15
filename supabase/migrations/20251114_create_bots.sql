-- Migration: Create bots table and helper functions for bot player subsystem
-- Date: 2025-11-14

-- 1) Types
DO $$ BEGIN
  CREATE TYPE bot_difficulty AS ENUM ('easy','medium','hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bot_waiting_mode AS ENUM ('always_waiting','only_when_assigned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table: bots
CREATE TABLE IF NOT EXISTS bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  avatar text,
  active boolean NOT NULL DEFAULT true,
  difficulty bot_difficulty NOT NULL DEFAULT 'medium',
  behavior_profile jsonb NOT NULL DEFAULT
    '{"mark_delay_ms":[500,2000],"error_rate":0.1,"check_bingo_interval_ms":[300,800],"chat_enabled":false,"chat_messages":[],"aggressiveness":0.5}'::jsonb,
  win_probability double precision NOT NULL DEFAULT 0.5 CHECK (win_probability >= 0.0 AND win_probability <= 1.0),
  waiting_mode bot_waiting_mode NOT NULL DEFAULT 'always_waiting',
  total_games integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  avg_game_duration_seconds double precision,
  last_played_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(active);
CREATE INDEX IF NOT EXISTS idx_bots_difficulty ON bots(difficulty);
CREATE INDEX IF NOT EXISTS idx_bots_waiting_mode ON bots(waiting_mode);

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bots_updated_at ON bots;
CREATE TRIGGER trg_bots_updated_at
BEFORE UPDATE ON bots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5) RLS: conservative defaults (service_role bypasses)
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

-- allow read to authenticated, deny writes (admin uses service key)
DROP POLICY IF EXISTS bots_select ON bots;
CREATE POLICY bots_select ON bots
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS bots_no_write ON bots;
CREATE POLICY bots_no_write ON bots
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 6) Helper function: select an active bot (optionally by difficulty / waiting_mode)
CREATE OR REPLACE FUNCTION select_active_bot(
  p_difficulty bot_difficulty DEFAULT NULL,
  p_waiting_mode bot_waiting_mode DEFAULT NULL
)
RETURNS bots
LANGUAGE plpgsql STABLE AS $$
DECLARE rec bots;
BEGIN
  SELECT * INTO rec
  FROM bots
  WHERE active = true
    AND (p_difficulty IS NULL OR difficulty = p_difficulty)
    AND (p_waiting_mode IS NULL OR waiting_mode = p_waiting_mode)
  ORDER BY random()
  LIMIT 1;
  RETURN rec;
END;$$;

-- 7) Helper function: return a compact JSON for server consumption
CREATE OR REPLACE FUNCTION select_active_bot_json(
  p_difficulty bot_difficulty DEFAULT NULL,
  p_waiting_mode bot_waiting_mode DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE b bots;
BEGIN
  b := select_active_bot(p_difficulty, p_waiting_mode);
  IF b.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'avatar', b.avatar,
    'win_probability', b.win_probability,
    'difficulty', b.difficulty,
    'behavior_profile', b.behavior_profile
  );
END;$$;

-- 8) Stats updater: record result and rolling average
CREATE OR REPLACE FUNCTION record_bot_result(
  p_bot_id uuid,
  p_won boolean,
  p_duration_seconds integer
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE bots AS b SET
    total_games = b.total_games + 1,
    wins = b.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    losses = b.losses + CASE WHEN p_won THEN 0 ELSE 1 END,
    last_played_at = now(),
    avg_game_duration_seconds = CASE
      WHEN b.total_games = 0 OR b.avg_game_duration_seconds IS NULL THEN p_duration_seconds
      ELSE ((b.avg_game_duration_seconds * b.total_games) + p_duration_seconds)::double precision / (b.total_games + 1)
    END
  WHERE b.id = p_bot_id;
END;$$;

-- 9) View: consolidated statistics for admin
CREATE OR REPLACE VIEW bot_statistics AS
SELECT
  b.id,
  b.name,
  b.active,
  b.difficulty,
  b.waiting_mode,
  b.win_probability,
  b.total_games,
  b.wins,
  b.losses,
  CASE WHEN b.total_games > 0 THEN ROUND((b.wins::numeric / b.total_games::numeric) * 100, 2) ELSE 0 END AS win_rate_percent,
  b.avg_game_duration_seconds,
  b.last_played_at,
  b.created_at,
  b.updated_at
FROM bots b;

-- 10) Tie resolution helper: prefer bot with 100% win_probability if among claimers
-- Note: server should still verify each claim is valid; this only provides a tiebreak preference.
CREATE OR REPLACE FUNCTION prefer_bot_in_tie(
  p_game_bots uuid[],
  p_claimant_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE preferred uuid;
BEGIN
  -- Find any claimant that is also a bot with win_probability = 1.0
  SELECT b.id INTO preferred
  FROM unnest(p_claimant_ids) c(id)
  JOIN unnest(p_game_bots) gb(id) ON gb.id = c.id
  JOIN bots b ON b.id = c.id
  WHERE b.win_probability >= 1.0
  LIMIT 1;
  RETURN preferred; -- NULL if none
END;$$;

-- 11) Seed: Ethiopian Telegram-style names (idempotent)
WITH seed(name) AS (
  VALUES
    ('Fira_Ghost'),('AbebeT'),('SelamA'),('Dawit_123'),('Hana_M'),('KassaNet'),('LulitBot'),('TadesseX'),('MeronZ'),
    ('BekeleR'),('Mimi_Ab'),('Alemayehu'),('Getachew99'),('SabaTel'),('NardosChat'),('YohannesTG'),('Tsehayy'),('Birhanu77'),('Eden_S'),('ZinabuBot')
)
INSERT INTO bots (name, difficulty, win_probability, behavior_profile)
SELECT s.name,
       (ARRAY['easy','medium','hard'])[floor(random()*3)+1]::bot_difficulty AS difficulty,
       0.5 AS win_probability,
       jsonb_build_object(
         'mark_delay_ms', jsonb_build_array(600, 1800),
         'error_rate', 0.1,
         'check_bingo_interval_ms', jsonb_build_array(350, 900),
         'chat_enabled', true,
         'chat_messages', jsonb_build_array('Nice!','Close one!','GG'),
         'aggressiveness', 0.6
       )
FROM seed s
ON CONFLICT (name) DO NOTHING;
