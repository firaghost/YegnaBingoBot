-- Fix reject_withdrawal function to use 'failed' instead of 'rejected' for transactions
-- This is needed because transactions table only allows: 'pending', 'completed', 'failed'

DROP FUNCTION IF EXISTS reject_withdrawal(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS reject_withdrawal(UUID, UUID);

-- Recreate function to reject withdrawal with correct transaction status
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

  -- Update transaction status to 'failed' (not 'rejected' which violates constraint)
  BEGIN
    UPDATE transactions
    SET status = 'failed'
    WHERE metadata->>'withdrawal_id' = p_withdrawal_id::TEXT;
  EXCEPTION
    WHEN undefined_column THEN
      -- Fallback: update by user_id and type (most recent pending withdrawal transaction)
      UPDATE transactions
      SET status = 'failed'
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
GRANT EXECUTE ON FUNCTION reject_withdrawal(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reject_withdrawal(UUID, UUID, TEXT) TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed reject_withdrawal function to use "failed" status for transactions';
END $$;
