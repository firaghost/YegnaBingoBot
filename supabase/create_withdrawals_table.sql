-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS withdrawals CASCADE;

-- Create withdrawals table
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder VARCHAR(100) NOT NULL,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID
);

-- Add foreign key constraint AFTER table creation
ALTER TABLE withdrawals 
ADD CONSTRAINT fk_withdrawals_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add foreign key for processed_by (optional, can be null)
ALTER TABLE withdrawals 
ADD CONSTRAINT fk_withdrawals_processed_by 
FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;

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

-- Drop any existing versions of the function
DROP FUNCTION IF EXISTS create_withdrawal(UUID, DECIMAL, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS create_withdrawal(UUID, DECIMAL, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_withdrawal(UUID, NUMERIC, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS create_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT);

-- Create function to handle withdrawal creation
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

  -- DON'T deduct balance yet - only deduct on approval
  -- Balance will be deducted in approve_withdrawal function

  -- Create transaction record (if metadata column exists)
  -- Note: Run add_metadata_to_transactions.sql first if this fails
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
      -- Fallback: create transaction without metadata
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

-- Drop any existing versions
DROP FUNCTION IF EXISTS approve_withdrawal(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS approve_withdrawal(UUID, UUID);

-- Create function to approve withdrawal
CREATE OR REPLACE FUNCTION approve_withdrawal(
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

  -- Deduct balance from user (do this on approval, not on submission)
  UPDATE users
  SET balance = balance - v_amount
  WHERE id = v_user_id;

  -- Update withdrawal status (set processed_by to NULL if admin_id doesn't exist)
  UPDATE withdrawals
  SET 
    status = 'approved',
    processed_at = NOW(),
    processed_by = NULL,  -- Set to NULL instead of invalid user ID
    admin_note = p_admin_note
  WHERE id = p_withdrawal_id;

  -- Update transaction status (if metadata column exists)
  BEGIN
    UPDATE transactions
    SET status = 'completed'
    WHERE metadata->>'withdrawal_id' = p_withdrawal_id::TEXT;
  EXCEPTION
    WHEN undefined_column THEN
      -- Fallback: update by user_id and type (most recent pending withdrawal transaction)
      UPDATE transactions
      SET status = 'completed'
      WHERE id = (
        SELECT id FROM transactions
        WHERE user_id = (SELECT user_id FROM withdrawals WHERE id = p_withdrawal_id)
          AND type = 'withdrawal'
          AND status = 'pending'
          AND created_at >= (SELECT created_at FROM withdrawals WHERE id = p_withdrawal_id)
        ORDER BY created_at DESC
        LIMIT 1
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop any existing versions
DROP FUNCTION IF EXISTS reject_withdrawal(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS reject_withdrawal(UUID, UUID);

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

  -- Update withdrawal status (set processed_by to NULL)
  UPDATE withdrawals
  SET 
    status = 'rejected',
    processed_at = NOW(),
    processed_by = NULL,  -- Set to NULL instead of invalid user ID
    admin_note = p_admin_note
  WHERE id = p_withdrawal_id;

  -- NO REFUND needed - balance was never deducted on submission

  -- Update transaction status (if metadata column exists)
  BEGIN
    UPDATE transactions
    SET status = 'rejected'
    WHERE metadata->>'withdrawal_id' = p_withdrawal_id::TEXT;
  EXCEPTION
    WHEN undefined_column THEN
      -- Fallback: update by user_id and type (most recent pending withdrawal transaction)
      UPDATE transactions
      SET status = 'rejected'
      WHERE id = (
        SELECT id FROM transactions
        WHERE user_id = v_user_id
          AND type = 'withdrawal'
          AND status = 'pending'
          AND created_at >= (SELECT created_at FROM withdrawals WHERE id = p_withdrawal_id)
        ORDER BY created_at DESC
        LIMIT 1
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON withdrawals TO authenticated;
GRANT ALL ON withdrawals TO service_role;
