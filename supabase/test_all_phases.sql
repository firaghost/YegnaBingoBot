-- Test all three phases of best practices implementation
-- Run these tests to verify everything is working

-- ============================================
-- PHASE 1: Test Atomic Player Joining
-- ============================================

-- Create a test game
SELECT 'PHASE 1: Testing Game Creation' as test_phase;
SELECT * FROM create_game_safe('classic', gen_random_uuid(), 10.00);

-- Test adding players (replace with actual game_id from above)
-- SELECT * FROM add_player_to_game('YOUR_GAME_ID'::uuid, gen_random_uuid(), 20);

-- ============================================
-- PHASE 2: Test Bingo Validation (Manual Test)
-- ============================================

SELECT 'PHASE 2: Bingo Validation Function Available' as test_phase;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'validate_bingo_claim';

-- Note: Bingo validation requires actual game with called numbers
-- Test this through the API: POST /api/game/claim-bingo

-- ============================================
-- PHASE 3: Test Fair Number Calling
-- ============================================

SELECT 'PHASE 3: Testing Number Calling' as test_phase;

-- First create and start a game, then test number calling
-- SELECT * FROM call_next_number('YOUR_ACTIVE_GAME_ID'::uuid);

-- ============================================
-- SYSTEM HEALTH CHECK
-- ============================================

SELECT 'SYSTEM HEALTH: Game Statistics' as test_phase;
SELECT * FROM get_game_statistics();

SELECT 'SYSTEM HEALTH: Cleanup Test' as test_phase;
SELECT * FROM cleanup_old_games();

-- ============================================
-- VERIFICATION CHECKLIST
-- ============================================

SELECT 'VERIFICATION: All Functions Exist' as test_phase;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'create_game_safe',
  'add_player_to_game',
  'validate_bingo_claim', 
  'call_next_number',
  'cleanup_old_games',
  'get_game_statistics'
)
ORDER BY routine_name;
