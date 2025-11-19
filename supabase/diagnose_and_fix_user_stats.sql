-- ============================================
-- DIAGNOSE AND FIX USER STATS
-- Run this to identify and fix data issues
-- ============================================

-- Step 1: DIAGNOSE - Check games table structure and data
SELECT 'DIAGNOSIS: Games Table' as step;
SELECT 
  COUNT(*) as total_games,
  COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_games,
  COUNT(CASE WHEN players IS NULL THEN 1 END) as null_players,
  COUNT(CASE WHEN players = '{}' THEN 1 END) as empty_players,
  COUNT(CASE WHEN winner_id IS NOT NULL THEN 1 END) as games_with_winner
FROM games;

-- Step 2: DIAGNOSE - Check users table
SELECT 'DIAGNOSIS: Users Table' as step;
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN games_played = 0 THEN 1 END) as users_with_zero_games,
  COUNT(CASE WHEN balance = 0 THEN 1 END) as users_with_zero_balance,
  SUM(games_played) as total_games_played_in_users,
  SUM(games_won) as total_wins_in_users,
  SUM(balance) as total_balance
FROM users;

-- Step 3: DIAGNOSE - Check for specific user (example: first user)
SELECT 'DIAGNOSIS: Sample User Details' as step;
SELECT 
  u.id,
  u.username,
  u.telegram_id,
  u.games_played as recorded_games,
  u.games_won as recorded_wins,
  u.balance as recorded_balance,
  u.total_winnings as recorded_winnings
FROM users u
LIMIT 1;

-- Step 4: DIAGNOSE - Count actual games for that user from games table
SELECT 'DIAGNOSIS: Actual Games for Sample User' as step;
WITH sample_user AS (
  SELECT id FROM users LIMIT 1
)
SELECT 
  (SELECT COUNT(*) FROM games g WHERE g.players @> ARRAY[(SELECT id FROM sample_user)]) as actual_games_played,
  (SELECT COUNT(*) FROM games g WHERE g.winner_id = (SELECT id FROM sample_user)) as actual_games_won,
  (SELECT COALESCE(SUM(net_prize), 0) FROM games g WHERE g.winner_id = (SELECT id FROM sample_user) AND g.status = 'finished') as actual_winnings;

-- Step 5: FIX - Create function to recalculate user stats from games
CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  games_played INTEGER,
  games_won INTEGER,
  total_winnings NUMERIC,
  fix_status TEXT
) AS $$
DECLARE
  v_games_played INTEGER;
  v_games_won INTEGER;
  v_total_winnings NUMERIC;
BEGIN
  -- Count games where user is in players array
  SELECT COUNT(*)
  INTO v_games_played
  FROM games g
  WHERE g.status = 'finished' 
    AND g.players @> ARRAY[p_user_id];

  -- Count games where user is the winner
  SELECT COUNT(*)
  INTO v_games_won
  FROM games g
  WHERE g.status = 'finished'
    AND g.winner_id = p_user_id;

  -- Sum total winnings
  SELECT COALESCE(SUM(g.net_prize), 0)
  INTO v_total_winnings
  FROM games g
  WHERE g.status = 'finished'
    AND g.winner_id = p_user_id;

  -- Update user record
  UPDATE users u
  SET 
    games_played = v_games_played,
    games_won = v_games_won,
    total_winnings = v_total_winnings,
    updated_at = NOW()
  WHERE u.id = p_user_id;

  RETURN QUERY
  SELECT 
    p_user_id,
    v_games_played,
    v_games_won,
    v_total_winnings,
    'FIXED'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Step 6: FIX - Recalculate stats for ALL users
SELECT 'FIXING: Recalculating stats for all users...' as step;

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  FOR v_user_id IN SELECT id FROM users LOOP
    PERFORM recalculate_user_stats(v_user_id);
  END LOOP;
  RAISE NOTICE 'All user stats recalculated!';
END $$;

-- Step 7: VERIFY - Check results
SELECT 'VERIFICATION: Updated User Stats' as step;
SELECT 
  username,
  telegram_id,
  games_played,
  games_won,
  total_winnings,
  balance,
  updated_at
FROM users
ORDER BY games_played DESC
LIMIT 20;

-- Step 8: VERIFY - Check for discrepancies
SELECT 'VERIFICATION: Checking for data issues' as step;
SELECT 
  u.username,
  u.games_played,
  u.games_won,
  CASE 
    WHEN u.games_won > u.games_played THEN 'ERROR: More wins than games!'
    WHEN u.games_played = 0 AND u.balance > 5 THEN 'WARNING: Zero games but balance > 5'
    ELSE 'OK'
  END as status
FROM users u
WHERE u.games_played > 0 OR u.balance != 5
ORDER BY u.games_played DESC;
