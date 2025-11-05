-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id text UNIQUE NOT NULL,
  username text,
  balance numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);

-- Payments table
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  image_url text,
  amount numeric,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Games table
CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_fee numeric NOT NULL DEFAULT 5,
  status text DEFAULT 'waiting',
  prize_pool numeric DEFAULT 0,
  called_numbers jsonb DEFAULT '[]'::jsonb,
  winner_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  started_at timestamp,
  ended_at timestamp
);

-- Game players table
CREATE TABLE game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  card jsonb NOT NULL,
  marked_numbers jsonb DEFAULT '[]'::jsonb,
  is_winner boolean DEFAULT false,
  joined_at timestamp DEFAULT now(),
  UNIQUE(game_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_user_id ON game_players(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

-- Database Functions

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
  winner_prize numeric;
BEGIN
  -- Get prize pool
  SELECT prize_pool INTO prize_amount FROM games WHERE id = game_id;
  
  -- Winner gets 90% (10% commission)
  winner_prize := prize_amount * 0.9;
  
  -- Update winner's balance
  UPDATE users
  SET balance = balance + winner_prize
  WHERE id = winner_user_id;
  
  -- Create transaction history for winner
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    winner_user_id,
    'game_win',
    winner_prize,
    'Won game ' || game_id || ' - Prize: ' || winner_prize || ' Birr'
  );
  
  -- Update game status
  UPDATE games
  SET winner_id = winner_user_id,
      status = 'completed',
      ended_at = now()
  WHERE id = game_id;
END;
$$ LANGUAGE plpgsql;

-- Create policies (allow all for service role, restrict for anon)
CREATE POLICY "Allow all for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON payments FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON games FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON game_players FOR ALL USING (true);
