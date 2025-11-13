-- ============================================
-- FIX USER STATS AND IMPROVE TRANSACTIONS
-- ============================================

-- 1. Create function to add XP to user
CREATE OR REPLACE FUNCTION add_user_xp(user_id UUID, xp_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET xp = COALESCE(xp, 0) + xp_amount,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Create function to track game participation (both wins and losses)
CREATE OR REPLACE FUNCTION track_game_participation(
  p_user_id UUID,
  p_game_id UUID,
  p_won BOOLEAN,
  p_stake DECIMAL DEFAULT 0,
  p_winnings DECIMAL DEFAULT 0,
  p_game_level TEXT DEFAULT 'medium'
)
RETURNS void AS $$
BEGIN
  -- Update games_played for everyone who participates
  UPDATE users
  SET games_played = games_played + 1,
      games_won = CASE WHEN p_won THEN games_won + 1 ELSE games_won END,
      total_winnings = CASE WHEN p_won THEN total_winnings + p_winnings ELSE total_winnings END,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Create detailed transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    game_id,
    status,
    metadata
  ) VALUES (
    p_user_id,
    CASE WHEN p_won THEN 'win' ELSE 'loss' END,
    CASE WHEN p_won THEN p_winnings ELSE -p_stake END,
    p_game_id,
    'completed',
    jsonb_build_object(
      'game_level', p_game_level,
      'stake_amount', p_stake,
      'win_amount', CASE WHEN p_won THEN p_winnings ELSE 0 END,
      'result', CASE WHEN p_won THEN 'WIN' ELSE 'LOSS' END,
      'description', CASE 
        WHEN p_won THEN 'Game Win - ' || p_game_level || ' level'
        ELSE 'Game Loss - ' || p_game_level || ' level'
      END
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Improve transaction metadata for better history display
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS game_level TEXT,
ADD COLUMN IF NOT EXISTS result TEXT;

-- 4. Update existing transactions to have better descriptions
UPDATE transactions 
SET description = CASE 
  WHEN type = 'win' THEN 'Bingo Game Win'
  WHEN type = 'stake' THEN 'Game Entry Fee'
  WHEN type = 'deposit' THEN 'Account Deposit'
  WHEN type = 'withdrawal' THEN 'Account Withdrawal'
  WHEN type = 'bonus' THEN 'Bonus Credit'
  ELSE 'Transaction'
END
WHERE description IS NULL;

UPDATE transactions 
SET result = CASE 
  WHEN type = 'win' THEN 'WIN'
  WHEN type = 'stake' THEN 'LOSS'
  ELSE 'NEUTRAL'
END
WHERE result IS NULL;

-- 5. Create view for enhanced transaction history
CREATE OR REPLACE VIEW user_transaction_history AS
SELECT 
  t.id,
  t.user_id,
  t.type,
  t.amount,
  t.description,
  t.result,
  t.game_level,
  t.status,
  t.created_at,
  g.room_id,
  r.name as room_name,
  CASE 
    WHEN t.type = 'win' THEN '🏆 Game Win'
    WHEN t.type = 'stake' THEN '🎮 Game Entry'
    WHEN t.type = 'deposit' THEN '💸 Deposit'
    WHEN t.type = 'withdrawal' THEN '💰 Withdrawal'
    WHEN t.type = 'bonus' THEN '🎁 Bonus'
    ELSE '📝 Transaction'
  END as display_icon,
  CASE 
    WHEN t.amount > 0 THEN '+' || t.amount::TEXT || ' ETB'
    ELSE t.amount::TEXT || ' ETB'
  END as display_amount,
  CASE 
    WHEN t.type = 'win' THEN 'success'
    WHEN t.type = 'stake' THEN 'loss'
    WHEN t.type = 'deposit' THEN 'success'
    WHEN t.type = 'withdrawal' THEN 'neutral'
    WHEN t.type = 'bonus' THEN 'success'
    ELSE 'neutral'
  END as display_status
FROM transactions t
LEFT JOIN games g ON t.game_id = g.id
LEFT JOIN rooms r ON g.room_id = r.id
ORDER BY t.created_at DESC;

-- 6. Success message
SELECT 'STATS AND TRANSACTIONS SYSTEM IMPROVED!' as status;
SELECT 'Functions: add_user_xp, track_game_participation' as functions;
SELECT 'View: user_transaction_history with enhanced display' as views;
SELECT 'Transactions now show: WIN/LOSS, game level, detailed descriptions' as improvements;
