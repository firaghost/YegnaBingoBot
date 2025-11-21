-- Add minimum deposit threshold for first-deposit unlock of locked bonus
-- Locked bonus only converts to real when:
--   1) This is the user's first deposit (has_made_deposit = false), AND
--   2) p_amount >= configured min_deposit_to_unlock (admin_config), AND
--   3) bonus_win_balance > 0.
-- If config is missing or invalid, threshold defaults to 0 (previous behaviour).

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

  -- Load minimum deposit required to unlock locked bonus, if configured
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

  v_min_unlock := COALESCE(v_min_unlock, 0); -- default: unlock on any positive first deposit (legacy behaviour)

  -- Base: always credit deposit to real balance
  v_real_after := v_real_before + p_amount;
  v_locked_after := v_locked_before;

  -- Determine if we should unlock locked bonus on this deposit
  IF v_has_deposit = FALSE AND v_locked_before > 0 AND p_amount >= v_min_unlock THEN
    v_should_unlock := TRUE;
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
