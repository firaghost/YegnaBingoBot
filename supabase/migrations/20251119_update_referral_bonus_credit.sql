-- ============================================
-- Referral bonus credits real balance + logging
-- Date: 2025-11-19
-- ============================================

-- 1) Expand transactions.type enum to include referral bonuses
DO $$
BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
  EXCEPTION WHEN undefined_table THEN
    RETURN;
END $$;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('stake','win','deposit','withdrawal','conversion','referral_bonus'));

-- 2) Recreate process_referral_bonus to credit main balance
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
  SELECT id
    INTO v_referrer_id
  FROM users
  WHERE referral_code = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL OR v_referrer_id = p_referred_user_id THEN
    RETURN FALSE;
  END IF;

  -- Pull configured referral bonus amount (stored as text/JSON)
  SELECT config_value
    INTO v_admin_value
  FROM admin_config
  WHERE config_key = 'referral_bonus' AND is_active = TRUE
  ORDER BY updated_at DESC
  LIMIT 1;

  BEGIN
    v_referral_bonus := NULLIF(TRIM(BOTH '"' FROM COALESCE(v_admin_value, '')), '')::NUMERIC;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_referral_bonus := NULL;
  END;

  v_referral_bonus := COALESCE(v_referral_bonus, 25);

  -- Record referral relationship; skip payout if already processed
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

  -- Credit main balance and referral stats
  UPDATE users
  SET balance = COALESCE(balance, 0) + v_referral_bonus,
      total_referrals = COALESCE(total_referrals, 0) + 1,
      referral_earnings = COALESCE(referral_earnings, 0) + v_referral_bonus,
      updated_at = NOW()
  WHERE id = v_referrer_id;

  -- Associate referred user with referrer
  UPDATE users
  SET referrer_id = v_referrer_id,
      updated_at = NOW()
  WHERE id = p_referred_user_id;

  -- Log referral reward transaction when transactions table is present
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (
      v_referrer_id,
      'referral_bonus',
      v_referral_bonus,
      'completed',
      jsonb_build_object('referred_user_id', p_referred_user_id)
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN others THEN RAISE;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RPC callable by authenticated roles
GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID, TEXT) TO service_role;
