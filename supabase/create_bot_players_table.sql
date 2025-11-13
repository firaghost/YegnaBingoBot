-- ============================================
-- CREATE BOT PLAYERS SYSTEM
-- ============================================

-- Create bot_players table
CREATE TABLE IF NOT EXISTS bot_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  is_enabled BOOLEAN DEFAULT true,
  
  -- Bot Behavior Settings
  win_rate INTEGER DEFAULT 30 CHECK (win_rate >= 0 AND win_rate <= 100), -- Percentage chance to win
  response_time_min INTEGER DEFAULT 2000, -- Min response time in milliseconds
  response_time_max INTEGER DEFAULT 8000, -- Max response time in milliseconds
  aggression_level INTEGER DEFAULT 50 CHECK (aggression_level >= 0 AND aggression_level <= 100), -- How aggressive in marking
  
  -- Bot Personality
  personality TEXT DEFAULT 'friendly', -- friendly, competitive, casual, silent
  chat_enabled BOOLEAN DEFAULT true,
  chat_frequency INTEGER DEFAULT 30 CHECK (chat_frequency >= 0 AND chat_frequency <= 100), -- How often bot chats
  
  -- Game Preferences
  preferred_rooms TEXT[], -- Array of room IDs bot prefers
  skill_level TEXT DEFAULT 'medium' CHECK (skill_level IN ('easy', 'medium', 'hard')),
  
  -- Statistics
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_winnings DECIMAL(10,2) DEFAULT 0,
  
  -- Admin Settings
  auto_join_enabled BOOLEAN DEFAULT true, -- Should bot auto-join when players wait
  max_concurrent_games INTEGER DEFAULT 1, -- How many games bot can play at once
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bot_players_enabled ON bot_players(is_enabled);
CREATE INDEX IF NOT EXISTS idx_bot_players_auto_join ON bot_players(auto_join_enabled);
CREATE INDEX IF NOT EXISTS idx_bot_players_skill ON bot_players(skill_level);
CREATE INDEX IF NOT EXISTS idx_bot_players_created_at ON bot_players(created_at);

-- Create bot_game_sessions table to track active bot games
CREATE TABLE IF NOT EXISTS bot_game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID REFERENCES bot_players(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- The bot's user account
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Game performance
  cards_marked INTEGER DEFAULT 0,
  response_times INTEGER[], -- Array of response times for analysis
  won BOOLEAN DEFAULT false,
  winnings DECIMAL(10,2) DEFAULT 0
);

-- Create indexes for bot_game_sessions
CREATE INDEX IF NOT EXISTS idx_bot_sessions_bot_id ON bot_game_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_game_id ON bot_game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_status ON bot_game_sessions(status);

-- Enable RLS
ALTER TABLE bot_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_game_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for bot_players
CREATE POLICY "Allow read bot_players" ON bot_players FOR SELECT USING (true);
CREATE POLICY "Allow insert bot_players" ON bot_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update bot_players" ON bot_players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete bot_players" ON bot_players FOR DELETE USING (true);

-- Create policies for bot_game_sessions
CREATE POLICY "Allow read bot_game_sessions" ON bot_game_sessions FOR SELECT USING (true);
CREATE POLICY "Allow insert bot_game_sessions" ON bot_game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update bot_game_sessions" ON bot_game_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete bot_game_sessions" ON bot_game_sessions FOR DELETE USING (true);

-- Insert sample bot players
INSERT INTO bot_players (name, username, win_rate, personality, skill_level, preferred_rooms) VALUES
('Lucky Lucy', 'lucky_lucy_bot', 25, 'friendly', 'easy', '{}'),
('Smart Sam', 'smart_sam_bot', 35, 'competitive', 'medium', '{}'),
('Quick Quinn', 'quick_quinn_bot', 40, 'casual', 'medium', '{}'),
('Wise William', 'wise_william_bot', 45, 'silent', 'hard', '{}'),
('Happy Hannah', 'happy_hannah_bot', 30, 'friendly', 'easy', '{}'),
('Clever Chris', 'clever_chris_bot', 38, 'competitive', 'medium', '{}'),
('Fast Felix', 'fast_felix_bot', 42, 'casual', 'medium', '{}'),
('Brilliant Bella', 'brilliant_bella_bot', 48, 'competitive', 'hard', '{}'),
('Gentle George', 'gentle_george_bot', 28, 'friendly', 'easy', '{}'),
('Strategic Steve', 'strategic_steve_bot', 50, 'silent', 'hard', '{}'),
('Cheerful Charlie', 'cheerful_charlie_bot', 32, 'friendly', 'easy', '{}'),
('Tactical Tina', 'tactical_tina_bot', 46, 'competitive', 'hard', '{}')
ON CONFLICT (username) DO NOTHING;

-- Create function to update bot statistics
CREATE OR REPLACE FUNCTION update_bot_stats(
  bot_id_param UUID,
  won_param BOOLEAN,
  winnings_param DECIMAL DEFAULT 0
)
RETURNS void AS $$
BEGIN
  UPDATE bot_players 
  SET 
    games_played = games_played + 1,
    games_won = CASE WHEN won_param THEN games_won + 1 ELSE games_won END,
    total_winnings = total_winnings + COALESCE(winnings_param, 0),
    updated_at = NOW()
  WHERE id = bot_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create function to get available bots for a room
CREATE OR REPLACE FUNCTION get_available_bots_for_room(
  room_id_param UUID,
  skill_level_param TEXT DEFAULT NULL,
  limit_param INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  username TEXT,
  win_rate INTEGER,
  personality TEXT,
  skill_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.name,
    bp.username,
    bp.win_rate,
    bp.personality,
    bp.skill_level
  FROM bot_players bp
  WHERE bp.is_enabled = true
    AND bp.auto_join_enabled = true
    AND (skill_level_param IS NULL OR bp.skill_level = skill_level_param)
    AND (
      bp.preferred_rooms IS NULL 
      OR bp.preferred_rooms = '{}' 
      OR room_id_param::TEXT = ANY(bp.preferred_rooms)
    )
    -- Check if bot is not already in too many games
    AND (
      SELECT COUNT(*) 
      FROM bot_game_sessions bgs 
      WHERE bgs.bot_id = bp.id AND bgs.status = 'active'
    ) < bp.max_concurrent_games
  ORDER BY 
    -- Prioritize bots with fewer active games
    RANDOM()
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Add is_bot and bot_id columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES bot_players(id) ON DELETE SET NULL;

-- Create index for bot users
CREATE INDEX IF NOT EXISTS idx_users_is_bot ON users(is_bot);
CREATE INDEX IF NOT EXISTS idx_users_bot_id ON users(bot_id);

-- Success message
SELECT 'BOT PLAYERS SYSTEM CREATED SUCCESSFULLY!' as status;
SELECT 'Tables: bot_players, bot_game_sessions, updated users table' as created;
SELECT 'Policies: Full CRUD access enabled' as policies;
SELECT 'Functions: update_bot_stats, get_available_bots_for_room' as functions;
SELECT 'Sample bots: 12 bots with different personalities and skills' as sample_data;
