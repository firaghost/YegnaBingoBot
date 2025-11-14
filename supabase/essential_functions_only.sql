-- ============================================
-- ESSENTIAL GAME FUNCTIONS ONLY
-- Run this if the full file has issues
-- ============================================

-- 1. SAFE GAME CREATION
CREATE OR REPLACE FUNCTION create_game_safe(
  p_room_id TEXT,
  p_creator_id UUID,
  p_stake DECIMAL(10,2)
)
RETURNS TABLE(success BOOLEAN, game_id UUID, message TEXT) AS $$
DECLARE
  new_game_id UUID;
  room_max_players INTEGER;
  room_status TEXT;
  concurrent_games INTEGER;
  max_concurrent_games INTEGER := 5; -- Free tier limit
BEGIN
  -- Generate new game ID
  new_game_id := uuid_generate_v4();

  -- Validate room exists and is active
  SELECT max_players, status INTO room_max_players, room_status
  FROM rooms 
  WHERE id = p_room_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Room not found';
    RETURN;
  END IF;

  IF room_status != 'active' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Room is not active';
    RETURN;
  END IF;

  -- Check concurrent game limits (free tier optimization)
  SELECT COUNT(*) INTO concurrent_games
  FROM games 
  WHERE status IN ('waiting', 'waiting_for_players', 'countdown', 'active');

  IF concurrent_games >= max_concurrent_games THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Server at capacity. Please try again later.';
    RETURN;
  END IF;

  -- Create game
  INSERT INTO games (
    id,
    room_id,
    status,
    countdown_time,
    players,
    bots,
    called_numbers,
    stake,
    prize_pool,
    started_at,
    created_at
  ) VALUES (
    new_game_id,
    p_room_id,
    'waiting',
    30, -- 30 second waiting period
    ARRAY[p_creator_id],
    '{}',
    '{}',
    p_stake,
    p_stake,
    NOW(),
    NOW()
  );

  RETURN QUERY SELECT TRUE, new_game_id, 'Game created successfully';
END;
$$ LANGUAGE plpgsql;

-- 2. SAFE PLAYER JOINING
CREATE OR REPLACE FUNCTION add_player_to_game(
  p_game_id UUID, 
  p_user_id UUID,
  p_max_players INTEGER DEFAULT 20
)
RETURNS TABLE(success BOOLEAN, message TEXT, current_player_count INTEGER) AS $$
DECLARE
  current_players UUID[];
  game_status TEXT;
  game_stake DECIMAL(10,2);
  user_balance DECIMAL(10,2);
  user_bonus_balance DECIMAL(10,2);
  total_balance DECIMAL(10,2);
  player_count INTEGER;
BEGIN
  -- Lock the game row to prevent race conditions
  SELECT players, status, stake INTO current_players, game_status, game_stake
  FROM games 
  WHERE id = p_game_id 
  FOR UPDATE;

  -- Validate game exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Game not found', 0;
    RETURN;
  END IF;

  -- Validate game status
  IF game_status NOT IN ('waiting', 'waiting_for_players', 'countdown') THEN
    RETURN QUERY SELECT FALSE, 'Game is not accepting players (status: ' || game_status || ')', array_length(current_players, 1);
    RETURN;
  END IF;

  -- Check if player already in game
  IF p_user_id = ANY(current_players) THEN
    RETURN QUERY SELECT TRUE, 'Player already in game', array_length(current_players, 1);
    RETURN;
  END IF;

  -- Check player limit
  player_count := COALESCE(array_length(current_players, 1), 0);
  IF player_count >= p_max_players THEN
    RETURN QUERY SELECT FALSE, 'Game is full (' || player_count || '/' || p_max_players || ')', player_count;
    RETURN;
  END IF;

  -- Validate user balance
  SELECT balance, COALESCE(bonus_balance, 0) INTO user_balance, user_bonus_balance
  FROM users 
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User not found', player_count;
    RETURN;
  END IF;

  total_balance := user_balance + user_bonus_balance;
  IF total_balance < game_stake THEN
    RETURN QUERY SELECT FALSE, 'Insufficient balance. Required: ' || game_stake || ' ETB, Available: ' || total_balance || ' ETB', player_count;
    RETURN;
  END IF;

  -- Add player atomically
  UPDATE games 
  SET 
    players = array_append(players, p_user_id),
    prize_pool = prize_pool + game_stake
  WHERE id = p_game_id;

  player_count := player_count + 1;

  RETURN QUERY SELECT TRUE, 'Player added successfully', player_count;
END;
$$ LANGUAGE plpgsql;

-- 3. SIMPLE CLEANUP (without updated_at)
CREATE OR REPLACE FUNCTION cleanup_old_games()
RETURNS TABLE(cleaned_games INTEGER, message TEXT) AS $$
DECLARE
  cleanup_count INTEGER := 0;
  additional_count INTEGER := 0;
BEGIN
  -- Clean up games older than 1 hour that are stuck
  UPDATE games 
  SET 
    status = 'cancelled',
    ended_at = NOW()
  WHERE 
    status IN ('waiting', 'waiting_for_players', 'countdown') 
    AND created_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS cleanup_count = ROW_COUNT;

  -- Clean up active games with no players
  UPDATE games 
  SET 
    status = 'cancelled',
    ended_at = NOW()
  WHERE 
    status = 'active' 
    AND (players IS NULL OR array_length(players, 1) = 0)
    AND started_at < NOW() - INTERVAL '10 minutes';

  GET DIAGNOSTICS additional_count = ROW_COUNT;
  
  -- Add the counts together
  cleanup_count := cleanup_count + additional_count;

  RETURN QUERY SELECT cleanup_count, 'Cleaned up ' || cleanup_count || ' old games';
END;
$$ LANGUAGE plpgsql;

-- 4. BASIC GAME STATISTICS
CREATE OR REPLACE FUNCTION get_game_statistics()
RETURNS TABLE(
  total_games INTEGER,
  active_games INTEGER,
  waiting_games INTEGER,
  finished_games INTEGER,
  total_players INTEGER,
  system_health TEXT
) AS $$
DECLARE
  health_status TEXT;
  active_count INTEGER;
BEGIN
  -- Count games by status
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'active') as active,
    COUNT(*) FILTER (WHERE status IN ('waiting', 'waiting_for_players', 'countdown')) as waiting,
    COUNT(*) FILTER (WHERE status = 'finished') as finished,
    COALESCE(SUM(array_length(players, 1)), 0) as players
  INTO total_games, active_games, waiting_games, finished_games, total_players
  FROM games
  WHERE created_at > NOW() - INTERVAL '24 hours';

  -- Determine system health
  active_count := active_games + waiting_games;
  health_status := CASE 
    WHEN active_count = 0 THEN 'IDLE'
    WHEN active_count <= 3 THEN 'HEALTHY'
    WHEN active_count <= 5 THEN 'BUSY'
    ELSE 'OVERLOADED'
  END;

  RETURN QUERY SELECT 
    total_games, active_games, waiting_games, finished_games, 
    total_players, health_status;
END;
$$ LANGUAGE plpgsql;
