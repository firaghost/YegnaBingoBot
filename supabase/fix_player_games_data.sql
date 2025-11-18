-- ============================================
-- CLEAR GAME HISTORY FROM 11/17/2025 AND BEFORE
-- ============================================

-- Step 1: See how many games will be deleted by date
SELECT 
  COUNT(*) as games_to_delete,
  DATE(created_at) as date
FROM games
WHERE DATE(created_at) <= '2025-11-17'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Step 2: See total games to be deleted
SELECT 
  COUNT(*) as total_games_to_delete
FROM games
WHERE DATE(created_at) <= '2025-11-17';

-- Step 3: See sample of games that will be deleted
SELECT 
  id,
  players,
  winner_id,
  status,
  created_at
FROM games
WHERE DATE(created_at) <= '2025-11-17'
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: DELETE all games from 11/17/2025 and before
-- UNCOMMENT THE LINE BELOW TO EXECUTE THE DELETE
-- DELETE FROM games WHERE DATE(created_at) <= '2025-11-17';

-- Step 4: Verify deletion (run after delete)
-- SELECT COUNT(*) as remaining_games FROM games WHERE DATE(created_at) = '2025-11-18';
