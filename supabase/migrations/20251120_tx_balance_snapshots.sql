-- Transaction balance snapshots: store real balance before/after per transaction
-- Date: 2025-11-20

-- 1) Ensure transactions has metadata JSONB
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2) Recreate deduct_stake_with_bonus to include real balance before/after in metadata
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
  v_real_before NUMERIC;
  v_real_after NUMERIC;
BEGIN
  -- Lock the user row and capture current balances
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

  v_real_before := v_main; -- before deduction

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

  v_real_after := v_main; -- after deduction

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
      NULL;
    WHEN others THEN
      RAISE;
  END;

  -- Log stake transaction with breakdown and balance snapshot
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
        'total_deducted', total_deducted,
        'real_balance_before', v_real_before,
        'real_balance_after', v_real_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN undefined_column THEN
      INSERT INTO transactions(user_id, type, amount, status)
      VALUES (p_user_id, 'stake', -p_amount, 'completed');
    WHEN others THEN
      RAISE;
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 3) Recreate credit_win to include real/bonus_win balance snapshots
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
  v_real_before NUMERIC := 0;
  v_real_after NUMERIC := 0;
  v_bonus_win_before NUMERIC := 0;
  v_bonus_win_after NUMERIC := 0;
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
      v_source := 'main'; v_main_deducted := 1; v_total_deducted := 1; v_bonus_deducted := 0;
    WHEN NO_DATA_FOUND THEN
      v_source := 'main'; v_main_deducted := 1; v_total_deducted := 1; v_bonus_deducted := 0;
    WHEN others THEN
      RAISE;
  END;

  IF v_total_deducted <= 0 THEN v_total_deducted := v_bonus_deducted + v_main_deducted; END IF;
  IF v_total_deducted <= 0 THEN v_total_deducted := 1; END IF;

  v_bonus_share := ROUND((p_amount * (v_bonus_deducted / v_total_deducted))::NUMERIC, 2);
  v_real_share := ROUND((p_amount - v_bonus_share)::NUMERIC, 2);

  -- Capture balances before update
  SELECT COALESCE(balance,0), COALESCE(bonus_win_balance,0)
    INTO v_real_before, v_bonus_win_before
  FROM users WHERE id = p_user_id FOR UPDATE;

  -- Always credit bonus-derived share into bonus_win_balance
  UPDATE users
  SET bonus_win_balance = COALESCE(bonus_win_balance,0) + v_bonus_share,
      balance = COALESCE(balance,0) + v_real_share,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Capture balances after update
  SELECT COALESCE(balance,0), COALESCE(bonus_win_balance,0)
    INTO v_real_after, v_bonus_win_after
  FROM users WHERE id = p_user_id;

  -- Log transactions
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (p_user_id, 'win', v_real_share, 'completed', p_game_id,
      jsonb_build_object('credited_to','real', 'real_balance_before', v_real_before, 'real_balance_after', v_real_after)
    );
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN others THEN RAISE; END;

  IF v_bonus_share > 0 THEN
    BEGIN
      INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
      VALUES (p_user_id, 'win', v_bonus_share, 'completed', p_game_id,
        jsonb_build_object('credited_to','bonus_win', 'bonus_win_balance_before', v_bonus_win_before, 'bonus_win_balance_after', v_bonus_win_after)
      );
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; WHEN others THEN RAISE; END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Recreate approve_withdrawal to include real balance snapshots
DROP FUNCTION IF EXISTS approve_withdrawal(UUID);
CREATE OR REPLACE FUNCTION approve_withdrawal(p_withdrawal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_status TEXT;
  v_real_before NUMERIC := 0;
  v_real_after NUMERIC := 0;
BEGIN
  -- Get withdrawal details
  SELECT user_id, amount, status
  INTO v_user_id, v_amount, v_status
  FROM withdrawals
  WHERE id = p_withdrawal_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal is not pending';
  END IF;

  -- Capture real balance before
  SELECT COALESCE(balance,0) INTO v_real_before FROM users WHERE id = v_user_id FOR UPDATE;

  -- Update withdrawal status
  UPDATE withdrawals
  SET status = 'approved',
      processed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_withdrawal_id;

  -- Deduct from balance AND release from hold
  UPDATE users
  SET balance = balance - v_amount,
      pending_withdrawal_hold = COALESCE(pending_withdrawal_hold, 0) - v_amount,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Capture real balance after
  SELECT COALESCE(balance,0) INTO v_real_after FROM users WHERE id = v_user_id;

  -- Create completion transaction with snapshots
  BEGIN
    INSERT INTO transactions (
      user_id, type, amount, status, metadata
    ) VALUES (
      v_user_id,
      'withdrawal',
      -v_amount,
      'completed',
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'real_balance_before', v_real_before, 'real_balance_after', v_real_after)
    );
  EXCEPTION WHEN undefined_column THEN NULL; WHEN undefined_table THEN NULL; WHEN others THEN RAISE; END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Update user_transaction_history view to expose balance snapshots
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
    ELSE 'neutral'
  END as display_status
FROM transactions t
LEFT JOIN games g ON t.game_id = g.id
LEFT JOIN rooms r ON g.room_id = r.id
LEFT JOIN withdrawals w ON (t.type = 'withdrawal' AND (t.metadata->>'withdrawal_id')::uuid = w.id)
ORDER BY t.created_at DESC;
