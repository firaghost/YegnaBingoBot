-- Test the cleanup function after fixing updated_at issues
-- Run this to verify the function works

-- Test cleanup function
SELECT * FROM cleanup_old_games();

-- Should return something like:
-- cleaned_games | message
-- 0            | Cleaned up 0 old games
