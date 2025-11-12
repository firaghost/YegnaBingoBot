-- Clean up stuck games and add automatic cleanup
-- This fixes games that are stuck in waiting status

-- 1. Clean up games with no players or empty player arrays
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

-- 2. Clean up old waiting games (older than 1 hour)
UPDATE games 
SET status = 'finished', 
    ended_at = NOW()
WHERE status IN ('waiting', 'countdown') 
  AND created_at < NOW() - INTERVAL '1 hour';

-- 3. Create function to automatically clean up games
CREATE OR REPLACE FUNCTION cleanup_empty_games()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Clean up games with no players
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
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Also clean up old games (older than 2 hours)
  UPDATE games 
  SET status = 'finished', 
      ended_at = NOW()
  WHERE status IN ('waiting', 'countdown') 
    AND created_at < NOW() - INTERVAL '2 hours';
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a trigger to auto-cleanup when players array becomes empty
CREATE OR REPLACE FUNCTION auto_cleanup_empty_game()
RETURNS TRIGGER AS $$
BEGIN
  -- If players array becomes empty, finish the game
  IF NEW.status IN ('waiting', 'countdown') AND (
    NEW.players IS NULL 
    OR NEW.players = '{}' 
    OR array_length(NEW.players, 1) IS NULL
    OR array_length(NEW.players, 1) = 0
  ) THEN
    NEW.status := 'finished';
    NEW.ended_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_cleanup_empty_game ON games;
CREATE TRIGGER trigger_auto_cleanup_empty_game
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION auto_cleanup_empty_game();

-- 6. Show current game status after cleanup
SELECT 
  'Games after cleanup:' as info,
  status,
  COUNT(*) as count,
  array_length(players, 1) as player_count
FROM games 
GROUP BY status, array_length(players, 1)
ORDER BY status, player_count;

RAISE NOTICE 'Game cleanup completed - stuck games have been cleaned up';
