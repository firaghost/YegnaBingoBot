-- Referral pending flow: accumulate referral bonuses until user claims them
-- Date: 2025-11-21

-- 1) Add pending/claimed referral tracking columns
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS referral_pending NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_claimed NUMERIC DEFAULT 0;

COMMENT ON COLUMN users.referral_pending IS 'Referral earnings that are pending claim (not yet moved to main balance)';
COMMENT ON COLUMN users.referral_claimed IS 'Total referral earnings that have been claimed into main balance';

-- 2) Recreate process_referral_bonus to credit referral_pending instead of main balance
DROP FUNCTION IF EXISTS process_referral_bonus(UUID, TEXT);
CREATE OR REPLACE FUNCTION process_referral_bonus(
  p_referred_user_id UUID,
  p_referral_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_bonus NUMERIC;
  v_admin_value TEXT;
  v_rows INTEGER := 0;
BEGIN
  -- Find referrer by code
  SELECT id INTO v_referrer_id
  FROM users
  WHERE referral_code = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL OR v_referrer_id = p_referred_user_id THEN
    RETURN FALSE;
  END IF;

  -- Load configured referral bonus amount (admin_config stores values as text/JSON)
  SELECT config_value INTO v_admin_value
  FROM admin_config
  WHERE config_key = 'referral_bonus' AND is_active = TRUE
  ORDER BY updated_at DESC
  LIMIT 1;

  BEGIN
    v_referral_bonus := NULLIF(TRIM(BOTH '"' FROM COALESCE(v_admin_value, '')), '')::NUMERIC;
  EXCEPTION WHEN invalid_text_representation THEN
    v_referral_bonus := NULL;
  END;
  v_referral_bonus := COALESCE(v_referral_bonus, 25);

  -- Record referral (skip if already exists)
  INSERT INTO referrals (referrer_id, referred_user_id, bonus_amount, status)
  VALUES (v_referrer_id, p_referred_user_id, v_referral_bonus, 'completed')
  ON CONFLICT (referrer_id, referred_user_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Ensure referrer linkage still stored
    UPDATE users
    SET referrer_id = COALESCE(referrer_id, v_referrer_id),
        updated_at = NOW()
    WHERE id = p_referred_user_id;
    RETURN FALSE;
  END IF;

  -- Accumulate referral bonus in pending bucket and stats only
  UPDATE users
  SET
    referral_pending = COALESCE(referral_pending, 0) + v_referral_bonus,
    total_referrals = COALESCE(total_referrals, 0) + 1,
    referral_earnings = COALESCE(referral_earnings, 0) + v_referral_bonus,
    updated_at = NOW()
  WHERE id = v_referrer_id;

  -- Link referred user to referrer
  UPDATE users
  SET referrer_id = v_referrer_id,
      updated_at = NOW()
  WHERE id = p_referred_user_id;

  -- We intentionally do NOT credit main balance here.
  -- Actual credit happens when the user claims from the Invite page.
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID, TEXT) TO service_role;

-- 3) Function to claim pending referral bonuses into main balance
DROP FUNCTION IF EXISTS claim_referral_pending(UUID);
CREATE OR REPLACE FUNCTION claim_referral_pending(
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_pending NUMERIC := 0;
  v_real_before NUMERIC := 0;
  v_real_after NUMERIC := 0;
BEGIN
  -- Lock row and read pending + current balance
  SELECT COALESCE(referral_pending,0), COALESCE(balance,0)
  INTO v_pending, v_real_before
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_pending <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Move pending to main balance and accumulate claimed total
  UPDATE users
  SET
    balance = COALESCE(balance,0) + v_pending,
    referral_pending = 0,
    referral_claimed = COALESCE(referral_claimed,0) + v_pending,
    updated_at = NOW()
  WHERE id = p_user_id;

  SELECT COALESCE(balance,0) INTO v_real_after FROM users WHERE id = p_user_id;

  -- Log a referral_bonus transaction so it appears in wallet history
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (
      p_user_id,
      'referral_bonus',
      v_pending,
      'completed',
      jsonb_build_object(
        'source', 'referral_pending',
        'real_balance_before', v_real_before,
        'real_balance_after', v_real_after
      )
    );
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN others THEN RAISE; END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_referral_pending(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_referral_pending(UUID) TO service_role;
