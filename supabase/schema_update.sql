-- Update existing schema (run this instead of full schema.sql)

-- Add entry_fee column to games table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'entry_fee'
  ) THEN
    ALTER TABLE games ADD COLUMN entry_fee numeric NOT NULL DEFAULT 5;
  END IF;
END $$;

-- Add paid column to game_players table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'game_players' AND column_name = 'paid'
  ) THEN
    ALTER TABLE game_players ADD COLUMN paid boolean DEFAULT false;
  END IF;
END $$;

-- Add selected_numbers column to game_players table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'game_players' AND column_name = 'selected_numbers'
  ) THEN
    ALTER TABLE game_players ADD COLUMN selected_numbers jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  email text,
  created_at timestamp DEFAULT now(),
  last_login timestamp,
  is_active boolean DEFAULT true
);

-- Create transaction_history table
CREATE TABLE IF NOT EXISTS transaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  type text NOT NULL, -- 'deposit', 'withdrawal', 'game_entry', 'game_win', 'transfer_in', 'transfer_out', 'bonus'
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  reference_id uuid, -- game_id, payment_id, etc.
  status text DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'cancelled'
  created_at timestamp DEFAULT now()
);

-- Create game_history table (for completed games)
CREATE TABLE IF NOT EXISTS game_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id),
  user_id uuid REFERENCES users(id),
  entry_fee numeric NOT NULL,
  prize_won numeric DEFAULT 0,
  is_winner boolean DEFAULT false,
  numbers_marked integer DEFAULT 0,
  game_duration interval,
  created_at timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_history_user_id ON transaction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_type ON transaction_history(type);
CREATE INDEX IF NOT EXISTS idx_transaction_history_created_at ON transaction_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_game_id ON game_history(game_id);

-- Insert default admin user (password: YegnaBingo2025!)
-- Password hash generated with bcrypt
INSERT INTO admin_users (username, password_hash, email)
VALUES ('admin', '$2a$10$rKZqYvVxKxqYvVxKxqYvVOe7YvVxKxqYvVxKxqYvVxKxqYvVxKxqY', 'admin@yegnabingo.com')
ON CONFLICT (username) DO NOTHING;

-- Function to log transaction
CREATE OR REPLACE FUNCTION log_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_reference_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  -- Get current balance
  SELECT balance INTO v_balance_before FROM users WHERE id = p_user_id;
  
  -- Calculate new balance
  v_balance_after := v_balance_before;
  IF p_type IN ('deposit', 'game_win', 'transfer_in', 'bonus') THEN
    v_balance_after := v_balance_before + p_amount;
  ELSIF p_type IN ('withdrawal', 'game_entry', 'transfer_out') THEN
    v_balance_after := v_balance_before - p_amount;
  END IF;
  
  -- Insert transaction record
  INSERT INTO transaction_history (
    user_id, type, amount, balance_before, balance_after, description, reference_id
  ) VALUES (
    p_user_id, p_type, p_amount, v_balance_before, v_balance_after, p_description, p_reference_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to deduct balance WITH transaction logging
CREATE OR REPLACE FUNCTION deduct_balance(user_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET balance = balance - amount
  WHERE id = user_id AND balance >= amount;
  
  -- Log transaction
  PERFORM log_transaction(user_id, 'game_entry', amount, 'Game entry fee deducted', NULL);
END;
$$ LANGUAGE plpgsql;

-- Function to add to prize pool
CREATE OR REPLACE FUNCTION add_to_prize_pool(game_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE games
  SET prize_pool = prize_pool + amount
  WHERE id = game_id;
END;
$$ LANGUAGE plpgsql;

-- Function to award prize WITH transaction logging
CREATE OR REPLACE FUNCTION award_prize(winner_user_id uuid, game_id uuid)
RETURNS void AS $$
DECLARE
  prize_amount numeric;
BEGIN
  SELECT prize_pool INTO prize_amount FROM games WHERE id = game_id;
  
  -- Update winner balance
  UPDATE users
  SET balance = balance + prize_amount
  WHERE id = winner_user_id;
  
  -- Log prize win transaction
  PERFORM log_transaction(
    winner_user_id, 
    'game_win', 
    prize_amount, 
    'BINGO! Game prize won', 
    game_id
  );
  
  -- Update game status
  UPDATE games
  SET winner_id = winner_user_id,
      status = 'completed',
      ended_at = now()
  WHERE id = game_id;
  
  -- Log game history for all players
  INSERT INTO game_history (game_id, user_id, entry_fee, prize_won, is_winner, numbers_marked)
  SELECT 
    gp.game_id,
    gp.user_id,
    g.entry_fee,
    CASE WHEN gp.user_id = winner_user_id THEN prize_amount ELSE 0 END,
    gp.user_id = winner_user_id,
    array_length(gp.marked_numbers, 1)
  FROM game_players gp
  JOIN games g ON g.id = gp.game_id
  WHERE gp.game_id = game_id;
END;
$$ LANGUAGE plpgsql;
