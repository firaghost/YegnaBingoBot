-- ============================================
-- BONUS & WITHDRAW PROTECTION (Strict Rules)
-- Date: 2025-11-19
-- ============================================

-- 1) Conversion log table
CREATE TABLE IF NOT EXISTS real_to_bonus_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  converted_amount NUMERIC NOT NULL DEFAULT 0,
  requested_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  actor UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_r2b_user ON real_to_bonus_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_r2b_created ON real_to_bonus_conversions(created_at DESC);

-- 2) Helper: total completed deposits for a user
CREATE OR REPLACE FUNCTION user_total_deposits(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE v_sum NUMERIC;
BEGIN
  BEGIN
    SELECT COALESCE(SUM(amount),0) INTO v_sum
    FROM transactions
    WHERE user_id = p_user_id AND type = 'deposit' AND status = 'completed';
  EXCEPTION WHEN undefined_table THEN
    v_sum := 0; -- legacy schema fallback
  END;
  RETURN COALESCE(v_sum,0);
END;$$ LANGUAGE plpgsql STABLE;

-- 3) Convert ALL real balance to bonus wallet and log
--    Used when user attempts withdrawal without any real deposit.
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
  -- Lock row and read balance
  SELECT COALESCE(balance,0) INTO v_balance
  FROM users WHERE id = p_user_id FOR UPDATE;

  -- No-op if already zero
  IF v_balance <= 0 THEN
    RETURN 0;
  END IF;

  -- Move entire real to bonus_balance (Bonus Wallet)
  UPDATE users
  SET bonus_balance = COALESCE(bonus_balance,0) + v_balance,
      balance = 0,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Log conversion
  INSERT INTO real_to_bonus_conversions(user_id, converted_amount, requested_amount, reason, actor, metadata)
  VALUES (p_user_id, v_balance, COALESCE(p_requested_amount,0), p_reason, p_actor, p_metadata);

  -- Optional transaction audit (if table/cols exist)
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (p_user_id, 'real_to_bonus_conversion', 0, 'completed',
            jsonb_build_object('converted_amount', v_balance,
                                'requested_amount', COALESCE(p_requested_amount,0),
                                'reason', p_reason));
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;

  RETURN v_balance;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Retroactive processor: reject all pending withdrawals for users with NO deposits
--    and convert their entire real balance to bonus.
CREATE OR REPLACE FUNCTION process_pending_withdrawals_no_deposit()
RETURNS TABLE(withdrawal_id UUID, user_id UUID, amount NUMERIC) AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT w.*,
           COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id=w.user_id AND t.type='deposit' AND t.status='completed'),0) AS deposits
    FROM withdrawals w
    WHERE w.status = 'pending'
  LOOP
    IF COALESCE(rec.deposits,0) <= 0 THEN
      -- Reject withdrawal
      UPDATE withdrawals
      SET status = 'rejected',
          processed_at = NOW(),
          updated_at = NOW(),
          admin_note = 'Rejected: Bonus-only funds. A real deposit is required before withdrawal.'
      WHERE id = rec.id;

      -- Release hold if present
      BEGIN
        UPDATE users
        SET pending_withdrawal_hold = GREATEST(COALESCE(pending_withdrawal_hold,0) - rec.amount, 0),
            updated_at = NOW()
        WHERE id = rec.user_id;
      EXCEPTION WHEN undefined_column THEN NULL; END;

      -- Mark related transaction as rejected (if metadata link exists)
      BEGIN
        UPDATE transactions
        SET status = 'rejected'
        WHERE metadata->>'withdrawal_id' = rec.id::TEXT;
      EXCEPTION WHEN undefined_column THEN NULL; WHEN undefined_table THEN NULL; END;

      -- Convert entire real balance to bonus
      PERFORM convert_all_real_to_bonus(rec.user_id, rec.amount, 'retroactive_enforcement');

      withdrawal_id := rec.id; user_id := rec.user_id; amount := rec.amount; RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Policy: ensure table accessible to service role
GRANT SELECT, INSERT ON real_to_bonus_conversions TO service_role;

-- ============================================
