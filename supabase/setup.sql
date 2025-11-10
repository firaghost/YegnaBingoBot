-- ============================================
-- BINGO ROYALE - COMPLETE DATABASE SETUP
-- Run this script in Supabase SQL Editor
-- ============================================

-- Drop all existing tables and objects
DROP TABLE IF EXISTS player_cards CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS broadcasts CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS leaderboard_view CASCADE;
DROP FUNCTION IF EXISTS add_balance(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS deduct_balance(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS update_user_stats(UUID, BOOLEAN, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS update_room_player_count(TEXT) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_games() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 1000.00,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_winnings DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_total_winnings ON users(total_winnings DESC);

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stake DECIMAL(10, 2) NOT NULL,
  max_players INTEGER NOT NULL,
  current_players INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'maintenance')),
  description TEXT,
  color TEXT DEFAULT 'from-blue-500 to-blue-700',
  prize_pool DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default rooms
INSERT INTO rooms (id, name, stake, max_players, description, color, prize_pool) VALUES
  ('classic', 'Classic Room', 10.00, 500, 'Perfect for beginners. Standard pace, great prizes!', 'from-blue-500 to-blue-700', 1000.00),
  ('speed', 'Speed Bingo', 5.00, 200, 'Fast-paced action! Numbers called every 2 seconds.', 'from-green-500 to-green-700', 500.00),
  ('mega', 'Mega Jackpot', 50.00, 1000, 'Huge prizes! High stakes, massive rewards.', 'from-purple-500 to-purple-700', 10000.00);

-- ============================================
-- GAMES TABLE
-- ============================================
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  status TEXT DEFAULT 'countdown' CHECK (status IN ('countdown', 'active', 'finished')),
  countdown_time INTEGER DEFAULT 10,
  players UUID[] DEFAULT '{}',
  bots TEXT[] DEFAULT '{}',
  called_numbers INTEGER[] DEFAULT '{}',
  latest_number JSONB,
  stake DECIMAL(10, 2) NOT NULL,
  prize_pool DECIMAL(10, 2) DEFAULT 0,
  winner_id UUID REFERENCES users(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_games_room_id ON games(room_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_started_at ON games(started_at DESC);

-- ============================================
-- PLAYER CARDS TABLE
-- ============================================
CREATE TABLE player_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card JSONB NOT NULL,
  marked_cells JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

CREATE INDEX idx_player_cards_game_id ON player_cards(game_id);
CREATE INDEX idx_player_cards_user_id ON player_cards(user_id);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('stake', 'win', 'deposit', 'withdrawal')),
  amount DECIMAL(10, 2) NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_game_id ON transactions(game_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_telegram_id ON admin_users(telegram_id);

-- Seed super admin (CHANGE THIS TO YOUR TELEGRAM ID)
INSERT INTO admin_users (telegram_id, username, role, permissions) VALUES
  ('YOUR_TELEGRAM_ID_HERE', 'SuperAdmin', 'super_admin', '{"all": true}'::jsonb);

-- ============================================
-- BROADCASTS TABLE
-- ============================================
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recipients INTEGER NOT NULL,
  sent INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_created_at ON broadcasts(created_at DESC);

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Add balance to user
CREATE OR REPLACE FUNCTION add_balance(user_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET balance = balance + amount,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Deduct balance from user
CREATE OR REPLACE FUNCTION deduct_balance(user_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET balance = balance - amount,
      updated_at = NOW()
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF (SELECT balance FROM users WHERE id = user_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update user statistics after game
CREATE OR REPLACE FUNCTION update_user_stats(user_id UUID, won BOOLEAN, winnings DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET games_played = games_played + 1,
      games_won = CASE WHEN won THEN games_won + 1 ELSE games_won END,
      total_winnings = CASE WHEN won THEN total_winnings + winnings ELSE total_winnings END,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (true);
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
CREATE POLICY "Users read own cards" ON player_cards FOR SELECT USING (true);
CREATE POLICY "Users read own transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Public read admin_users" ON admin_users FOR SELECT USING (true);
CREATE POLICY "Public read broadcasts" ON broadcasts FOR SELECT USING (true);

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW leaderboard_view AS
SELECT 
  id,
  username,
  games_won,
  total_winnings,
  games_played,
  CASE 
    WHEN games_played > 0 THEN ROUND((games_won::DECIMAL / games_played::DECIMAL) * 100, 1)
    ELSE 0
  END as win_rate
FROM users
WHERE games_played > 0
ORDER BY total_winnings DESC, games_won DESC
LIMIT 100;

-- ============================================
-- SEED TEST DATA (Optional - for development)
-- ============================================

-- Test user
INSERT INTO users (telegram_id, username, balance, games_played, games_won, total_winnings)
VALUES ('123456789', 'TestPlayer', 5000.00, 10, 3, 2500.00);

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ DATABASE SETUP COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables Created:';
  RAISE NOTICE '   • users (with test user)';
  RAISE NOTICE '   • rooms (Classic, Speed, Mega)';
  RAISE NOTICE '   • games';
  RAISE NOTICE '   • player_cards';
  RAISE NOTICE '   • transactions';
  RAISE NOTICE '   • admin_users (with super admin)';
  RAISE NOTICE '   • broadcasts';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Functions Created:';
  RAISE NOTICE '   • add_balance(user_id, amount)';
  RAISE NOTICE '   • deduct_balance(user_id, amount)';
  RAISE NOTICE '   • update_user_stats(user_id, won, winnings)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Row Level Security: ENABLED';
  RAISE NOTICE '📈 Views: leaderboard_view';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Update admin_users table with your Telegram ID!';
  RAISE NOTICE '';
END $$;
