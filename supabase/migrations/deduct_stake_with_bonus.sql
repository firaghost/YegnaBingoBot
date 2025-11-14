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
  v_needed NUMERIC := p_amount;
BEGIN
  -- Lock user row to ensure atomic update
  SELECT COALESCE(bonus_balance, 0), COALESCE(balance, 0)
    INTO v_bonus, v_main
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_bonus + v_main < p_amount THEN
    RAISE EXCEPTION 'Insufficient total balance';
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
