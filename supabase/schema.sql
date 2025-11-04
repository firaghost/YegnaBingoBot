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

-- Create policies (allow all for service role, restrict for anon)
CREATE POLICY "Allow all for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON payments FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON games FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON game_players FOR ALL USING (true);
