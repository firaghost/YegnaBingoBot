-- ============================================
-- Deduct stake using bonus balance first, then main balance
-- Creates function: deduct_stake_with_bonus(p_user_id UUID, p_amount NUMERIC)
-- ============================================

CREATE OR REPLACE FUNCTION deduct_stake_with_bonus(
  p_user_id UUID,
  p_amount NUMERIC
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
  -- Lock user row to ensure atomic update
  SELECT COALESCE(bonus_balance, 0), COALESCE(balance, 0), COALESCE(pending_withdrawal_hold, 0)
    INTO v_bonus, v_main, v_pending_hold
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Calculate available main balance (excluding pending withdrawal holds)
  v_available_main := v_main - v_pending_hold;

  -- Check if user has sufficient total available balance (bonus + available main)
  IF v_bonus + v_available_main < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Total: % ETB, Pending Hold: % ETB, Available: % ETB, Requested: % ETB', 
      v_main + v_bonus, v_pending_hold, v_bonus + v_available_main, p_amount;
  END IF;

  -- Deduct from bonus first
  bonus_deducted := LEAST(v_bonus, v_needed);
  v_bonus := v_bonus - bonus_deducted;
  v_needed := v_needed - bonus_deducted;

  -- Deduct the remaining from main balance
  main_deducted := v_needed;
  v_main := v_main - main_deducted;

  -- Persist changes
  UPDATE users
  SET bonus_balance = v_bonus,
      balance = v_main,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Update wagering progress and unlock if requirement met
  BEGIN
    SELECT COALESCE(wager_required,0), COALESCE(wager_progress,0), COALESCE(locked_balance,0)
      INTO v_wager_required, v_wager_progress, v_locked
    FROM users WHERE id = p_user_id FOR UPDATE;

    -- increment progress by the full stake amount
    v_wager_progress := v_wager_progress + p_amount;

    IF v_wager_required > 0 AND v_wager_progress >= v_wager_required THEN
      -- unlock locked winnings and reset wagering counters
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
  EXCEPTION WHEN undefined_column THEN
    -- older schemas without wagering columns
    NULL;
  END;

  -- Log stake transaction with source if transactions table exists
  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, metadata)
    VALUES (p_user_id, 'stake', -p_amount, 'completed', jsonb_build_object('source',
      CASE 
        WHEN main_deducted = 0 THEN 'bonus'
        WHEN bonus_deducted = 0 THEN 'main'
        ELSE 'mixed'
      END
    ));
  EXCEPTION WHEN undefined_table THEN NULL; END;

  total_deducted := bonus_deducted + main_deducted;
  source := CASE 
    WHEN main_deducted = 0 THEN 'bonus'
    WHEN bonus_deducted = 0 THEN 'main'
    ELSE 'mixed'
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
