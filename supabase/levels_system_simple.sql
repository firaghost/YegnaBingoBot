-- ============================================
-- DYNAMIC GAME LEVELS & XP LEADERBOARD SYSTEM
-- BingoX Telegram Bot Enhancement - SIMPLE VERSION
-- ============================================

-- ============================================
-- 1. CREATE LEVELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS levels (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  call_interval INTEGER NOT NULL DEFAULT 1000,
  win_threshold INTEGER NOT NULL DEFAULT 5,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert level data
INSERT INTO levels (name, call_interval, win_threshold, xp_reward, description)
VALUES
  ('easy', 1000, 3, 10, 'Quick, easy round - perfect for beginners'),
  ('medium', 2000, 5, 25, 'Balanced challenge with moderate rewards'),
  ('hard', 3000, 7, 50, 'Longer, strategic game with high rewards')
ON CONFLICT (name) DO UPDATE SET
  call_interval = EXCLUDED.call_interval,
  win_threshold = EXCLUDED.win_threshold,
  xp_reward = EXCLUDED.xp_reward,
  description = EXCLUDED.description;

-- ============================================
-- 2. EXTEND USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_progress TEXT DEFAULT 'Beginner';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_wins ON users(total_wins DESC);

-- ============================================
-- 3. CREATE LEADERBOARD TABLE (SIMPLE)
-- ============================================
DROP TABLE IF EXISTS leaderboard CASCADE;
CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  wins INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, period)
);

-- Create indexes
CREATE INDEX idx_leaderboard_period_xp ON leaderboard(period, xp DESC);
CREATE INDEX idx_leaderboard_period_wins ON leaderboard(period, wins DESC);
CREATE INDEX idx_leaderboard_user_period ON leaderboard(user_id, period);

-- ============================================
-- 4. CREATE LEADERBOARD HISTORY TABLE
-- ============================================
DROP TABLE IF EXISTS leaderboard_history CASCADE;
CREATE TABLE leaderboard_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  final_rank INTEGER NOT NULL,
  final_wins INTEGER NOT NULL,
  final_xp INTEGER NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_leaderboard_history_period ON leaderboard_history(period, period_end DESC);
CREATE INDEX idx_leaderboard_history_user ON leaderboard_history(user_id, period_end DESC);

-- ============================================
-- 5. UPDATE GAMES AND ROOMS TABLES
-- ============================================
ALTER TABLE games ADD COLUMN IF NOT EXISTS level_name TEXT DEFAULT 'medium';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS default_level TEXT DEFAULT 'medium';

-- ============================================
-- 6. CREATE FUNCTIONS
-- ============================================

-- Function to update player stats
CREATE OR REPLACE FUNCTION update_player_stats(p_user_id UUID, p_xp INTEGER)
RETURNS void AS $$
BEGIN
  -- Update user XP and total wins
  UPDATE users
  SET xp = xp + p_xp,
      total_wins = total_wins + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Update weekly leaderboard
  INSERT INTO leaderboard (user_id, period, wins, xp, updated_at)
  VALUES (p_user_id, 'weekly', 1, p_xp, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET
    wins = leaderboard.wins + 1,
    xp = leaderboard.xp + p_xp,
    updated_at = NOW();

  -- Update monthly leaderboard
  INSERT INTO leaderboard (user_id, period, wins, xp, updated_at)
  VALUES (p_user_id, 'monthly', 1, p_xp, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET
    wins = leaderboard.wins + 1,
    xp = leaderboard.xp + p_xp,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update player rank
CREATE OR REPLACE FUNCTION update_player_rank()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.xp >= 1000 THEN 
    NEW.level_progress := 'Legend';
  ELSIF NEW.xp >= 600 THEN 
    NEW.level_progress := 'Master';
  ELSIF NEW.xp >= 300 THEN 
    NEW.level_progress := 'Expert';
  ELSIF NEW.xp >= 100 THEN 
    NEW.level_progress := 'Skilled';
  ELSE 
    NEW.level_progress := 'Beginner';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rank updates
DROP TRIGGER IF EXISTS trg_update_rank ON users;
CREATE TRIGGER trg_update_rank
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.xp IS DISTINCT FROM NEW.xp)
  EXECUTE FUNCTION update_player_rank();

-- Function to calculate leaderboard ranks
CREATE OR REPLACE FUNCTION calculate_leaderboard_ranks(p_period TEXT)
RETURNS void AS $$
BEGIN
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY xp DESC, wins DESC, updated_at ASC) as new_rank
    FROM leaderboard 
    WHERE period = p_period
  )
  UPDATE leaderboard 
  SET rank = ranked_users.new_rank
  FROM ranked_users
  WHERE leaderboard.user_id = ranked_users.user_id 
    AND leaderboard.period = p_period;
END;
$$ LANGUAGE plpgsql;

-- Function to reset leaderboard
CREATE OR REPLACE FUNCTION reset_leaderboard(p_period TEXT)
RETURNS void AS $$
DECLARE
  period_start DATE;
  period_end DATE;
BEGIN
  IF p_period = 'weekly' THEN
    period_end := CURRENT_DATE;
    period_start := period_end - INTERVAL '7 days';
  ELSIF p_period = 'monthly' THEN
    period_end := CURRENT_DATE;
    period_start := DATE_TRUNC('month', period_end) - INTERVAL '1 month';
  ELSE
    RAISE EXCEPTION 'Invalid period. Use weekly or monthly.';
  END IF;

  -- Archive current leaderboard
  INSERT INTO leaderboard_history (user_id, period, period_start, period_end, final_rank, final_wins, final_xp)
  SELECT 
    l.user_id, 
    l.period, 
    period_start, 
    period_end, 
    l.rank, 
    l.wins, 
    l.xp
  FROM leaderboard l
  WHERE l.period = p_period;

  -- Reset current leaderboard
  UPDATE leaderboard 
  SET wins = 0, xp = 0, rank = 0, updated_at = NOW()
  WHERE period = p_period;
END;
$$ LANGUAGE plpgsql;

-- Function to get level settings
CREATE OR REPLACE FUNCTION get_level_settings(p_level_name TEXT)
RETURNS TABLE(
  name TEXT,
  call_interval INTEGER,
  win_threshold INTEGER,
  xp_reward INTEGER,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT l.name, l.call_interval, l.win_threshold, l.xp_reward, l.description
  FROM levels l
  WHERE l.name = p_level_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE VIEW
-- ============================================
CREATE OR REPLACE VIEW current_leaderboard AS
SELECT 
  l.rank,
  l.period,
  u.username,
  u.telegram_id,
  l.wins,
  l.xp,
  u.level_progress,
  u.xp as lifetime_xp,
  u.total_wins as lifetime_wins,
  l.updated_at
FROM leaderboard l
JOIN users u ON l.user_id = u.id
WHERE l.xp > 0 OR l.wins > 0
ORDER BY l.period, l.xp DESC, l.wins DESC;

-- ============================================
-- 8. ENABLE RLS AND POLICIES
-- ============================================
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_history ENABLE ROW LEVEL SECURITY;

-- Create policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can read levels" ON levels;
DROP POLICY IF EXISTS "Admins can manage levels" ON levels;
DROP POLICY IF EXISTS "Anyone can read leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "System can manage leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Anyone can read leaderboard history" ON leaderboard_history;
DROP POLICY IF EXISTS "System can manage leaderboard history" ON leaderboard_history;

CREATE POLICY "Anyone can read levels" ON levels FOR SELECT USING (true);
CREATE POLICY "Admins can manage levels" ON levels FOR ALL USING (true);
CREATE POLICY "Anyone can read leaderboard" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "System can manage leaderboard" ON leaderboard FOR ALL USING (true);
CREATE POLICY "Anyone can read leaderboard history" ON leaderboard_history FOR SELECT USING (true);
CREATE POLICY "System can manage leaderboard history" ON leaderboard_history FOR ALL USING (true);

-- ============================================
-- 9. COMPLETION MESSAGE
-- ============================================
SELECT 'LEVELS & LEADERBOARD SYSTEM INSTALLED SUCCESSFULLY!' as status;
SELECT 'Tables created: levels, leaderboard, leaderboard_history' as tables;
SELECT 'Functions created: update_player_stats, calculate_leaderboard_ranks, reset_leaderboard' as functions;
SELECT 'XP System: Beginner → Skilled → Expert → Master → Legend' as xp_system;
SELECT 'Levels: Easy (10 XP) → Medium (25 XP) → Hard (50 XP)' as levels;
