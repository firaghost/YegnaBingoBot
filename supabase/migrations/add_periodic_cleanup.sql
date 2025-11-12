-- Add periodic cleanup for disconnected players
-- This will automatically clean up players who left without proper cleanup

-- 1. Create function to clean up old games and disconnected players
CREATE OR REPLACE FUNCTION cleanup_disconnected_players()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER := 0;
  game_record RECORD;
BEGIN
  -- Clean up games that have been in waiting/countdown for too long (over 5 minutes)
  FOR game_record IN 
    SELECT id, players, room_id, status, created_at
    FROM games 
    WHERE status IN ('waiting', 'countdown') 
      AND created_at < NOW() - INTERVAL '5 minutes'
  LOOP
    -- Finish old games
    UPDATE games 
    SET status = 'finished', 
        ended_at = NOW()
    WHERE id = game_record.id;
    
    cleaned_count := cleaned_count + 1;
    
    RAISE NOTICE 'Cleaned up old game: % (status: %, age: %)', 
      game_record.id, 
      game_record.status, 
      NOW() - game_record.created_at;
  END LOOP;
  
  -- Clean up games with empty player arrays
  UPDATE games 
  SET status = 'finished', 
      ended_at = NOW()
  WHERE status IN ('waiting', 'countdown') 
    AND (
      players IS NULL 
      OR players = '{}' 
      OR array_length(players, 1) IS NULL
      OR array_length(players, 1) = 0
    );
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a function to be called via API for manual cleanup
CREATE OR REPLACE FUNCTION force_cleanup_user_from_games(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER := 0;
  game_record RECORD;
  updated_players UUID[];
BEGIN
  -- Find all games where this user is still listed as a player
  FOR game_record IN 
    SELECT id, players, prize_pool, stake
    FROM games 
    WHERE status IN ('waiting', 'countdown') 
      AND players @> ARRAY[user_uuid]
  LOOP
    -- Remove user from players array
    updated_players := array_remove(game_record.players, user_uuid);
    
    IF array_length(updated_players, 1) IS NULL OR array_length(updated_players, 1) = 0 THEN
      -- No players left, finish the game
      UPDATE games 
      SET status = 'finished',
          ended_at = NOW(),
          players = updated_players,
          prize_pool = 0
      WHERE id = game_record.id;
    ELSE
      -- Update player list and prize pool
      UPDATE games 
      SET players = updated_players,
          prize_pool = array_length(updated_players, 1) * COALESCE(stake, 10)
      WHERE id = game_record.id;
    END IF;
    
    cleaned_count := cleaned_count + 1;
    
    RAISE NOTICE 'Removed user % from game %', user_uuid, game_record.id;
  END LOOP;
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Show current games that might need cleanup
SELECT 
  'Games that might need cleanup:' as info,
  id,
  status,
  array_length(players, 1) as player_count,
  players,
  created_at,
  NOW() - created_at as age
FROM games 
WHERE status IN ('waiting', 'countdown')
ORDER BY created_at DESC;

RAISE NOTICE 'Cleanup functions created. Use cleanup_disconnected_players() to clean old games, or force_cleanup_user_from_games(uuid) to remove specific users.';
