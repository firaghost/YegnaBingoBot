-- ============================================
-- BINGOX WAITING ROOM SYSTEM - DATABASE SCHEMA
-- Real-time multiplayer waiting room tables
-- ============================================

-- ============================================
-- 1. UPDATE ROOMS TABLE FOR WAITING ROOM SUPPORT
-- ============================================
-- Add waiting room specific columns to existing rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'lobby';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_level TEXT DEFAULT 'medium';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS countdown_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_started_at TIMESTAMP WITH TIME ZONE;

-- Update status enum to include waiting room states
-- Note: This assumes your existing rooms table has a status column
-- If not, add: ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';

-- ============================================
-- 2. CREATE ROOM_PLAYERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  telegram_id TEXT,
  socket_id TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'finished')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON room_players(user_id);
CREATE INDEX IF NOT EXISTS idx_room_players_socket_id ON room_players(socket_id);
CREATE INDEX IF NOT EXISTS idx_room_players_status ON room_players(status);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- ============================================
-- 3. CREATE GAME_SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'finished', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  winner_id UUID REFERENCES users(id),
  total_players INTEGER DEFAULT 0,
  active_players INTEGER DEFAULT 0,
  game_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_id ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);

-- ============================================
-- 4. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get active players in a room
CREATE OR REPLACE FUNCTION get_active_room_players(p_room_id TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  telegram_id TEXT,
  socket_id TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.id,
    rp.username,
    rp.telegram_id,
    rp.socket_id,
    rp.joined_at,
    rp.status
  FROM room_players rp
  WHERE rp.room_id = p_room_id 
    AND rp.status = 'active'
  ORDER BY rp.joined_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get room with player count
CREATE OR REPLACE FUNCTION get_room_with_player_count(p_room_id TEXT)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  status TEXT,
  game_level TEXT,
  max_players INTEGER,
  min_players INTEGER,
  current_players INTEGER,
  active_player_count BIGINT,
  countdown_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.status,
    r.game_level,
    r.max_players,
    r.min_players,
    r.current_players,
    COALESCE(player_count.count, 0) as active_player_count,
    r.countdown_started_at,
    r.created_at
  FROM rooms r
  LEFT JOIN (
    SELECT 
      room_id, 
      COUNT(*) as count
    FROM room_players 
    WHERE status = 'active'
    GROUP BY room_id
  ) player_count ON r.id = player_count.room_id
  WHERE r.id = p_room_id;
END;
$$ LANGUAGE plpgsql;

-- Function to find available waiting room
CREATE OR REPLACE FUNCTION find_available_waiting_room(p_game_level TEXT DEFAULT 'medium')
RETURNS TABLE(
  id TEXT,
  name TEXT,
  status TEXT,
  game_level TEXT,
  max_players INTEGER,
  min_players INTEGER,
  current_players INTEGER,
  active_player_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.status,
    r.game_level,
    r.max_players,
    r.min_players,
    r.current_players,
    COALESCE(player_count.count, 0) as active_player_count,
    r.created_at
  FROM rooms r
  LEFT JOIN (
    SELECT 
      room_id, 
      COUNT(*) as count
    FROM room_players 
    WHERE status = 'active'
    GROUP BY room_id
  ) player_count ON r.id = player_count.room_id
  WHERE r.status = 'waiting'
    AND r.game_level = p_game_level
    AND COALESCE(player_count.count, 0) < r.max_players
    AND r.created_at > NOW() - INTERVAL '10 minutes'
  ORDER BY player_count.count DESC, r.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired rooms
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete waiting rooms older than 10 minutes with no active players
  DELETE FROM rooms 
  WHERE status = 'waiting' 
    AND created_at < NOW() - INTERVAL '10 minutes'
    AND id NOT IN (
      SELECT DISTINCT room_id 
      FROM room_players 
      WHERE status = 'active'
    );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Mark in_progress rooms as finished if no active players for 5 minutes
  UPDATE rooms 
  SET status = 'finished', 
      updated_at = NOW()
  WHERE status = 'in_progress'
    AND updated_at < NOW() - INTERVAL '5 minutes'
    AND id NOT IN (
      SELECT DISTINCT room_id 
      FROM room_players 
      WHERE status = 'active' 
        AND last_seen > NOW() - INTERVAL '5 minutes'
    );
  
  -- Clean up disconnected players older than 1 hour
  DELETE FROM room_players 
  WHERE status = 'disconnected' 
    AND last_seen < NOW() - INTERVAL '1 hour';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update room player count
CREATE OR REPLACE FUNCTION update_room_player_count(p_room_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE rooms 
  SET current_players = (
    SELECT COUNT(*) 
    FROM room_players 
    WHERE room_id = p_room_id 
      AND status = 'active'
  ),
  updated_at = NOW()
  WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE TRIGGERS
-- ============================================

-- Trigger to auto-update room player count
CREATE OR REPLACE FUNCTION trigger_update_room_player_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_room_player_count(NEW.room_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM update_room_player_count(NEW.room_id);
    IF OLD.room_id != NEW.room_id THEN
      PERFORM update_room_player_count(OLD.room_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_room_player_count(OLD.room_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_room_player_count ON room_players;
CREATE TRIGGER trg_update_room_player_count
  AFTER INSERT OR UPDATE OR DELETE ON room_players
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_room_player_count();

-- ============================================
-- 6. ENABLE RLS AND POLICIES
-- ============================================
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read room_players" ON room_players FOR SELECT USING (true);
CREATE POLICY "System can manage room_players" ON room_players FOR ALL USING (true);

CREATE POLICY "Anyone can read game_sessions" ON game_sessions FOR SELECT USING (true);
CREATE POLICY "System can manage game_sessions" ON game_sessions FOR ALL USING (true);

-- ============================================
-- 7. SEED SOME TEST ROOMS (OPTIONAL)
-- ============================================
-- Insert some test rooms for different game levels
INSERT INTO rooms (id, name, stake, max_players, min_players, status, description, color, prize_pool, game_level, room_type)
VALUES
  ('waiting-easy', 'Easy Waiting Room', 5.00, 10, 2, 'waiting', 'Quick games for beginners', 'from-green-500 to-green-700', 50.00, 'easy', 'waiting'),
  ('waiting-medium', 'Medium Waiting Room', 10.00, 8, 2, 'waiting', 'Balanced challenge', 'from-blue-500 to-blue-700', 80.00, 'medium', 'waiting'),
  ('waiting-hard', 'Hard Waiting Room', 25.00, 6, 2, 'waiting', 'Expert level games', 'from-red-500 to-red-700', 150.00, 'hard', 'waiting')
ON CONFLICT (id) DO UPDATE SET
  max_players = EXCLUDED.max_players,
  min_players = EXCLUDED.min_players,
  game_level = EXCLUDED.game_level,
  room_type = EXCLUDED.room_type;

-- ============================================
-- 8. COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎮 ========================================';
  RAISE NOTICE '🎮 WAITING ROOM SYSTEM SCHEMA INSTALLED!';
  RAISE NOTICE '🎮 ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables Updated/Created:';
  RAISE NOTICE '   • rooms (extended with waiting room fields)';
  RAISE NOTICE '   • room_players (new table for player tracking)';
  RAISE NOTICE '   • game_sessions (new table for game state)';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Functions Created:';
  RAISE NOTICE '   • get_active_room_players(room_id)';
  RAISE NOTICE '   • get_room_with_player_count(room_id)';
  RAISE NOTICE '   • find_available_waiting_room(game_level)';
  RAISE NOTICE '   • cleanup_expired_rooms()';
  RAISE NOTICE '   • update_room_player_count(room_id)';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Triggers: Auto-update room player counts';
  RAISE NOTICE '🏠 Test Rooms: Easy, Medium, Hard waiting rooms created';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ready for Socket.IO integration!';
  RAISE NOTICE '';
END $$;
