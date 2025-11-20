-- ============================================
-- WALLET PAYOUT ENGINE REWRITE (REAL + BONUS)
-- Date: 2025-11-21
--
-- Goals:
-- - Enforce real-first stake priority (then bonus)
-- - Preserve ability to use mixed real+bonus for a single game entry
-- - Compute separate real and bonus prize pools
-- - Classify win type based on stake used:
--     * If any real stake used -> full win credited to real balance
--     * If only bonus stake used -> full win credited to bonus_win_balance
-- - Keep detailed snapshots in transactions.metadata
-- ============================================

-- 1) Stake deduction: real-first, then bonus, with snapshots
DROP FUNCTION IF EXISTS deduct_stake_with_bonus(UUID, NUMERIC);
CREATE OR REPLACE FUNCTION deduct_stake_with_bonus(
  p_user_id UUID,
  p_amount  NUMERIC,
  p_game_id UUID DEFAULT NULL
)
RETURNS TABLE(
  bonus_deducted NUMERIC,
  main_deducted  NUMERIC,
  total_deducted NUMERIC,
  source         TEXT
) AS $$
DECLARE
  v_bonus           NUMERIC;
  v_main            NUMERIC;
  v_pending_hold    NUMERIC;
  v_available_main  NUMERIC;
  v_needed          NUMERIC := p_amount;
  v_wager_required  NUMERIC;
  v_wager_progress  NUMERIC;
  v_locked          NUMERIC;
  v_real_before     NUMERIC;
  v_real_after      NUMERIC;
BEGIN
  -- Lock the user row and capture current balances
  SELECT COALESCE(bonus_balance, 0), COALESCE(balance, 0), COALESCE(pending_withdrawal_hold, 0)
    INTO v_bonus, v_main, v_pending_hold
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_available_main := v_main - v_pending_hold;

  -- Ensure total available (real + bonus) is enough
  IF v_bonus + v_available_main < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Total: % ETB, Pending Hold: % ETB, Available: % ETB, Requested: % ETB',
      v_main + v_bonus, v_pending_hold, v_bonus + v_available_main, p_amount;
  END IF;

  v_real_before := v_main; -- before deduction

  -- REAL-FIRST DEDUCTION: use available real first, then bonus
  main_deducted := LEAST(GREATEST(v_available_main, 0), v_needed);
  v_main        := v_main - main_deducted;
  v_needed      := v_needed - main_deducted;

  bonus_deducted := v_needed;
  v_bonus        := v_bonus - bonus_deducted;

  -- Persist balances
  UPDATE users
  SET bonus_balance = v_bonus,
      balance       = v_main,
      updated_at    = NOW()
  WHERE id = p_user_id;

  v_real_after := v_main; -- after deduction

  -- Update/clear wagering if present (progress increments by full stake)
  BEGIN
    SELECT COALESCE(wager_required,0), COALESCE(wager_progress,0), COALESCE(locked_balance,0)
      INTO v_wager_required, v_wager_progress, v_locked
    FROM users WHERE id = p_user_id FOR UPDATE;

    v_wager_progress := v_wager_progress + p_amount;

    IF v_wager_required > 0 AND v_wager_progress >= v_wager_required THEN
      UPDATE users
      SET wager_progress = 0,
          wager_required = 0,
          balance        = balance + COALESCE(locked_balance,0),
          locked_balance = 0,
          updated_at     = NOW()
      WHERE id = p_user_id;
    ELSE
      UPDATE users
      SET wager_progress = v_wager_progress,
          updated_at     = NOW()
      WHERE id = p_user_id;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      -- Older schemas without wagering columns
      NULL;
    WHEN others THEN
      RAISE;
  END;

  -- Log stake transaction with breakdown and balance snapshot
  total_deducted := bonus_deducted + main_deducted;
  source := CASE
    WHEN main_deducted = 0 THEN 'bonus'
    WHEN bonus_deducted = 0 THEN 'main'
    ELSE 'mixed'
  END;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_user_id,
      'stake',
      -p_amount,
      'completed',
      p_game_id,
      jsonb_build_object(
        'source',              source,
        'bonus_deducted',      bonus_deducted,
        'main_deducted',       main_deducted,
        'total_deducted',      total_deducted,
        'real_balance_before', v_real_before,
        'real_balance_after',  v_real_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_user_id, 'stake', -p_amount, 'completed');
    WHEN others THEN
      RAISE;
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;


-- 2) Compute REAL-ONLY prize pool from main_deducted (existing behavior)
DROP FUNCTION IF EXISTS compute_real_prize_pool(UUID);
CREATE OR REPLACE FUNCTION compute_real_prize_pool(p_game_id UUID)
RETURNS NUMERIC AS $$
DECLARE v_pool NUMERIC;
BEGIN
  BEGIN
    SELECT COALESCE(SUM((metadata->>'main_deducted')::NUMERIC), 0)
      INTO v_pool
    FROM transactions
    WHERE game_id = p_game_id AND type = 'stake' AND status = 'completed';
  EXCEPTION
    WHEN undefined_column THEN
      -- Legacy: approximate with total stakes
      SELECT COALESCE(SUM(-amount), 0) INTO v_pool
      FROM transactions
      WHERE game_id = p_game_id AND type = 'stake' AND status = 'completed';
    WHEN others THEN
      RAISE;
  END;
  RETURN COALESCE(v_pool, 0);
END;
$$ LANGUAGE plpgsql;


-- 3) Compute BONUS-ONLY prize pool from bonus_deducted
DROP FUNCTION IF EXISTS compute_bonus_prize_pool(UUID);
CREATE OR REPLACE FUNCTION compute_bonus_prize_pool(p_game_id UUID)
RETURNS NUMERIC AS $$
DECLARE v_pool NUMERIC;
BEGIN
  BEGIN
    SELECT COALESCE(SUM((metadata->>'bonus_deducted')::NUMERIC), 0)
      INTO v_pool
    FROM transactions
    WHERE game_id = p_game_id AND type = 'stake' AND status = 'completed';
  EXCEPTION
    WHEN undefined_column THEN
      -- If metadata not available, treat bonus pool as zero (legacy safety)
      v_pool := 0;
    WHEN others THEN
      RAISE;
  END;
  RETURN COALESCE(v_pool, 0);
END;
$$ LANGUAGE plpgsql;


-- 4) Credit win: classify by stake usage and route full prize to ONE wallet
DROP FUNCTION IF EXISTS credit_win(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION credit_win(
  p_user_id UUID,
  p_game_id UUID,
  p_amount  NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_source             TEXT;
  v_bonus_deducted     NUMERIC := 0;
  v_main_deducted      NUMERIC := 0;
  v_total_deducted     NUMERIC := 0;
  v_bonus_share        NUMERIC := 0;
  v_real_share         NUMERIC := 0;
  v_real_before        NUMERIC := 0;
  v_real_after         NUMERIC := 0;
  v_bonus_win_before   NUMERIC := 0;
  v_bonus_win_after    NUMERIC := 0;
BEGIN
  -- Determine stake breakdown for this user in this game (latest stake)
  BEGIN
    SELECT (metadata->>'source'),
           COALESCE((metadata->>'bonus_deducted')::NUMERIC,0),
           COALESCE((metadata->>'main_deducted')::NUMERIC,0),
           COALESCE((metadata->>'total_deducted')::NUMERIC,0)
    INTO v_source, v_bonus_deducted, v_main_deducted, v_total_deducted
    FROM transactions
    WHERE user_id = p_user_id AND game_id = p_game_id AND type = 'stake'
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_column THEN
      -- Legacy schemas: assume fully real
      v_source         := 'main';
      v_main_deducted  := 1;
      v_total_deducted := 1;
      v_bonus_deducted := 0;
    WHEN NO_DATA_FOUND THEN
      -- No stake record found: default to real-only credit (safest for user)
      v_source         := 'main';
      v_main_deducted  := 1;
      v_total_deducted := 1;
      v_bonus_deducted := 0;
    WHEN others THEN
      RAISE;
  END;

  IF v_total_deducted <= 0 THEN
    v_total_deducted := v_bonus_deducted + v_main_deducted;
  END IF;
  IF v_total_deducted <= 0 THEN
    v_total_deducted := 1; -- avoid division by zero in any legacy edge case
  END IF;

  -- WIN CLASSIFICATION:
  -- If ANY real stake was used -> full prize credited to REAL wallet
  -- If ONLY bonus stake was used -> full prize credited to BONUS_WIN wallet
  IF v_main_deducted > 0 THEN
    v_real_share  := p_amount;
    v_bonus_share := 0;
  ELSE
    v_real_share  := 0;
    v_bonus_share := p_amount;
  END IF;

  -- Capture balances before update
  SELECT COALESCE(balance,0), COALESCE(bonus_win_balance,0)
    INTO v_real_before, v_bonus_win_before
  FROM users WHERE id = p_user_id FOR UPDATE;

  -- Apply credit
  UPDATE users
  SET bonus_win_balance = COALESCE(bonus_win_balance,0) + v_bonus_share,
      balance           = COALESCE(balance,0)           + v_real_share,
      updated_at        = NOW()
  WHERE id = p_user_id;

  -- Capture balances after update
  SELECT COALESCE(balance,0), COALESCE(bonus_win_balance,0)
    INTO v_real_after, v_bonus_win_after
  FROM users WHERE id = p_user_id;

  -- Log REAL win leg (if any)
  IF v_real_share > 0 THEN
    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
      VALUES (
        p_user_id,
        'win',
        v_real_share,
        'completed',
        p_game_id,
        jsonb_build_object(
          'credited_to',          'real',
          'real_balance_before',  v_real_before,
          'real_balance_after',   v_real_after
        )
      );
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
      WHEN others THEN RAISE;
    END;
  END IF;

  -- Log BONUS win leg (if any)
  IF v_bonus_share > 0 THEN
    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
      VALUES (
        p_user_id,
        'win',
        v_bonus_share,
        'completed',
        p_game_id,
        jsonb_build_object(
          'credited_to',              'bonus_win',
          'bonus_win_balance_before', v_bonus_win_before,
          'bonus_win_balance_after',  v_bonus_win_after
        )
      );
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
      WHEN others THEN RAISE;
    END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5) Admin helper: convert Bonus Wins -> Real balance (manual conversion only)
--    Used from admin panel when you decide to unlock some or all bonus_win_balance as cash.
DROP FUNCTION IF EXISTS convert_bonus_wins_to_real(UUID, NUMERIC, UUID, TEXT, JSONB);
CREATE OR REPLACE FUNCTION convert_bonus_wins_to_real(
  p_user_id UUID,
  p_amount  NUMERIC,
  p_actor   UUID DEFAULT NULL,
  p_reason  TEXT DEFAULT 'manual_bonus_win_to_real',
  p_metadata JSONB DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  v_bonus_win_before NUMERIC := 0;
  v_real_before      NUMERIC := 0;
  v_convert          NUMERIC := 0;
BEGIN
  -- Lock user row and read balances
  SELECT COALESCE(bonus_win_balance,0), COALESCE(balance,0)
    INTO v_bonus_win_before, v_real_before
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_bonus_win_before <= 0 THEN
    RETURN 0; -- nothing to convert
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    v_convert := v_bonus_win_before; -- convert all by default
  ELSE
    v_convert := LEAST(p_amount, v_bonus_win_before);
  END IF;

  IF v_convert <= 0 THEN
    RETURN 0;
  END IF;

  -- Move from bonus_win_balance to real balance
  UPDATE users
  SET bonus_win_balance = COALESCE(bonus_win_balance,0) - v_convert,
      balance           = COALESCE(balance,0)           + v_convert,
      updated_at        = NOW()
  WHERE id = p_user_id;

  -- Log as conversion transaction (amount 0, metadata describes movement)
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (
      p_user_id,
      'conversion',
      0,
      'completed',
      jsonb_build_object(
        'direction', 'bonus_win_to_real',
        'converted_amount', v_convert,
        'reason', p_reason,
        'actor', p_actor,
        'extra', p_metadata
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN check_violation THEN NULL;
    WHEN others THEN RAISE;
  END;

  RETURN v_convert;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
