-- Enhanced Bingo Royale Schema
-- Additional tables for the new implementation

-- Rooms table (for different game types)
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stake NUMERIC(10,2) NOT NULL,
  max_players INT NOT NULL DEFAULT 500,
  current_players INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  description TEXT,
  color TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default rooms
INSERT INTO rooms (id, name, stake, max_players, description, color) VALUES
  ('classic', 'Classic Room', 10, 500, 'Perfect for beginners. Standard pace, great prizes!', 'from-blue-500 to-blue-700'),
  ('speed', 'Speed Bingo', 5, 200, 'Fast-paced action! Numbers called every 2 seconds.', 'from-green-500 to-green-700'),
  ('mega', 'Mega Jackpot', 50, 1000, 'Huge prizes! High stakes, massive rewards.', 'from-purple-500 to-purple-700')
ON CONFLICT (id) DO NOTHING;

-- Transactions table (enhanced)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('stake', 'win', 'deposit', 'withdrawal')),
  amount NUMERIC(10,2) NOT NULL,
  game_id UUID REFERENCES games(id),
  status TEXT DEFAULT 'completed',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  total_wins INT DEFAULT 0,
  total_winnings NUMERIC(10,2) DEFAULT 0,
  games_played INT DEFAULT 0,
  rank INT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('min_withdrawal', '100', 'Minimum withdrawal amount in ETB'),
  ('max_withdrawal', '50000', 'Maximum withdrawal amount in ETB'),
  ('commission_rate', '0.10', 'House commission rate (10%)'),
  ('auto_start_players', '2', 'Minimum players to auto-start game'),
  ('game_countdown', '10', 'Countdown seconds before game starts'),
  ('number_call_interval', '3', 'Seconds between number calls')
ON CONFLICT (key) DO NOTHING;

-- Update existing users table to add new fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS games_played INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS games_won INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_winnings NUMERIC(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank INT;

-- Update existing games table to add new fields
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_id TEXT REFERENCES rooms(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS countdown_time INT DEFAULT 10;
ALTER TABLE games ADD COLUMN IF NOT EXISTS latest_number JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS bots JSONB DEFAULT '[]'::jsonb;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_winnings ON leaderboard(total_winnings DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);

-- Enable Row Level Security on new tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
CREATE POLICY "Allow read access to rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Allow service role all access to rooms" ON rooms FOR ALL USING (true);

CREATE POLICY "Allow users to view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow service role all access to transactions" ON transactions FOR ALL USING (true);

CREATE POLICY "Allow read access to leaderboard" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Allow service role all access to leaderboard" ON leaderboard FOR ALL USING (true);

CREATE POLICY "Allow users to view own withdrawals" ON withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to create withdrawals" ON withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow service role all access to withdrawals" ON withdrawals FOR ALL USING (true);

CREATE POLICY "Allow service role all access to admin_users" ON admin_users FOR ALL USING (true);
CREATE POLICY "Allow read access to system_settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Allow service role all access to system_settings" ON system_settings FOR ALL USING (true);

-- Function to update leaderboard
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS void AS $$
BEGIN
  -- Clear and rebuild leaderboard
  TRUNCATE leaderboard;
  
  INSERT INTO leaderboard (user_id, username, total_wins, total_winnings, games_played, rank)
  SELECT 
    u.id,
    u.username,
    u.games_won,
    u.total_winnings,
    u.games_played,
    ROW_NUMBER() OVER (ORDER BY u.total_winnings DESC, u.games_won DESC) as rank
  FROM users u
  WHERE u.games_played > 0
  ORDER BY u.total_winnings DESC, u.games_won DESC
  LIMIT 100;
  
  -- Update users table with their rank
  UPDATE users u
  SET rank = l.rank
  FROM leaderboard l
  WHERE u.id = l.user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process game win
CREATE OR REPLACE FUNCTION process_game_win(
  p_game_id UUID,
  p_winner_id UUID
)
RETURNS void AS $$
DECLARE
  v_prize_pool NUMERIC;
  v_winner_prize NUMERIC;
  v_commission NUMERIC;
  v_room_id TEXT;
BEGIN
  -- Get game details
  SELECT prize_pool, room_id INTO v_prize_pool, v_room_id
  FROM games WHERE id = p_game_id;
  
  -- Calculate prizes (90% to winner, 10% commission)
  v_winner_prize := v_prize_pool * 0.9;
  v_commission := v_prize_pool * 0.1;
  
  -- Update winner's balance and stats
  UPDATE users
  SET 
    balance = balance + v_winner_prize,
    games_won = games_won + 1,
    total_winnings = total_winnings + v_winner_prize
  WHERE id = p_winner_id;
  
  -- Create win transaction
  INSERT INTO transactions (user_id, type, amount, game_id, description)
  VALUES (
    p_winner_id,
    'win',
    v_winner_prize,
    p_game_id,
    'Won game in ' || v_room_id || ' room'
  );
  
  -- Update game
  UPDATE games
  SET 
    winner_id = p_winner_id,
    status = 'completed',
    ended_at = NOW()
  WHERE id = p_game_id;
  
  -- Update game_players
  UPDATE game_players
  SET is_winner = true
  WHERE game_id = p_game_id AND user_id = p_winner_id;
  
  -- Update all players' games_played count
  UPDATE users u
  SET games_played = games_played + 1
  FROM game_players gp
  WHERE gp.user_id = u.id AND gp.game_id = p_game_id;
  
  -- Update leaderboard
  PERFORM update_leaderboard();
END;
$$ LANGUAGE plpgsql;

-- Function to join game
CREATE OR REPLACE FUNCTION join_game(
  p_user_id UUID,
  p_room_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_game_id UUID;
  v_stake NUMERIC;
  v_user_balance NUMERIC;
  v_card JSONB;
BEGIN
  -- Get room stake
  SELECT stake INTO v_stake FROM rooms WHERE id = p_room_id;
  
  -- Check user balance
  SELECT balance INTO v_user_balance FROM users WHERE id = p_user_id;
  
  IF v_user_balance < v_stake THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Find or create game
  SELECT id INTO v_game_id
  FROM games
  WHERE room_id = p_room_id 
    AND status = 'waiting'
    AND (SELECT COUNT(*) FROM game_players WHERE game_id = games.id) < (SELECT max_players FROM rooms WHERE id = p_room_id)
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_game_id IS NULL THEN
    -- Create new game
    INSERT INTO games (room_id, entry_fee, status, prize_pool)
    VALUES (p_room_id, v_stake, 'waiting', 0)
    RETURNING id INTO v_game_id;
  END IF;
  
  -- Generate bingo card (simplified - in production, use proper algorithm)
  v_card := jsonb_build_array(
    jsonb_build_array(1, 2, 3, 4, 5),
    jsonb_build_array(16, 17, 18, 19, 20),
    jsonb_build_array(31, 32, 0, 34, 35),
    jsonb_build_array(46, 47, 48, 49, 50),
    jsonb_build_array(61, 62, 63, 64, 65)
  );
  
  -- Deduct stake from user
  UPDATE users SET balance = balance - v_stake WHERE id = p_user_id;
  
  -- Add to prize pool
  UPDATE games SET prize_pool = prize_pool + v_stake WHERE id = v_game_id;
  
  -- Create transaction
  INSERT INTO transactions (user_id, type, amount, game_id, description)
  VALUES (p_user_id, 'stake', -v_stake, v_game_id, 'Joined game in ' || p_room_id || ' room');
  
  -- Add player to game
  INSERT INTO game_players (game_id, user_id, card, paid)
  VALUES (v_game_id, p_user_id, v_card, true);
  
  RETURN v_game_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create withdrawal request
CREATE OR REPLACE FUNCTION create_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_account_holder TEXT
)
RETURNS UUID AS $$
DECLARE
  v_withdrawal_id UUID;
  v_user_balance NUMERIC;
  v_min_withdrawal NUMERIC;
  v_max_withdrawal NUMERIC;
BEGIN
  -- Get settings
  SELECT (value::text)::numeric INTO v_min_withdrawal FROM system_settings WHERE key = 'min_withdrawal';
  SELECT (value::text)::numeric INTO v_max_withdrawal FROM system_settings WHERE key = 'max_withdrawal';
  
  -- Check amount limits
  IF p_amount < v_min_withdrawal THEN
    RAISE EXCEPTION 'Amount below minimum withdrawal limit';
  END IF;
  
  IF p_amount > v_max_withdrawal THEN
    RAISE EXCEPTION 'Amount exceeds maximum withdrawal limit';
  END IF;
  
  -- Check user balance
  SELECT balance INTO v_user_balance FROM users WHERE id = p_user_id;
  
  IF v_user_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct from balance (hold until approved)
  UPDATE users SET balance = balance - p_amount WHERE id = p_user_id;
  
  -- Create withdrawal request
  INSERT INTO withdrawals (user_id, amount, bank_name, account_number, account_holder, status)
  VALUES (p_user_id, p_amount, p_bank_name, p_account_number, p_account_holder, 'pending')
  RETURNING id INTO v_withdrawal_id;
  
  -- Create transaction
  INSERT INTO transactions (user_id, type, amount, description, status)
  VALUES (p_user_id, 'withdrawal', -p_amount, 'Withdrawal request', 'pending');
  
  RETURN v_withdrawal_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leaderboard after game completion
CREATE OR REPLACE FUNCTION trigger_update_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    PERFORM update_leaderboard();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leaderboard_on_game_complete
AFTER UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION trigger_update_leaderboard();
