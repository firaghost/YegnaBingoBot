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

  total_deducted := bonus_deducted + main_deducted;
  source := CASE 
    WHEN main_deducted = 0 THEN 'bonus'
    WHEN bonus_deducted = 0 THEN 'main'
    ELSE 'mixed'
  END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
