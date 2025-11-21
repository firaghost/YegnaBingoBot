-- WALLET V2: cumulative deposits threshold for unlocking locked bonus
-- Locked bonus now unlocks when the user's TOTAL completed deposits reach
-- min_deposit_to_unlock, not necessarily on the very first deposit.
--
-- Behaviour:
--   - Every deposit credits p_amount to real balance.
--   - Let v_total_before = sum of all previous completed deposit amounts.
--   - Let v_min_unlock = admin_config.min_deposit_to_unlock (numeric, default 0).
--   - If v_min_unlock > 0 and v_total_before < v_min_unlock and
--         v_total_before + p_amount >= v_min_unlock and bonus_win_balance > 0,
--       then unlock ALL locked bonus into real.
--   - If v_min_unlock <= 0, we keep legacy behaviour: unlock on very first
--       deposit only (has_made_deposit = false and bonus_win_balance > 0).

DROP FUNCTION IF EXISTS wallet_apply_first_deposit_unlock(UUID, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION wallet_apply_first_deposit_unlock(
  p_user_id UUID,
  p_amount  NUMERIC,
  p_meta    JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_deposit    BOOLEAN;
  v_real_before    NUMERIC;
  v_real_after     NUMERIC;
  v_locked_before  NUMERIC;
  v_locked_after   NUMERIC;
  v_deposit_tx_id  UUID;
  v_cfg_value      TEXT;
  v_min_unlock     NUMERIC;
  v_total_before   NUMERIC := 0;
  v_should_unlock  BOOLEAN := FALSE;
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

  -- Load minimum cumulative deposit required to unlock locked bonus, if configured
  BEGIN
    SELECT config_value
      INTO v_cfg_value
      FROM admin_config
     WHERE config_key = 'min_deposit_to_unlock'
       AND is_active = TRUE
     ORDER BY updated_at DESC
     LIMIT 1;

    BEGIN
      v_min_unlock := NULLIF(TRIM(BOTH '"' FROM COALESCE(v_cfg_value, '')), '')::NUMERIC;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_min_unlock := NULL;
    END;
  EXCEPTION
    WHEN undefined_table THEN
      v_min_unlock := NULL;
  END;

  v_min_unlock := COALESCE(v_min_unlock, 0);

  -- Compute cumulative completed deposits BEFORE this one
  BEGIN
    SELECT COALESCE(SUM(amount), 0)
      INTO v_total_before
      FROM transactions
     WHERE user_id = p_user_id
       AND type = 'deposit'
       AND status = 'completed';
  EXCEPTION
    WHEN undefined_table THEN
      v_total_before := 0;
    WHEN undefined_column THEN
      v_total_before := 0;
  END;

  -- Base: always credit this deposit to real balance
  v_real_after   := v_real_before + p_amount;
  v_locked_after := v_locked_before;

  -- Decide if this deposit should unlock locked bonus
  IF v_locked_before > 0 THEN
    IF v_min_unlock > 0 THEN
      -- Cumulative threshold: unlock when total deposits cross the threshold
      IF v_total_before < v_min_unlock AND (v_total_before + p_amount) >= v_min_unlock THEN
        v_should_unlock := TRUE;
      END IF;
    ELSE
      -- Legacy behaviour when threshold is 0: first-ever deposit triggers unlock
      IF v_has_deposit = FALSE THEN
        v_should_unlock := TRUE;
      END IF;
    END IF;
  END IF;

  IF v_should_unlock THEN
    v_real_after   := v_real_after + v_locked_before;
    v_locked_after := 0;
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
        'meta', p_meta,
        'min_deposit_to_unlock', v_min_unlock,
        'total_deposits_before', v_total_before,
        'unlocked_locked_bonus', v_should_unlock
      )
    )
    RETURNING id INTO v_deposit_tx_id;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  -- Unlock transaction (if applicable)
  IF v_should_unlock THEN
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
