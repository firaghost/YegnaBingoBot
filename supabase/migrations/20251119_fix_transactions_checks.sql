-- Fix transactions constraints and conversion logging

-- 1) Ensure metadata column exists
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2) Widen status set to include 'rejected'
DO $$ BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','completed','failed','rejected'));

-- 3) Widen type set to include 'conversion'
DO $$ BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
  EXCEPTION WHEN undefined_table THEN NULL;
END $$;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('stake','win','deposit','withdrawal','conversion'));

-- 4) Replace convert_all_real_to_bonus to log with type 'conversion' and tolerate check violations
CREATE OR REPLACE FUNCTION convert_all_real_to_bonus(
  p_user_id UUID,
  p_requested_amount NUMERIC DEFAULT 0,
  p_reason TEXT DEFAULT 'withdraw_without_deposit',
  p_actor UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC := 0;
BEGIN
  SELECT COALESCE(balance,0) INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_balance <= 0 THEN RETURN 0; END IF;

  UPDATE users
  SET bonus_balance = COALESCE(bonus_balance,0) + v_balance,
      balance = 0,
      updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO real_to_bonus_conversions(user_id, converted_amount, requested_amount, reason, actor, metadata)
  VALUES (p_user_id, v_balance, COALESCE(p_requested_amount,0), p_reason, p_actor, p_metadata);

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (
      p_user_id,
      'conversion',
      0,
      'completed',
      jsonb_build_object(
        'converted_amount', v_balance,
        'requested_amount', COALESCE(p_requested_amount,0),
        'reason', p_reason
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
    WHEN check_violation THEN NULL;
    WHEN others THEN RAISE; -- surface unexpected errors
  END;

  RETURN v_balance;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;
