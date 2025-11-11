-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder VARCHAR(100) NOT NULL,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);

-- Enable RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals"
  ON withdrawals FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create withdrawals
CREATE POLICY "Users can create withdrawals"
  ON withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access to withdrawals"
  ON withdrawals FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to handle withdrawal creation
CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL,
  p_bank_name VARCHAR,
  p_account_number VARCHAR,
  p_account_holder VARCHAR
) RETURNS UUID AS $$
DECLARE
  v_withdrawal_id UUID;
  v_user_balance DECIMAL;
BEGIN
  -- Get user balance
  SELECT balance INTO v_user_balance
  FROM users
  WHERE id = p_user_id;

  -- Check if user has sufficient balance
  IF v_user_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
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

  -- Deduct amount from user balance (hold it)
  UPDATE users
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  -- Create transaction record
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

  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to approve withdrawal
CREATE OR REPLACE FUNCTION approve_withdrawal(
  p_withdrawal_id UUID,
  p_admin_id UUID,
  p_admin_note TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Update withdrawal status
  UPDATE withdrawals
  SET 
    status = 'approved',
    processed_at = NOW(),
    processed_by = p_admin_id,
    admin_note = p_admin_note
  WHERE id = p_withdrawal_id;

  -- Update transaction status
  UPDATE transactions
  SET status = 'completed'
  WHERE metadata->>'withdrawal_id' = p_withdrawal_id::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reject withdrawal
CREATE OR REPLACE FUNCTION reject_withdrawal(
  p_withdrawal_id UUID,
  p_admin_id UUID,
  p_admin_note TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL;
BEGIN
  -- Get withdrawal details
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM withdrawals
  WHERE id = p_withdrawal_id;

  -- Update withdrawal status
  UPDATE withdrawals
  SET 
    status = 'rejected',
    processed_at = NOW(),
    processed_by = p_admin_id,
    admin_note = p_admin_note
  WHERE id = p_withdrawal_id;

  -- Refund amount to user
  UPDATE users
  SET balance = balance + v_amount
  WHERE id = v_user_id;

  -- Update transaction status
  UPDATE transactions
  SET status = 'rejected'
  WHERE metadata->>'withdrawal_id' = p_withdrawal_id::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON withdrawals TO authenticated;
GRANT ALL ON withdrawals TO service_role;
