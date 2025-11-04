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

-- Function to deduct balance
CREATE OR REPLACE FUNCTION deduct_balance(user_id uuid, amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET balance = balance - amount
  WHERE id = user_id AND balance >= amount;
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

-- Function to award prize
CREATE OR REPLACE FUNCTION award_prize(winner_user_id uuid, game_id uuid)
RETURNS void AS $$
DECLARE
  prize_amount numeric;
BEGIN
  SELECT prize_pool INTO prize_amount FROM games WHERE id = game_id;
  
  UPDATE users
  SET balance = balance + prize_amount
  WHERE id = winner_user_id;
  
  UPDATE games
  SET winner_id = winner_user_id,
      status = 'completed',
      ended_at = now()
  WHERE id = game_id;
END;
$$ LANGUAGE plpgsql;
