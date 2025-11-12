-- ============================================
-- SAFE ROOM DELETION FUNCTION
-- Handles cascading deletes for rooms with associated data
-- ============================================

-- Function to safely delete a room and all associated data
CREATE OR REPLACE FUNCTION safe_delete_room(p_room_id TEXT)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  deleted_games INTEGER,
  deleted_players INTEGER
) AS $$
DECLARE
  active_games_count INTEGER := 0;
  deleted_games_count INTEGER := 0;
  deleted_players_count INTEGER := 0;
BEGIN
  -- Check for active games
  SELECT COUNT(*) INTO active_games_count
  FROM games 
  WHERE room_id = p_room_id 
    AND status IN ('waiting', 'active');
  
  -- If there are active games, don't allow deletion
  IF active_games_count > 0 THEN
    RETURN QUERY SELECT 
      FALSE as success,
      format('Cannot delete room: %s active games found. Please wait for them to finish.', active_games_count) as message,
      0 as deleted_games,
      0 as deleted_players;
    RETURN;
  END IF;
  
  -- Delete associated games (completed ones)
  DELETE FROM games WHERE room_id = p_room_id;
  GET DIAGNOSTICS deleted_games_count = ROW_COUNT;
  
  -- Delete room players (if table exists)
  BEGIN
    DELETE FROM room_players WHERE room_id = p_room_id;
    GET DIAGNOSTICS deleted_players_count = ROW_COUNT;
  EXCEPTION
    WHEN undefined_table THEN
      deleted_players_count := 0;
  END;
  
  -- Delete game sessions (if table exists)
  BEGIN
    DELETE FROM game_sessions WHERE room_id = p_room_id;
  EXCEPTION
    WHEN undefined_table THEN
      -- Table doesn't exist, continue
      NULL;
  END;
  
  -- Finally delete the room
  DELETE FROM rooms WHERE id = p_room_id;
  
  -- Check if room was actually deleted
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE as success,
      'Room not found or could not be deleted' as message,
      deleted_games_count as deleted_games,
      deleted_players_count as deleted_players;
    RETURN;
  END IF;
  
  -- Success
  RETURN QUERY SELECT 
    TRUE as success,
    format('Room deleted successfully. Removed %s games and %s players.', deleted_games_count, deleted_players_count) as message,
    deleted_games_count as deleted_games,
    deleted_players_count as deleted_players;
END;
$$ LANGUAGE plpgsql;

-- Function to get room deletion info (preview what would be deleted)
CREATE OR REPLACE FUNCTION get_room_deletion_info(p_room_id TEXT)
RETURNS TABLE(
  room_exists BOOLEAN,
  active_games INTEGER,
  completed_games INTEGER,
  total_players INTEGER,
  can_delete BOOLEAN,
  warning_message TEXT
) AS $$
DECLARE
  room_count INTEGER := 0;
  active_count INTEGER := 0;
  completed_count INTEGER := 0;
  player_count INTEGER := 0;
BEGIN
  -- Check if room exists
  SELECT COUNT(*) INTO room_count FROM rooms WHERE id = p_room_id;
  
  IF room_count = 0 THEN
    RETURN QUERY SELECT 
      FALSE as room_exists,
      0 as active_games,
      0 as completed_games,
      0 as total_players,
      FALSE as can_delete,
      'Room not found' as warning_message;
    RETURN;
  END IF;
  
  -- Count active games
  SELECT COUNT(*) INTO active_count
  FROM games 
  WHERE room_id = p_room_id 
    AND status IN ('waiting', 'active');
  
  -- Count completed games
  SELECT COUNT(*) INTO completed_count
  FROM games 
  WHERE room_id = p_room_id 
    AND status NOT IN ('waiting', 'active');
  
  -- Count players (if table exists)
  BEGIN
    SELECT COUNT(*) INTO player_count
    FROM room_players 
    WHERE room_id = p_room_id;
  EXCEPTION
    WHEN undefined_table THEN
      player_count := 0;
  END;
  
  -- Determine if can delete and create warning message
  RETURN QUERY SELECT 
    TRUE as room_exists,
    active_count as active_games,
    completed_count as completed_games,
    player_count as total_players,
    (active_count = 0) as can_delete,
    CASE 
      WHEN active_count > 0 THEN 
        format('Cannot delete: %s active games in progress', active_count)
      WHEN completed_count > 0 OR player_count > 0 THEN
        format('Will delete %s completed games and %s player records', completed_count, player_count)
      ELSE
        'Room is empty and safe to delete'
    END as warning_message;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION safe_delete_room(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_deletion_info(TEXT) TO authenticated;

-- Example usage:
-- SELECT * FROM get_room_deletion_info('speed');
-- SELECT * FROM safe_delete_room('speed');
