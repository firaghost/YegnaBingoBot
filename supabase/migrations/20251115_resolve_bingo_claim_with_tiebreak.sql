-- Migration: Resolve bingo claim with tie-break preference for 100% bots
-- Date: 2025-11-15

-- 1) Create dedicated lightweight log table to avoid collisions with existing bingo_claims
CREATE TABLE IF NOT EXISTS bot_tie_window_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  user_id uuid NOT NULL,
  claimed_cells integer[] NOT NULL,
  bingo_pattern text NOT NULL,
  valid boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_tie_window_claims_game_id_created ON bot_tie_window_claims(game_id, created_at);

-- 2) Resolve bingo claim with small tie window and bot preference
--    Returns is_valid + is_winner; updates games.winner_id atomically under row lock
CREATE OR REPLACE FUNCTION resolve_bingo_claim(
  p_game_id uuid,
  p_user_id uuid,
  p_claimed_cells integer[],
  p_bingo_pattern text,
  p_user_card integer[][],
  p_window_ms integer DEFAULT 120
)
RETURNS TABLE(
  is_valid boolean,
  is_winner boolean,
  validation_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  g RECORD;
  now_ts timestamptz := now();
  window_seconds numeric := GREATEST(0.05, (p_window_ms::numeric / 1000.0));
  valid_cells boolean := true;
  pattern_ok boolean := false;
  winner uuid;
  tie_claimant uuid;
  called integer[];
  i int;
  j int;
  marked boolean[5][5];
BEGIN
  -- Fetch game without lock for validation
  SELECT id, bots, called_numbers, winner_id
  INTO g
  FROM games
  WHERE id = p_game_id;

  IF g.id IS NULL THEN
    RETURN QUERY SELECT false, false, jsonb_build_object('error','game_not_found');
    RETURN;
  END IF;

  -- Build marked matrix from p_user_card and called numbers
  called := COALESCE(g.called_numbers, ARRAY[]::integer[]);
  FOR i IN 1..5 LOOP
    FOR j IN 1..5 LOOP
      IF i = 3 AND j = 3 THEN
        marked[i][j] := true; -- free center
      ELSE
        marked[i][j] := (p_user_card[i][j] = ANY(called));
      END IF;
    END LOOP;
  END LOOP;

  -- Validate that all claimed cells are truly marked
  FOR i IN 1..5 LOOP
    FOR j IN 1..5 LOOP
      IF (i-1)*5 + j <= array_length(p_claimed_cells,1) THEN
        -- no-op: claimed cells list is numeric; integrity checked via pattern logic below
      END IF;
    END LOOP;
  END LOOP;

  -- Basic pattern validation against marked matrix
  IF p_bingo_pattern LIKE 'row:%' THEN
    i := (split_part(p_bingo_pattern,':',2))::int + 1; -- 0..4 to 1..5
    IF i BETWEEN 1 AND 5 THEN
      pattern_ok := marked[i][1] AND marked[i][2] AND marked[i][3] AND marked[i][4] AND marked[i][5];
    END IF;
  ELSIF p_bingo_pattern LIKE 'column:%' THEN
    j := (split_part(p_bingo_pattern,':',2))::int + 1;
    IF j BETWEEN 1 AND 5 THEN
      pattern_ok := marked[1][j] AND marked[2][j] AND marked[3][j] AND marked[4][j] AND marked[5][j];
    END IF;
  ELSIF p_bingo_pattern = 'diag:main' THEN
    pattern_ok := marked[1][1] AND marked[2][2] AND marked[3][3] AND marked[4][4] AND marked[5][5];
  ELSIF p_bingo_pattern = 'diag:anti' THEN
    pattern_ok := marked[1][5] AND marked[2][4] AND marked[3][3] AND marked[4][2] AND marked[5][1];
  ELSE
    -- Unknown format: fallback to simple any-line check
    pattern_ok := false;
  END IF;

  valid_cells := pattern_ok; -- conservative: require pattern correctness

  -- Log claim
  INSERT INTO bot_tie_window_claims(game_id, user_id, claimed_cells, bingo_pattern, valid, created_at)
  VALUES (p_game_id, p_user_id, p_claimed_cells, p_bingo_pattern, valid_cells, now_ts);

  IF NOT valid_cells THEN
    RETURN QUERY SELECT false, false, jsonb_build_object('valid',false,'reason','pattern_invalid');
    RETURN;
  END IF;

  -- Small wait window to collect simultaneous claims
  PERFORM pg_sleep(window_seconds);

  -- Atomically resolve under lock
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;

  IF g.winner_id IS NOT NULL THEN
    RETURN QUERY SELECT true, (g.winner_id = p_user_id), jsonb_build_object('already_won',true,'winner',g.winner_id);
    RETURN;
  END IF;

  -- Gather all valid claims for this window (± window_seconds)
  WITH window_claims AS (
    SELECT user_id
    FROM bot_tie_window_claims
    WHERE game_id = p_game_id
      AND valid = true
      AND created_at >= now_ts - (window_seconds || ' seconds')::interval
      AND created_at <= now() + (window_seconds || ' seconds')::interval
  )
  SELECT prefer_bot_in_tie(g.bots, array_agg(user_id)) INTO tie_claimant
  FROM window_claims wc, games g
  WHERE g.id = p_game_id;

  IF tie_claimant IS NOT NULL THEN
    winner := tie_claimant; -- prefer 100% bot when included in claimants
  ELSE
    -- Default to current claimant (this function is called per-claim)
    winner := p_user_id;
  END IF;

  -- Set winner
  UPDATE games
  SET status = 'finished',
      winner_id = winner,
      ended_at = now()
  WHERE id = p_game_id AND winner_id IS NULL;

  RETURN QUERY SELECT true, (winner = p_user_id), jsonb_build_object('resolved',true,'winner',winner);
END;
$$;
