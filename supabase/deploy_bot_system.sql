-- ============================================
-- DEPLOY COMPLETE BOT SYSTEM
-- ============================================

-- Step 1: Fix rooms table for bot system
\i fix_rooms_table_for_bots.sql

-- Step 2: Create bot players system
\i create_bot_players_table.sql

-- Final success message
SELECT '🤖 BOT SYSTEM DEPLOYMENT COMPLETE!' as status;
SELECT 'Next steps:' as instructions;
SELECT '1. Restart your Railway server' as step1;
SELECT '2. Go to /mgmt-portal-x7k9p2/bots to manage bots' as step2;
SELECT '3. Click "Start Auto-Join" to activate bot monitoring' as step3;
SELECT '4. Join a game room and wait - bots will join automatically!' as step4;
