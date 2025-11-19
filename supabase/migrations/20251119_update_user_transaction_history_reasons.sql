-- Update user_transaction_history view to include rejection reasons

-- Ensure metadata exists on transactions
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Recreate view with reason column
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
  -- New: reason field combining transaction metadata and withdrawals.admin_note
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
