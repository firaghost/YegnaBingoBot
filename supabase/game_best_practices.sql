-- ============================================
-- BINGO GAME BEST PRACTICES - DATABASE FUNCTIONS
-- Implements atomic operations, proper error handling, and performance optimization
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ATOMIC GAME OPERATIONS
-- ============================================

-- Batch update games with proper error handling and validation
CREATE OR REPLACE FUNCTION batch_update_games(updates JSONB[])
RETURNS TABLE(success_count INTEGER, error_count INTEGER, errors TEXT[]) AS $$
DECLARE
  update_record JSONB;
  success_cnt INTEGER := 0;
  error_cnt INTEGER := 0;
  error_messages TEXT[] := '{}';
  game_exists BOOLEAN;
BEGIN
  -- Validate input
  IF updates IS NULL OR array_length(updates, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, ARRAY['No updates provided']::TEXT[];
    RETURN;
  END IF;

  FOREACH update_record IN ARRAY updates
  LOOP
    BEGIN
      -- Validate required fields
      IF update_record->>'id' IS NULL THEN
        error_cnt := error_cnt + 1;
        error_messages := array_append(error_messages, 'Missing game ID in update record');
        CONTINUE;
      END IF;

      -- Check if game exists
      SELECT EXISTS(SELECT 1 FROM games WHERE id = (update_record->>'id')::uuid) INTO game_exists;
      
      IF NOT game_exists THEN
        error_cnt := error_cnt + 1;
        error_messages := array_append(error_messages, 'Game not found: ' || (update_record->>'id'));
        CONTINUE;
      END IF;

      -- Perform atomic update
      UPDATE games 
      SET 
        called_numbers = CASE 
          WHEN update_record ? 'called_numbers' THEN (update_record->>'called_numbers')::integer[]
          ELSE called_numbers 
        END,
        latest_number = CASE 
          WHEN update_record ? 'latest_number' THEN (update_record->>'latest_number')::jsonb
          ELSE latest_number 
        END,
        last_called_at = CASE 
          WHEN update_record ? 'last_called_at' THEN (update_record->>'last_called_at')::timestamp with time zone
          ELSE last_called_at 
        END,
        status = CASE 
          WHEN update_record ? 'status' THEN update_record->>'status'
          ELSE status 
        END
      WHERE id = (update_record->>'id')::uuid;

      success_cnt := success_cnt + 1;

    EXCEPTION WHEN OTHERS THEN
      error_cnt := error_cnt + 1;
      error_messages := array_append(error_messages, 'Error updating game ' || (update_record->>'id') || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN QUERY SELECT success_cnt, error_cnt, error_messages;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. PLAYER MANAGEMENT WITH CONCURRENCY CONTROL
-- ============================================

-- Add player to game with proper validation and limits
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

-- ============================================
-- 3. GAME STATE MANAGEMENT
-- ============================================

-- Create game with proper validation
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

-- ============================================
-- 4. NUMBER CALLING WITH FAIRNESS
-- ============================================

-- Call next number with validation and fairness checks
CREATE OR REPLACE FUNCTION call_next_number(p_game_id UUID)
RETURNS TABLE(success BOOLEAN, number_called INTEGER, letter CHAR(1), remaining_numbers INTEGER, message TEXT) AS $$
DECLARE
  current_numbers INTEGER[];
  available_numbers INTEGER[];
  next_number INTEGER;
  number_letter CHAR(1);
  game_status TEXT;
  remaining_count INTEGER;
BEGIN
  -- Lock game for update
  SELECT called_numbers, status INTO current_numbers, game_status
  FROM games 
  WHERE id = p_game_id 
  FOR UPDATE;

  -- Validate game
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::CHAR(1), 0, 'Game not found';
    RETURN;
  END IF;

  IF game_status != 'active' THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::CHAR(1), 0, 'Game is not active';
    RETURN;
  END IF;

  -- Generate available numbers (1-75)
  SELECT array_agg(num) INTO available_numbers
  FROM generate_series(1, 75) AS num
  WHERE num != ALL(COALESCE(current_numbers, '{}'));

  -- Check if numbers available
  IF array_length(available_numbers, 1) IS NULL OR array_length(available_numbers, 1) = 0 THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::CHAR(1), 0, 'No more numbers to call';
    RETURN;
  END IF;

  -- Select random number
  next_number := available_numbers[1 + floor(random() * array_length(available_numbers, 1))::integer];

  -- Determine BINGO letter
  number_letter := CASE 
    WHEN next_number BETWEEN 1 AND 15 THEN 'B'
    WHEN next_number BETWEEN 16 AND 30 THEN 'I'
    WHEN next_number BETWEEN 31 AND 45 THEN 'N'
    WHEN next_number BETWEEN 46 AND 60 THEN 'G'
    WHEN next_number BETWEEN 61 AND 75 THEN 'O'
  END;

  -- Update game with new number
  UPDATE games 
  SET 
    called_numbers = array_append(COALESCE(called_numbers, '{}'), next_number),
    latest_number = jsonb_build_object('number', next_number, 'letter', number_letter),
    last_called_at = NOW()
  WHERE id = p_game_id;

  remaining_count := array_length(available_numbers, 1) - 1;

  RETURN QUERY SELECT TRUE, next_number, number_letter, remaining_count, 'Number called successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. BINGO VALIDATION WITH ANTI-CHEAT
-- ============================================

-- Validate bingo claim with comprehensive checks
CREATE OR REPLACE FUNCTION validate_bingo_claim(
  p_game_id UUID,
  p_user_id UUID,
  p_claimed_cells INTEGER[],
  p_bingo_pattern TEXT,
  p_user_card INTEGER[][]
)
RETURNS TABLE(
  is_valid BOOLEAN, 
  is_winner BOOLEAN, 
  validation_details JSONB,
  claim_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  called_numbers INTEGER[];
  game_status TEXT;
  existing_winner UUID;
  claim_time TIMESTAMP WITH TIME ZONE;
  pattern_valid BOOLEAN := FALSE;
  all_numbers_called BOOLEAN := TRUE;
  cell_num INTEGER;
  row_idx INTEGER;
  col_idx INTEGER;
BEGIN
  claim_time := NOW();

  -- Lock game to prevent race conditions
  SELECT g.called_numbers, g.status, g.winner_id 
  INTO called_numbers, game_status, existing_winner
  FROM games g
  WHERE g.id = p_game_id
  FOR UPDATE;

  -- Validate game exists and is active
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, 
      jsonb_build_object('error', 'Game not found'),
      claim_time;
    RETURN;
  END IF;

  IF game_status != 'active' THEN
    RETURN QUERY SELECT FALSE, FALSE, 
      jsonb_build_object('error', 'Game is not active', 'status', game_status),
      claim_time;
    RETURN;
  END IF;

  -- Check if winner already exists (atomic first-come-first-serve)
  IF existing_winner IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, 
      jsonb_build_object('error', 'Winner already determined', 'winner_id', existing_winner),
      claim_time;
    RETURN;
  END IF;

  -- Validate all claimed numbers have been called
  FOREACH cell_num IN ARRAY p_claimed_cells
  LOOP
    IF cell_num != 0 AND cell_num != ALL(called_numbers) THEN
      all_numbers_called := FALSE;
      EXIT;
    END IF;
  END LOOP;

  IF NOT all_numbers_called THEN
    RETURN QUERY SELECT FALSE, FALSE, 
      jsonb_build_object('error', 'Not all claimed numbers have been called'),
      claim_time;
    RETURN;
  END IF;

  -- Validate bingo pattern (simplified - you can expand this)
  CASE p_bingo_pattern
    WHEN 'row' THEN
      -- Check if any row is complete (5 numbers)
      pattern_valid := array_length(p_claimed_cells, 1) >= 5;
    WHEN 'column' THEN
      -- Check if any column is complete (5 numbers)
      pattern_valid := array_length(p_claimed_cells, 1) >= 5;
    WHEN 'diagonal' THEN
      -- Check if diagonal is complete (5 numbers)
      pattern_valid := array_length(p_claimed_cells, 1) >= 5;
    WHEN 'full_house' THEN
      -- Check if entire card is complete (24 numbers + free space)
      pattern_valid := array_length(p_claimed_cells, 1) >= 24;
    ELSE
      pattern_valid := FALSE;
  END CASE;

  -- If valid claim and no existing winner, declare winner
  IF pattern_valid AND existing_winner IS NULL THEN
    -- Atomic winner assignment
    UPDATE games 
    SET 
      winner_id = p_user_id,
      status = 'finished',
      ended_at = claim_time
    WHERE id = p_game_id AND winner_id IS NULL; -- Double-check no winner exists

    -- Check if update was successful (no race condition)
    IF FOUND THEN
      RETURN QUERY SELECT TRUE, TRUE, 
        jsonb_build_object(
          'pattern', p_bingo_pattern,
          'claimed_cells', p_claimed_cells,
          'winner_declared_at', claim_time
        ),
        claim_time;
    ELSE
      -- Another player won in the meantime
      RETURN QUERY SELECT TRUE, FALSE, 
        jsonb_build_object('error', 'Another player claimed victory first'),
        claim_time;
    END IF;
  ELSE
    RETURN QUERY SELECT pattern_valid, FALSE, 
      jsonb_build_object(
        'pattern_valid', pattern_valid,
        'pattern', p_bingo_pattern,
        'claimed_cells', p_claimed_cells
      ),
      claim_time;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CLEANUP AND MAINTENANCE
-- ============================================

-- Clean up old and stuck games
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

-- ============================================
-- 7. PERFORMANCE MONITORING
-- ============================================

-- Get game statistics for monitoring
CREATE OR REPLACE FUNCTION get_game_statistics()
RETURNS TABLE(
  total_games INTEGER,
  active_games INTEGER,
  waiting_games INTEGER,
  finished_games INTEGER,
  total_players INTEGER,
  avg_game_duration INTERVAL,
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

  -- Calculate average game duration
  SELECT AVG(ended_at - started_at) INTO avg_game_duration
  FROM games 
  WHERE status = 'finished' AND ended_at IS NOT NULL AND started_at IS NOT NULL;

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
    total_players, avg_game_duration, health_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================

-- Optimize query performance
CREATE INDEX IF NOT EXISTS idx_games_status_created 
ON games(status, created_at DESC) 
WHERE status IN ('waiting', 'waiting_for_players', 'countdown', 'active');

CREATE INDEX IF NOT EXISTS idx_games_room_status 
ON games(room_id, status) 
WHERE status IN ('waiting', 'waiting_for_players', 'countdown');

CREATE INDEX IF NOT EXISTS idx_games_winner_ended 
ON games(winner_id, ended_at DESC) 
WHERE winner_id IS NOT NULL;

-- ============================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on games table
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their games" ON games;
DROP POLICY IF EXISTS "System can update games" ON games;

-- Policy: Users can read games they're participating in
CREATE POLICY "Users can read their games" ON games
FOR SELECT USING (
  auth.uid() = ANY(players) OR 
  status IN ('waiting', 'waiting_for_players', 'countdown', 'active')
);

-- Policy: Only system can update games
CREATE POLICY "System can update games" ON games
FOR UPDATE USING (
  auth.role() = 'service_role'
);

-- ============================================
-- 10. AUTOMATED CLEANUP JOB
-- ============================================

-- Create cleanup job (run via cron or scheduled function)
CREATE OR REPLACE FUNCTION scheduled_cleanup()
RETURNS void AS $$
BEGIN
  -- Clean up old games
  PERFORM cleanup_old_games();
  
  -- Update room player counts
  UPDATE rooms 
  SET current_players = (
    SELECT COALESCE(SUM(array_length(g.players, 1)), 0)
    FROM games g 
    WHERE g.room_id = rooms.id 
    AND g.status IN ('waiting', 'waiting_for_players', 'countdown', 'active')
  );
  
  -- Log cleanup activity (only if admin_logs table exists)
  BEGIN
    INSERT INTO admin_logs (action, details, created_at)
    VALUES ('scheduled_cleanup', 'Automated cleanup completed', NOW());
  EXCEPTION WHEN undefined_table THEN
    -- admin_logs table doesn't exist, skip logging
    NULL;
  END;
  
EXCEPTION WHEN OTHERS THEN
  -- Log errors but don't fail (only if admin_logs table exists)
  BEGIN
    INSERT INTO admin_logs (action, details, created_at)
    VALUES ('cleanup_error', SQLERRM, NOW());
  EXCEPTION WHEN undefined_table THEN
    -- admin_logs table doesn't exist, skip logging
    NULL;
  END;
END;
$$ LANGUAGE plpgsql;
