-- ============================================
-- COMPLETE BOT SYSTEM SETUP
-- ============================================

-- Step 1: Add missing columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_level TEXT DEFAULT 'medium';
ALTER TABLE games ADD COLUMN IF NOT EXISTS stake DECIMAL(10,2) DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_id TEXT;

-- Step 2: Add missing columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS waiting_players INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS prize_pool DECIMAL(10,2) DEFAULT 0;

-- Step 3: Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_id UUID;

-- Step 4: Create bot_players table
CREATE TABLE IF NOT EXISTS bot_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  is_enabled BOOLEAN DEFAULT true,
  win_rate INTEGER DEFAULT 30,
  response_time_min INTEGER DEFAULT 2000,
  response_time_max INTEGER DEFAULT 8000,
  aggression_level INTEGER DEFAULT 50,
  personality TEXT DEFAULT 'friendly',
  chat_enabled BOOLEAN DEFAULT true,
  chat_frequency INTEGER DEFAULT 30,
  preferred_rooms TEXT[] DEFAULT '{}',
  skill_level TEXT DEFAULT 'medium',
  auto_join_enabled BOOLEAN DEFAULT true,
  max_concurrent_games INTEGER DEFAULT 1,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_winnings DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create bot_game_sessions table
CREATE TABLE IF NOT EXISTS bot_game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID REFERENCES bot_players(id) ON DELETE CASCADE,
  game_id UUID,
  user_id UUID,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  won BOOLEAN DEFAULT false,
  winnings DECIMAL(10,2) DEFAULT 0
);

-- Step 6: Enable RLS and create policies
ALTER TABLE bot_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_game_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bot_players' AND policyname = 'Allow all bot_players') THEN
        CREATE POLICY "Allow all bot_players" ON bot_players FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bot_game_sessions' AND policyname = 'Allow all bot_game_sessions') THEN
        CREATE POLICY "Allow all bot_game_sessions" ON bot_game_sessions FOR ALL USING (true);
    END IF;
END $$;

-- Step 7: Insert sample bots
INSERT INTO bot_players (name, username, win_rate, personality, skill_level, is_enabled, auto_join_enabled) VALUES
('Lucky Lucy', 'lucky_lucy_bot', 25, 'friendly', 'easy', true, true),
('Smart Sam', 'smart_sam_bot', 35, 'competitive', 'medium', true, true),
('Quick Quinn', 'quick_quinn_bot', 40, 'casual', 'medium', true, true),
('Happy Hannah', 'happy_hannah_bot', 30, 'friendly', 'easy', true, true),
('Clever Chris', 'clever_chris_bot', 38, 'competitive', 'medium', true, true),
('Fast Felix', 'fast_felix_bot', 42, 'casual', 'medium', true, true),
('Brilliant Bella', 'brilliant_bella_bot', 48, 'competitive', 'hard', true, true),
('Gentle George', 'gentle_george_bot', 28, 'friendly', 'easy', true, true)
ON CONFLICT (username) DO NOTHING;

-- Step 8: Create bot users for each bot
DO $$
DECLARE
    bot_record RECORD;
    bot_user_id UUID;
BEGIN
    FOR bot_record IN SELECT * FROM bot_players WHERE is_enabled = true LOOP
        -- Check if bot user already exists
        SELECT id INTO bot_user_id 
        FROM users 
        WHERE bot_id = bot_record.id;
        
        IF bot_user_id IS NULL THEN
            -- Create bot user
            INSERT INTO users (
                username,
                telegram_id,
                balance,
                is_bot,
                bot_id
            ) VALUES (
                bot_record.username,
                'bot_' || bot_record.id || '_' || EXTRACT(epoch FROM NOW())::bigint,
                1000000,
                true,
                bot_record.id
            );
            
            RAISE NOTICE 'Created user for bot: %', bot_record.name;
        END IF;
    END LOOP;
END $$;

-- Step 9: Create essential functions
CREATE OR REPLACE FUNCTION get_available_bots_for_room(
  room_id_param TEXT,
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
  ORDER BY RANDOM()
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Add bots to all rooms immediately
DO $$
DECLARE
    room_record RECORD;
    bot_user_record RECORD;
    room_stake DECIMAL;
BEGIN
    -- For each room, add 2-3 bots
    FOR room_record IN SELECT id, name, stake FROM rooms LOOP
        RAISE NOTICE 'Adding bots to room: %', room_record.name;
        
        -- Add 2-3 bots to each room
        FOR bot_user_record IN 
            SELECT u.id as user_id, bp.name, bp.skill_level
            FROM users u
            JOIN bot_players bp ON u.bot_id = bp.id
            WHERE u.is_bot = true AND bp.is_enabled = true
            ORDER BY RANDOM()
            LIMIT 3
        LOOP
            -- Check if bot already has a waiting game in this room
            IF NOT EXISTS (
                SELECT 1 FROM games 
                WHERE user_id = bot_user_record.user_id 
                AND room_id = room_record.id 
                AND status = 'waiting'
            ) THEN
                -- Create waiting game for this bot
                INSERT INTO games (
                    room_id,
                    user_id,
                    stake,
                    status,
                    game_level
                ) VALUES (
                    room_record.id,
                    bot_user_record.user_id,
                    room_record.stake,
                    'waiting',
                    bot_user_record.skill_level
                );
                
                RAISE NOTICE 'Added bot % to room %', bot_user_record.name, room_record.name;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Step 11: Update room statistics
UPDATE rooms 
SET waiting_players = (
    SELECT COUNT(*) 
    FROM games 
    WHERE games.room_id = rooms.id AND games.status = 'waiting'
),
prize_pool = (
    SELECT COALESCE(rooms.stake * COUNT(*), 0)
    FROM games 
    WHERE games.room_id = rooms.id AND games.status = 'waiting'
)
WHERE id IS NOT NULL;

-- Step 12: Show results
SELECT 'BOT SYSTEM SETUP COMPLETE!' as status;

SELECT 'Bot Players:' as info;
SELECT name, username, is_enabled, auto_join_enabled FROM bot_players ORDER BY name;

SELECT 'Bot Users:' as info;
SELECT username, is_bot FROM users WHERE is_bot = true ORDER BY username;

SELECT 'Room Status:' as info;
SELECT name, waiting_players, prize_pool FROM rooms ORDER BY name;

SELECT 'Waiting Games:' as info;
SELECT 
    r.name as room_name,
    u.username,
    u.is_bot,
    g.status
FROM games g
JOIN rooms r ON g.room_id = r.id
LEFT JOIN users u ON g.user_id = u.id
WHERE g.status = 'waiting'
ORDER BY r.name, u.is_bot DESC, u.username;
