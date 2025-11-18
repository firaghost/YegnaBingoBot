-- ============================================
-- WAGERING SYSTEM + WITHDRAW LIMITS
-- ============================================
-- Adds wagering requirement mechanics and enforces 1 withdrawal / 24h with daily cap.

-- 1) Schema changes
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locked_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wager_required NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wager_progress NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_withdrawal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_withdrawn_date DATE,
  ADD COLUMN IF NOT EXISTS daily_withdrawn_amount NUMERIC DEFAULT 0;

-- 2) Grant bonus helper: sets bonus and wagering requirement
DROP FUNCTION IF EXISTS grant_bonus(UUID, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION grant_bonus(
  p_user_id UUID,
  p_amount NUMERIC,
  p_multiplier NUMERIC DEFAULT 10
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET bonus_balance = COALESCE(bonus_balance,0) + p_amount,
      wager_required = COALESCE(wager_required,0) + (p_amount * p_multiplier),
      updated_at = NOW()
  WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Credit win helper: credits wins to locked_balance if wagering is not met
--    or if the stake for this game used bonus funds.
DROP FUNCTION IF EXISTS credit_win(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION credit_win(
  p_user_id UUID,
  p_game_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_wager_required NUMERIC;
  v_wager_progress NUMERIC;
  v_locked NUMERIC;
  v_used_bonus BOOLEAN := FALSE;
  v_source TEXT;
BEGIN
  -- detect if this game stake used bonus (based on stake transaction metadata)
  BEGIN
    SELECT (metadata ->> 'source')
      INTO v_source
    FROM transactions
    WHERE user_id = p_user_id AND game_id = p_game_id AND type = 'stake'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_source IN ('bonus','mixed') THEN
      v_used_bonus := TRUE;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    v_used_bonus := FALSE;
  END;

  SELECT COALESCE(wager_required,0), COALESCE(wager_progress,0), COALESCE(locked_balance,0)
    INTO v_wager_required, v_wager_progress, v_locked
  FROM users WHERE id = p_user_id FOR UPDATE;

  IF (v_wager_progress < v_wager_required) OR v_used_bonus THEN
    -- lock the win until wagering is cleared
    UPDATE users
    SET locked_balance = COALESCE(locked_balance,0) + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
      VALUES (p_user_id, 'win', p_amount, 'completed', p_game_id, jsonb_build_object('credited_to','locked'));
    EXCEPTION WHEN undefined_table THEN NULL; END;
  ELSE
    UPDATE users
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
      VALUES (p_user_id, 'win', p_amount, 'completed', p_game_id, jsonb_build_object('credited_to','balance'));
    EXCEPTION WHEN undefined_table THEN NULL; END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Replace create_withdrawal to enforce: one pending, 24h cooldown, daily cap,
--    block if locked_balance>0 or wagering not met. Also place a withdrawal hold.
DROP FUNCTION IF EXISTS create_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_account_holder TEXT
) RETURNS UUID AS $$
DECLARE
  v_withdrawal_id UUID;
  v_pending_count INT;
  v_last_approved TIMESTAMPTZ;
  v_today NUMERIC;
  v_daily_cap NUMERIC := 500.0; -- DEFAULT DAILY CAP (change here if needed)
  v_available_balance NUMERIC;
  v_wager_required NUMERIC;
  v_wager_progress NUMERIC;
  v_locked_balance NUMERIC;
BEGIN
  -- basic sanity checks
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  -- enforce one pending withdrawal per user
  SELECT COUNT(*) INTO v_pending_count FROM withdrawals WHERE user_id = p_user_id AND status = 'pending';
  IF v_pending_count > 0 THEN RAISE EXCEPTION 'You already have a pending withdrawal'; END IF;

  -- 24h cooldown since last approved
  SELECT MAX(approved_at) INTO v_last_approved FROM withdrawals WHERE user_id = p_user_id AND status = 'approved';
  IF v_last_approved IS NOT NULL AND NOW() - v_last_approved < INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'You can only withdraw once every 24 hours';
  END IF;

  -- daily cap (pending + approved today)
  SELECT COALESCE(SUM(amount),0) INTO v_today
  FROM withdrawals
  WHERE user_id = p_user_id
    AND status IN ('pending','approved')
    AND created_at::date = CURRENT_DATE;

  IF v_today + p_amount > v_daily_cap THEN
    RAISE EXCEPTION 'Daily withdrawal cap exceeded';
  END IF;

  -- wagering not met or locked balance present -> block
  SELECT COALESCE(wager_required,0), COALESCE(wager_progress,0), COALESCE(locked_balance,0)
    INTO v_wager_required, v_wager_progress, v_locked_balance
  FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_locked_balance > 0 THEN
    RAISE EXCEPTION 'Winnings are locked until wagering is completed';
  END IF;
  IF v_wager_progress < v_wager_required THEN
    RAISE EXCEPTION 'Wagering requirement not met yet';
  END IF;

  -- available balance = balance - pending_withdrawal_hold
  SELECT balance - COALESCE(pending_withdrawal_hold,0) INTO v_available_balance
  FROM users WHERE id = p_user_id;

  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  -- create the withdrawal record
  INSERT INTO withdrawals(user_id, amount, status, bank_name, account_number, account_holder)
  VALUES (p_user_id, p_amount, 'pending', p_bank_name, p_account_number, p_account_holder)
  RETURNING id INTO v_withdrawal_id;

  -- place a withdrawal hold
  UPDATE users
  SET pending_withdrawal_hold = COALESCE(pending_withdrawal_hold,0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- log pending transaction
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (p_user_id, 'withdrawal', -p_amount, 'pending', jsonb_build_object('withdrawal_id', v_withdrawal_id));
  EXCEPTION WHEN undefined_table THEN NULL; END;

  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Update approve_withdrawal to set last_withdrawal_at and daily counters
DROP FUNCTION IF EXISTS approve_withdrawal(UUID);
CREATE OR REPLACE FUNCTION approve_withdrawal(p_withdrawal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_status TEXT;
BEGIN
  SELECT user_id, amount, status INTO v_user_id, v_amount, v_status
  FROM withdrawals WHERE id = p_withdrawal_id;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal is not pending'; END IF;

  UPDATE withdrawals
  SET status = 'approved', approved_at = NOW(), updated_at = NOW()
  WHERE id = p_withdrawal_id;

  UPDATE users
  SET balance = balance - v_amount,
      pending_withdrawal_hold = COALESCE(pending_withdrawal_hold,0) - v_amount,
      last_withdrawal_at = NOW(),
      daily_withdrawn_amount = CASE WHEN daily_withdrawn_date = CURRENT_DATE
                                    THEN COALESCE(daily_withdrawn_amount,0) + v_amount
                                    ELSE v_amount END,
      daily_withdrawn_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE id = v_user_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (v_user_id, 'withdrawal', -v_amount, 'completed', jsonb_build_object('withdrawal_id', p_withdrawal_id));
  EXCEPTION WHEN undefined_table THEN NULL; END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
