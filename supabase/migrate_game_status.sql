-- Migration: Add game_status column with intelligent status detection
-- This script analyzes each game and assigns the correct status based on game state

-- Step 0: Check existing status constraint
-- First, let's see what values are allowed in the status column
-- The error shows games_status_check constraint - we need to work within those allowed values

-- Step 1: Add the new game_status column
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_status TEXT DEFAULT 'active';

-- Step 2: Drop old function if it exists
DROP FUNCTION IF EXISTS determine_game_status(TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER, UUID) CASCADE;

-- Step 3: Create a function to determine correct game status
CREATE FUNCTION determine_game_status(
  p_status TEXT,
  p_started_at TIMESTAMP WITH TIME ZONE,
  p_ended_at TIMESTAMP WITH TIME ZONE,
  p_players_count INT,
  p_called_numbers_count INT,
  p_winner_id UUID
) RETURNS TEXT AS $$
BEGIN
  -- CANCELED: Finished before it started (no players, no numbers called, no winner, no times)
  IF p_status = 'finished' AND 
     (p_started_at IS NULL OR p_ended_at IS NULL) AND
     (p_players_count = 0 OR p_players_count IS NULL) AND
     (p_called_numbers_count = 0 OR p_called_numbers_count IS NULL) AND
     p_winner_id IS NULL THEN
    RETURN 'finished_canceled';
  END IF;
  
  -- NO_WINNER: Game was played but no one won
  IF p_status = 'finished' AND 
     p_started_at IS NOT NULL AND 
     p_ended_at IS NOT NULL AND
     (p_players_count > 0 AND p_players_count IS NOT NULL) AND
     (p_called_numbers_count > 0 AND p_called_numbers_count IS NOT NULL) AND
     p_winner_id IS NULL THEN
    RETURN 'finished_no_winner';
  END IF;
  
  -- FINISHED: Game completed with a winner
  IF p_status = 'finished' AND 
     p_started_at IS NOT NULL AND 
     p_ended_at IS NOT NULL AND
     p_winner_id IS NOT NULL THEN
    RETURN 'finished_winner';
  END IF;
  
  -- Keep original status for other cases
  RETURN p_status;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Update all games with correct status
UPDATE games
SET game_status = determine_game_status(
  status,
  started_at,
  ended_at,
  COALESCE(array_length(players, 1), 0),
  COALESCE(array_length(called_numbers, 1), 0),
  winner_id
);

-- Step 5: Verify the migration - show statistics
SELECT 
  game_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM games), 2) as percentage
FROM games
GROUP BY game_status
ORDER BY count DESC;

-- Step 6: Show examples of each status type
SELECT 'CANCELED GAMES' as category, id, status, game_status, COALESCE(array_length(players, 1), 0) as player_count, COALESCE(array_length(called_numbers, 1), 0) as numbers_called, winner_id
FROM games
WHERE game_status = 'finished_canceled'
LIMIT 5;

SELECT 'NO_WINNER GAMES' as category, id, status, game_status, COALESCE(array_length(players, 1), 0) as player_count, COALESCE(array_length(called_numbers, 1), 0) as numbers_called, winner_id
FROM games
WHERE game_status = 'finished_no_winner'
LIMIT 5;

SELECT 'FINISHED WITH WINNER' as category, id, status, game_status, COALESCE(array_length(players, 1), 0) as player_count, COALESCE(array_length(called_numbers, 1), 0) as numbers_called, winner_id
FROM games
WHERE game_status = 'finished_winner'
LIMIT 5;

SELECT 'ACTIVE GAMES' as category, id, status, game_status, COALESCE(array_length(players, 1), 0) as player_count, COALESCE(array_length(called_numbers, 1), 0) as numbers_called, winner_id
FROM games
WHERE game_status = 'active'
LIMIT 5;

-- Step 7: Verify data integrity - check for any mismatches
SELECT 
  'INTEGRITY CHECK' as check_type,
  COUNT(*) as issues_found,
  'Games with status=finished but no game_status set' as issue_description
FROM games
WHERE status = 'finished' AND game_status IS NULL;

SELECT 
  'INTEGRITY CHECK' as check_type,
  COUNT(*) as issues_found,
  'Games with winner but game_status != finished_winner' as issue_description
FROM games
WHERE winner_id IS NOT NULL AND game_status != 'finished_winner';

SELECT 
  'INTEGRITY CHECK' as check_type,
  COUNT(*) as issues_found,
  'Canceled games that have players' as issue_description
FROM games
WHERE game_status = 'finished_canceled' AND array_length(players, 1) > 0;

SELECT 
  'INTEGRITY CHECK' as check_type,
  COUNT(*) as issues_found,
  'No_winner games without start/end times' as issue_description
FROM games
WHERE game_status = 'finished_no_winner' AND (started_at IS NULL OR ended_at IS NULL);

-- Step 8: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_games_game_status ON games(game_status);

-- Step 9: Summary
SELECT 
  '✅ Migration Complete' as status,
  COUNT(*) as total_games,
  COUNT(CASE WHEN game_status IS NOT NULL THEN 1 END) as games_with_status,
  COUNT(CASE WHEN game_status IS NULL THEN 1 END) as games_without_status
FROM games;
