-- ============================================
-- THREE-WALLET SYSTEM + SAFE WITHDRAWALS
-- Date: 2025-11-19
-- ============================================

-- 0) Safety: create admin_config table if missing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='admin_config') THEN
    CREATE TABLE admin_config (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by UUID
    );
    CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(config_key);
  END IF;
END $$;

-- 1) Users schema: add bonus_win_balance (and ensure helper columns exist)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bonus_win_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_withdrawal_hold NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wager_required NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wager_progress NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_withdrawal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_withdrawn_date DATE,
  ADD COLUMN IF NOT EXISTS daily_withdrawn_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN users.bonus_win_balance IS 'Winnings generated from bonus funds. Never withdrawable.';

-- 2) Ensure transactions has metadata JSONB (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER TABLE transactions ADD COLUMN metadata JSONB;
  EXCEPTION
    WHEN duplicate_column THEN
      -- column already exists; no-op
      NULL;
    WHEN others THEN
      -- re-raise unexpected exceptions
      RAISE;
  END;
END $$;

-- 3) Config defaults
INSERT INTO admin_config (config_key, config_value) VALUES
 ('min_required_deposit', '50'),
 ('daily_withdrawal_limit', '5000'),
 ('weekly_withdrawal_limit', '20000')
ON CONFLICT (config_key) DO NOTHING;

-- 3b) Apply deposit helper: atomically credit real and bonus balances
DROP FUNCTION IF EXISTS apply_deposit(UUID, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION apply_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_bonus NUMERIC DEFAULT 0
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET balance = COALESCE(balance,0) + COALESCE(p_amount,0),
      bonus_balance = COALESCE(bonus_balance,0) + COALESCE(p_bonus,0),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Recreate stake deduction to log game_id + breakdown
DROP FUNCTION IF EXISTS deduct_stake_with_bonus(UUID, NUMERIC);
CREATE OR REPLACE FUNCTION deduct_stake_with_bonus(
  p_user_id UUID,
  p_amount NUMERIC,
  p_game_id UUID DEFAULT NULL
)
RETURNS TABLE(
  bonus_deducted NUMERIC,
  main_deducted NUMERIC,
  total_deducted NUMERIC,
  source TEXT
) AS $$

DECLARE
  v_bonus NUMERIC;
  v_main NUMERIC;
  v_pending_hold NUMERIC;
  v_available_main NUMERIC;
  v_needed NUMERIC := p_amount;
  v_wager_required NUMERIC;
  v_wager_progress NUMERIC;
  v_locked NUMERIC;
BEGIN
  -- Lock the user row
  SELECT COALESCE(bonus_balance, 0), COALESCE(balance, 0), COALESCE(pending_withdrawal_hold, 0)
    INTO v_bonus, v_main, v_pending_hold
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  v_available_main := v_main - v_pending_hold;

  IF v_bonus + v_available_main < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Total: % ETB, Pending Hold: % ETB, Available: % ETB, Requested: % ETB',
      v_main + v_bonus, v_pending_hold, v_bonus + v_available_main, p_amount;
  END IF;

  -- Deduct from bonus first
  bonus_deducted := LEAST(v_bonus, v_needed);
  v_bonus := v_bonus - bonus_deducted;
  v_needed := v_needed - bonus_deducted;

  -- Deduct remaining from real balance
  main_deducted := v_needed;
  v_main := v_main - main_deducted;

  -- Persist
  UPDATE users
  SET bonus_balance = v_bonus,
      balance = v_main,
      updated_at = NOW()
  WHERE id = p_user_id;

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
          balance = balance + COALESCE(locked_balance,0),
          locked_balance = 0,
          updated_at = NOW()
      WHERE id = p_user_id;
    ELSE
      UPDATE users
      SET wager_progress = v_wager_progress,
          updated_at = NOW()
      WHERE id = p_user_id;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      -- Some older schemas may not have these wagering columns; ignore
      NULL;
    WHEN others THEN
      RAISE;
  END;

  -- Log stake transaction with breakdown
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
        'source', source,
        'bonus_deducted', bonus_deducted,
        'main_deducted', main_deducted,
        'total_deducted', total_deducted
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- transactions table missing in some environments: ignore
      NULL;
    WHEN undefined_column THEN
      -- metadata or game_id column missing: fallback without them
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_user_id, 'stake', -p_amount, 'completed');
    WHEN others THEN
      -- re-raise unexpected errors
      RAISE;
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 5) Compute real-only prize pool based on main_deducted stakes
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
      -- If no metadata column, approximate with total stakes (unsafe, but legacy)
      SELECT COALESCE(SUM(-amount), 0) INTO v_pool
      FROM transactions
      WHERE game_id = p_game_id AND type = 'stake' AND status = 'completed';
    WHEN others THEN
      RAISE;
  END;
  RETURN COALESCE(v_pool, 0);
END;
$$ LANGUAGE plpgsql;

-- 6) Credit win: split into real vs bonus_win based on stake breakdown
DROP FUNCTION IF EXISTS credit_win(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION credit_win(
  p_user_id UUID,
  p_game_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_source TEXT;
  v_bonus_deducted NUMERIC := 0;
  v_main_deducted NUMERIC := 0;
  v_total_deducted NUMERIC := 0;
  v_bonus_share NUMERIC := 0;
  v_real_share NUMERIC := 0;
  v_has_deposit BOOLEAN := FALSE;
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
      -- No metadata in legacy schema: assume fully real
      v_source := 'main'; v_main_deducted := 1; v_total_deducted := 1; v_bonus_deducted := 0;
    WHEN NO_DATA_FOUND THEN
      -- If no stake found, fail safe credit to real balance only
      v_source := 'main'; v_main_deducted := 1; v_total_deducted := 1; v_bonus_deducted := 0;
    WHEN others THEN
      RAISE;
  END;

  IF v_total_deducted <= 0 THEN v_total_deducted := v_bonus_deducted + v_main_deducted; END IF;
  IF v_total_deducted <= 0 THEN v_total_deducted := 1; END IF;

  v_bonus_share := ROUND((p_amount * (v_bonus_deducted / v_total_deducted))::NUMERIC, 2);
  v_real_share := ROUND((p_amount - v_bonus_share)::NUMERIC, 2);

  -- Always credit bonus-derived share into bonus_win_balance (never withdrawable)
  UPDATE users
  SET bonus_win_balance = COALESCE(bonus_win_balance,0) + v_bonus_share,
      balance = COALESCE(balance,0) + v_real_share,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Log transactions
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (p_user_id, 'win', v_real_share, 'completed', p_game_id, jsonb_build_object('credited_to','real'));
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN undefined_column THEN
      NULL;
    WHEN others THEN
      RAISE;
  END;

  IF v_bonus_share > 0 THEN
    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
      VALUES (p_user_id, 'win', v_bonus_share, 'completed', p_game_id, jsonb_build_object('credited_to','bonus_win'));
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN undefined_column THEN
        NULL;
      WHEN others THEN
        RAISE;
    END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7) Safe create_withdrawal: enforce deposit requirement + daily/weekly caps; withdraw from real only
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
  v_week NUMERIC;
  v_daily_cap NUMERIC := 0;
  v_weekly_cap NUMERIC := 0;
  v_available_balance NUMERIC;
  v_min_required_deposit NUMERIC := 50;
  v_sum_deposits NUMERIC := 0;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  -- Load caps from admin_config (fallbacks)
  BEGIN
    SELECT COALESCE((SELECT config_value FROM admin_config WHERE config_key='daily_withdrawal_limit' AND is_active=true)::NUMERIC, 5000)
      INTO v_daily_cap;
  EXCEPTION
    WHEN others THEN
      v_daily_cap := 5000;
  END;
  BEGIN
    SELECT COALESCE((SELECT config_value FROM admin_config WHERE config_key='weekly_withdrawal_limit' AND is_active=true)::NUMERIC, 20000)
      INTO v_weekly_cap;
  EXCEPTION
    WHEN others THEN
      v_weekly_cap := 20000;
  END;
  BEGIN
    SELECT COALESCE((SELECT config_value FROM admin_config WHERE config_key='min_required_deposit' AND is_active=true)::NUMERIC, 50)
      INTO v_min_required_deposit;
  EXCEPTION
    WHEN others THEN
      v_min_required_deposit := 50;
  END;

  -- Require at least one real deposit totaling >= min_required_deposit before any withdrawal
  SELECT COALESCE(SUM(amount),0) INTO v_sum_deposits
  FROM transactions
  WHERE user_id = p_user_id AND type = 'deposit' AND status = 'completed';

  IF v_sum_deposits < v_min_required_deposit THEN
    RAISE EXCEPTION 'You need to make a real deposit before withdrawals unlock. Bonus winnings cannot be withdrawn until your first deposit.';
  END IF;

  -- One pending at a time
  SELECT COUNT(*) INTO v_pending_count FROM withdrawals WHERE user_id = p_user_id AND status = 'pending';
  IF v_pending_count > 0 THEN RAISE EXCEPTION 'You already have a pending withdrawal'; END IF;

  -- 24h cooldown
  SELECT MAX(approved_at) INTO v_last_approved FROM withdrawals WHERE user_id = p_user_id AND status = 'approved';
  IF v_last_approved IS NOT NULL AND NOW() - v_last_approved < INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'You can only withdraw once every 24 hours';
  END IF;

  -- Daily cap (pending + approved today)
  SELECT COALESCE(SUM(amount),0) INTO v_today
  FROM withdrawals
  WHERE user_id = p_user_id AND status IN ('pending','approved') AND created_at::date = CURRENT_DATE;
  IF v_today + p_amount > v_daily_cap THEN RAISE EXCEPTION 'Daily withdrawal cap exceeded'; END IF;

  -- Weekly cap (Mon-Sun)
  SELECT COALESCE(SUM(amount),0) INTO v_week
  FROM withdrawals
  WHERE user_id = p_user_id AND status IN ('pending','approved') AND date_trunc('week', created_at) = date_trunc('week', NOW());
  IF v_week + p_amount > v_weekly_cap THEN RAISE EXCEPTION 'Weekly withdrawal cap exceeded'; END IF;

  -- Available (real) balance only
  SELECT balance - COALESCE(pending_withdrawal_hold,0) INTO v_available_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_available_balance < p_amount THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;

  -- Create withdrawal and place hold
  INSERT INTO withdrawals(user_id, amount, status, bank_name, account_number, account_holder)
  VALUES (p_user_id, p_amount, 'pending', p_bank_name, p_account_number, p_account_holder)
  RETURNING id INTO v_withdrawal_id;

  UPDATE users
  SET pending_withdrawal_hold = COALESCE(pending_withdrawal_hold,0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (p_user_id, 'withdrawal', -p_amount, 'pending', jsonb_build_object('withdrawal_id', v_withdrawal_id));
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN undefined_column THEN
      NULL;
    WHEN others THEN
      RAISE;
  END;

  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8) Helper: one-time reclassification for legacy users (RUN MANUALLY IF NEEDED)
-- This moves balances of users who never deposited into bonus_win_balance, making real balance zero.
-- Uncomment to run once, then comment again.
-- DO $$
-- BEGIN
--   UPDATE users u
--   SET bonus_win_balance = COALESCE(bonus_win_balance,0) + COALESCE(u.balance,0),
--       balance = 0,
--       updated_at = NOW()
--   WHERE COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id=u.id AND t.type='deposit' AND t.status='completed'),0) = 0
--     AND COALESCE(u.balance,0) > 0;
-- END $$;

-- 9) Note: Prize calculation must call compute_real_prize_pool(game_id) and credit via credit_win()
-- ============================================