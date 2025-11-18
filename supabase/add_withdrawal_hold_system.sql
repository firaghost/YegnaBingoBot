-- ============================================
-- WITHDRAWAL HOLD SYSTEM
-- ============================================
-- This migration adds a withdrawal hold system to prevent users from
-- spending money that they've requested to withdraw.

-- Drop existing functions that will be recreated
DROP FUNCTION IF EXISTS get_available_balance(UUID) CASCADE;
DROP FUNCTION IF EXISTS create_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS approve_withdrawal(UUID) CASCADE;
DROP FUNCTION IF EXISTS reject_withdrawal(UUID) CASCADE;
DROP FUNCTION IF EXISTS deduct_balance(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS deduct_balance(UUID, NUMERIC) CASCADE;
DROP VIEW IF EXISTS user_balance_info CASCADE;

-- Add pending_withdrawal_hold column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS pending_withdrawal_hold DECIMAL DEFAULT 0;

-- Create function to calculate available balance
CREATE OR REPLACE FUNCTION get_available_balance(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
  v_hold DECIMAL;
BEGIN
  SELECT balance, COALESCE(pending_withdrawal_hold, 0)
  INTO v_balance, v_hold
  FROM users
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_balance, 0) - COALESCE(v_hold, 0);
END;
$$ LANGUAGE plpgsql;

-- Update create_withdrawal to hold the balance
CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_account_holder TEXT
) RETURNS UUID AS $$
DECLARE
  v_withdrawal_id UUID;
  v_user_balance DECIMAL;
  v_available_balance DECIMAL;
BEGIN
  -- Get user balance and calculate available balance
  SELECT balance, COALESCE(pending_withdrawal_hold, 0)
  INTO v_user_balance, v_available_balance
  FROM users
  WHERE id = p_user_id;

  v_available_balance := v_user_balance - v_available_balance;

  -- Check if user has sufficient AVAILABLE balance
  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance. Available: % ETB, Requested: % ETB', v_available_balance, p_amount;
  END IF;

  -- Create withdrawal record
  INSERT INTO withdrawals (
    user_id,
    amount,
    status,
    bank_name,
    account_number,
    account_holder
  ) VALUES (
    p_user_id,
    p_amount,
    'pending',
    p_bank_name,
    p_account_number,
    p_account_holder
  ) RETURNING id INTO v_withdrawal_id;

  -- HOLD the balance - add to pending_withdrawal_hold
  UPDATE users
  SET pending_withdrawal_hold = COALESCE(pending_withdrawal_hold, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Create transaction record
  BEGIN
    INSERT INTO transactions (
      user_id,
      type,
      amount,
      status,
      metadata
    ) VALUES (
      p_user_id,
      'withdrawal',
      -p_amount,
      'pending',
      jsonb_build_object(
        'withdrawal_id', v_withdrawal_id,
        'bank_name', p_bank_name,
        'account_number', p_account_number
      )
    );
  EXCEPTION
    WHEN undefined_column THEN
      INSERT INTO transactions (
        user_id,
        type,
        amount,
        status
      ) VALUES (
        p_user_id,
        'withdrawal',
        -p_amount,
        'pending'
      );
  END;

  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update approve_withdrawal to release hold and deduct balance
CREATE OR REPLACE FUNCTION approve_withdrawal(p_withdrawal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
  v_status TEXT;
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

  -- Create completion transaction
  BEGIN
    INSERT INTO transactions (
      user_id,
      type,
      amount,
      status,
      metadata
    ) VALUES (
      v_user_id,
      'withdrawal',
      -v_amount,
      'completed',
      jsonb_build_object('withdrawal_id', p_withdrawal_id)
    );
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reject withdrawal and release hold
CREATE OR REPLACE FUNCTION reject_withdrawal(p_withdrawal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
  v_status TEXT;
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

  -- Update withdrawal status
  UPDATE withdrawals
  SET status = 'rejected',
      processed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_withdrawal_id;

  -- Release the hold (don't deduct balance)
  UPDATE users
  SET pending_withdrawal_hold = COALESCE(pending_withdrawal_hold, 0) - v_amount,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deduct_balance to check available balance (not just balance)
CREATE OR REPLACE FUNCTION deduct_balance(p_user_id UUID, p_amount DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
  v_available_balance DECIMAL;
BEGIN
  -- Get available balance (balance - pending holds)
  SELECT balance - COALESCE(pending_withdrawal_hold, 0)
  INTO v_available_balance
  FROM users
  WHERE id = p_user_id;

  IF v_available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  -- Deduct from balance
  UPDATE users
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for user balance info
CREATE OR REPLACE VIEW user_balance_info AS
SELECT
  id,
  username,
  telegram_id,
  balance,
  COALESCE(pending_withdrawal_hold, 0) as pending_withdrawal_hold,
  balance - COALESCE(pending_withdrawal_hold, 0) as available_balance,
  updated_at
FROM users;

-- Add index for faster withdrawal queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status
ON withdrawals(user_id, status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status
ON withdrawals(status);

-- Log the changes
SELECT 'WITHDRAWAL HOLD SYSTEM INSTALLED SUCCESSFULLY!' as status;
SELECT 'New column: users.pending_withdrawal_hold' as changes;
SELECT 'New functions: get_available_balance, approve_withdrawal, reject_withdrawal' as functions;
SELECT 'New view: user_balance_info' as views;
