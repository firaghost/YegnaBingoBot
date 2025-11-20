-- Referral transactions: add real balance before/after snapshots and update user_transaction_history mapping
-- Date: 2025-11-20

-- 1) Ensure transactions has metadata column
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2) Recreate process_referral_bonus to attach real balance snapshots
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
  v_real_before NUMERIC := 0;
  v_real_after NUMERIC := 0;
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

  -- Record referral (skip payout if already exists)
  INSERT INTO referrals (referrer_id, referred_user_id, bonus_amount, status)
  VALUES (v_referrer_id, p_referred_user_id, v_referral_bonus, 'completed')
  ON CONFLICT (referrer_id, referred_user_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    UPDATE users
    SET referrer_id = COALESCE(referrer_id, v_referrer_id),
        updated_at = NOW()
    WHERE id = p_referred_user_id;
    RETURN FALSE;
  END IF;

  -- Capture real balance before, credit, capture after
  SELECT COALESCE(balance,0) INTO v_real_before FROM users WHERE id = v_referrer_id FOR UPDATE;
  UPDATE users
  SET balance = COALESCE(balance, 0) + v_referral_bonus,
      total_referrals = COALESCE(total_referrals, 0) + 1,
      referral_earnings = COALESCE(referral_earnings, 0) + v_referral_bonus,
      updated_at = NOW()
  WHERE id = v_referrer_id;
  SELECT COALESCE(balance,0) INTO v_real_after FROM users WHERE id = v_referrer_id;

  -- Link referred user to referrer
  UPDATE users
  SET referrer_id = v_referrer_id,
      updated_at = NOW()
  WHERE id = p_referred_user_id;

  -- Log referral reward transaction with snapshots
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (
      v_referrer_id,
      'referral_bonus',
      v_referral_bonus,
      'completed',
      jsonb_build_object(
        'referred_user_id', p_referred_user_id,
        'real_balance_before', v_real_before,
        'real_balance_after', v_real_after
      )
    );
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN others THEN RAISE; END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Update user_transaction_history mapping to show Referral nicely (keeps all previous fields)
DROP VIEW IF EXISTS user_transaction_history;
CREATE OR REPLACE VIEW user_transaction_history AS
SELECT 
  t.id,
  t.user_id,
  t.type,
  t.game_id,
  t.amount,
  t.description,
  t.result,
  t.game_level,
  t.status,
  t.created_at,
  g.room_id,
  r.name as room_name,
  g.prize_pool,
  g.net_prize,
  g.commission_rate,
  g.commission_amount,
  t.metadata->>'source' AS source,
  t.metadata->>'credited_to' AS credited_to,
  NULLIF(t.metadata->>'bonus_deducted', '')::NUMERIC AS bonus_deducted,
  NULLIF(t.metadata->>'main_deducted', '')::NUMERIC AS main_deducted,
  NULLIF(t.metadata->>'total_deducted', '')::NUMERIC AS total_deducted,
  NULLIF(t.metadata->>'real_balance_before', '')::NUMERIC AS balance_before,
  NULLIF(t.metadata->>'real_balance_after', '')::NUMERIC AS balance_after,
  NULLIF(t.metadata->>'bonus_win_balance_before', '')::NUMERIC AS bonus_win_balance_before,
  NULLIF(t.metadata->>'bonus_win_balance_after', '')::NUMERIC AS bonus_win_balance_after,
  COALESCE(
    NULLIF(t.metadata->>'rejection_reason', ''),
    NULLIF(w.admin_note, '')
  ) AS reason,
  CASE 
    WHEN t.type = 'win' THEN '🏆 Game Win'
    WHEN t.type = 'stake' THEN '🎮 Game Entry'
    WHEN t.type = 'deposit' THEN '💸 Deposit'
    WHEN t.type = 'withdrawal' THEN '💰 Withdrawal'
    WHEN t.type = 'bonus' THEN '🎁 Bonus'
    WHEN t.type = 'conversion' THEN '🔄 Conversion'
    WHEN t.type = 'referral_bonus' THEN '👥 Referral'
    ELSE '📝 Transaction'
  END as display_icon,
  CASE 
    WHEN t.amount > 0 THEN '+' || t.amount::TEXT || ' ETB'
    ELSE t.amount::TEXT || ' ETB'
  END as display_amount,
  CASE 
    WHEN t.type = 'win' THEN 'success'
    WHEN t.type = 'stake' THEN 'loss'
    WHEN t.type = 'deposit' THEN CASE WHEN t.status = 'failed' THEN 'loss' ELSE 'success' END
    WHEN t.type = 'withdrawal' THEN CASE WHEN t.status IN ('rejected','failed') THEN 'loss' ELSE 'neutral' END
    WHEN t.type = 'bonus' THEN 'success'
    WHEN t.type = 'referral_bonus' THEN 'success'
    ELSE 'neutral'
  END as display_status
FROM transactions t
LEFT JOIN games g ON t.game_id = g.id
LEFT JOIN rooms r ON g.room_id = r.id
LEFT JOIN withdrawals w ON (t.type = 'withdrawal' AND (t.metadata->>'withdrawal_id')::uuid = w.id)
ORDER BY t.created_at DESC;
