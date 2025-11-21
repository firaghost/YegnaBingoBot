-- ============================================
-- WALLET V2 MODEL: REAL + BONUS + LOCKED BONUS
-- Date: 2025-11-21
-- ============================================

-- 1) Users schema: add has_made_deposit flag (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS has_made_deposit BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.balance           IS 'real_balance: withdrawable cash';
COMMENT ON COLUMN users.bonus_balance     IS 'bonus_balance: free chips (stake for bonus games)';
COMMENT ON COLUMN users.bonus_win_balance IS 'bonus_locked_balance: bonus-game winnings locked until first real deposit';
COMMENT ON COLUMN users.has_made_deposit  IS 'True once user has at least one completed real-money deposit';

-- 2) Logical wallet view for application use
DROP VIEW IF EXISTS user_wallets;
CREATE OR REPLACE VIEW user_wallets AS
SELECT
  id                                                AS user_id,
  COALESCE(balance, 0)                              AS real_balance,
  COALESCE(bonus_balance, 0)                        AS bonus_balance,
  COALESCE(bonus_win_balance, 0)                    AS bonus_locked_balance,
  COALESCE(balance, 0)
    + COALESCE(bonus_balance, 0)
    + COALESCE(bonus_win_balance, 0)               AS total_balance,
  COALESCE(has_made_deposit, FALSE)                AS has_made_deposit
FROM users;

-- ============================================
-- 3) GAME ENTRY FUNCTIONS (NO MIXED STAKE)
-- ============================================

-- 3a) Stake from REAL wallet only
DROP FUNCTION IF EXISTS wallet_game_start_real(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION wallet_game_start_real(
  p_user_id UUID,
  p_game_id UUID,
  p_stake   NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_real_before NUMERIC;
  v_real_after  NUMERIC;
BEGIN
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stake must be positive';
  END IF;

  SELECT COALESCE(balance, 0)
    INTO v_real_before
    FROM users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_real_before < p_stake THEN
    RAISE EXCEPTION 'INSUFFICIENT_REAL_BALANCE';
  END IF;

  v_real_after := v_real_before - p_stake;

  UPDATE users
     SET balance   = v_real_after,
         updated_at = NOW()
   WHERE id = p_user_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_user_id,
      'stake',
      -p_stake,
      'completed',
      p_game_id,
      jsonb_build_object(
        'stake_source', 'real',
        'wallet_type',  'real',
        'real_before',  v_real_before,
        'real_after',   v_real_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_user_id, 'stake', -p_stake, 'completed');
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3b) Stake from BONUS wallet only
DROP FUNCTION IF EXISTS wallet_game_start_bonus(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION wallet_game_start_bonus(
  p_user_id UUID,
  p_game_id UUID,
  p_stake   NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_bonus_before NUMERIC;
  v_bonus_after  NUMERIC;
BEGIN
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stake must be positive';
  END IF;

  SELECT COALESCE(bonus_balance, 0)
    INTO v_bonus_before
    FROM users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_bonus_before < p_stake THEN
    RAISE EXCEPTION 'INSUFFICIENT_BONUS_BALANCE';
  END IF;

  v_bonus_after := v_bonus_before - p_stake;

  UPDATE users
     SET bonus_balance = v_bonus_after,
         updated_at    = NOW()
   WHERE id = p_user_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_user_id,
      'stake',
      -p_stake,
      'completed',
      p_game_id,
      jsonb_build_object(
        'stake_source',  'bonus',
        'wallet_type',   'bonus',
        'bonus_before',  v_bonus_before,
        'bonus_after',   v_bonus_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_user_id, 'stake', -p_stake, 'completed');
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4) GAME SETTLEMENT FUNCTIONS
-- ============================================

-- 4a) Real-money game: winnings to REAL wallet only
DROP FUNCTION IF EXISTS wallet_settle_real_game(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION wallet_settle_real_game(
  p_winner_id UUID,
  p_game_id   UUID,
  p_prize     NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_real_before NUMERIC;
  v_real_after  NUMERIC;
BEGIN
  IF p_prize IS NULL OR p_prize <= 0 THEN
    RETURN TRUE; -- nothing to do
  END IF;

  SELECT COALESCE(balance, 0)
    INTO v_real_before
    FROM users
   WHERE id = p_winner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_real_after := v_real_before + p_prize;

  UPDATE users
     SET balance   = v_real_after,
         updated_at = NOW()
   WHERE id = p_winner_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_winner_id,
      'win_real',
      p_prize,
      'completed',
      p_game_id,
      jsonb_build_object(
        'wallet_type',  'real',
        'real_before',  v_real_before,
        'real_after',   v_real_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_winner_id, 'win_real', p_prize, 'completed');
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4b) Bonus game: winnings to LOCKED BONUS wallet only
DROP FUNCTION IF EXISTS wallet_settle_bonus_game(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION wallet_settle_bonus_game(
  p_winner_id UUID,
  p_game_id   UUID,
  p_prize     NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_locked_before NUMERIC;
  v_locked_after  NUMERIC;
BEGIN
  IF p_prize IS NULL OR p_prize <= 0 THEN
    RETURN TRUE; -- nothing to do
  END IF;

  SELECT COALESCE(bonus_win_balance, 0)
    INTO v_locked_before
    FROM users
   WHERE id = p_winner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_locked_after := v_locked_before + p_prize;

  UPDATE users
     SET bonus_win_balance = v_locked_after,
         updated_at        = NOW()
   WHERE id = p_winner_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_winner_id,
      'win_bonus_locked',
      p_prize,
      'completed',
      p_game_id,
      jsonb_build_object(
        'wallet_type',          'bonus_locked',
        'bonus_locked_before',  v_locked_before,
        'bonus_locked_after',   v_locked_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_winner_id, 'win_bonus_locked', p_prize, 'completed');
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5) FIRST DEPOSIT UNLOCK (FULL LOCKED BONUS)
-- ============================================

DROP FUNCTION IF EXISTS wallet_apply_first_deposit_unlock(UUID, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION wallet_apply_first_deposit_unlock(
  p_user_id UUID,
  p_amount  NUMERIC,
  p_meta    JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_deposit   BOOLEAN;
  v_real_before   NUMERIC;
  v_real_after    NUMERIC;
  v_locked_before NUMERIC;
  v_locked_after  NUMERIC;
  v_deposit_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive';
  END IF;

  SELECT COALESCE(has_made_deposit, FALSE),
         COALESCE(balance, 0),
         COALESCE(bonus_win_balance, 0)
    INTO v_has_deposit, v_real_before, v_locked_before
    FROM users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Base: credit deposit to real balance
  v_real_after := v_real_before + p_amount;

  IF v_has_deposit = FALSE AND v_locked_before > 0 THEN
    -- First deposit: fully unlock locked bonus into real
    v_real_after   := v_real_after + v_locked_before;
    v_locked_after := 0;
  ELSE
    v_locked_after := v_locked_before;
  END IF;

  UPDATE users
     SET balance           = v_real_after,
         bonus_win_balance = v_locked_after,
         has_made_deposit  = TRUE,
         updated_at        = NOW()
   WHERE id = p_user_id;

  -- Deposit transaction (cash in)
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (
      p_user_id,
      'deposit',
      p_amount,
      'completed',
      jsonb_build_object(
        'kind', 'cash_deposit',
        'meta', p_meta
      )
    )
    RETURNING id INTO v_deposit_tx_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  -- Unlock transaction (if applicable)
  IF v_has_deposit = FALSE AND v_locked_before > 0 THEN
    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, metadata)
      VALUES (
        p_user_id,
        'unlock_bonus_full',
        v_locked_before,
        'completed',
        jsonb_build_object(
          'direction',       'bonus_locked_to_real',
          'previous_locked', v_locked_before,
          'meta',            p_meta
        )
      );
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- END WALLET V2 MODEL
-- ============================================
