-- ============================================
-- DATABASE ANALYSIS REPORT
-- Based on codebase analysis and current database state
-- ============================================

/*
TABLES CURRENTLY USED IN CODEBASE (DO NOT DROP):

✅ CORE TABLES (HEAVILY USED):
- users (15 rows) - Used in: bot, auth, API routes, admin panel
- games (74 rows) - Used in: game system, API routes, socket server
- rooms (3 rows) - Used in: game system, waiting room manager, API
- transactions (428 rows) - Used in: wallet, deposits, withdrawals
- admin_config (45 rows) - Used in: admin panel, configuration system

✅ GAME SYSTEM TABLES (ACTIVELY USED):
- player_cards (149 rows) - Used in: game system for bingo cards
- levels (3 rows) - Used in: level handlers, XP system
- current_leaderboard (0 rows) - Used in: leaderboard API, level handlers

✅ ADMIN SYSTEM TABLES (USED):
- admin_users (1 row) - Used in: admin auth, level handlers
- broadcasts (8 rows) - Used in: admin broadcast system

✅ WAITING ROOM SYSTEM (USED):
- room_players (0 rows) - Used in: waiting room manager
- game_sessions (0 rows) - Used in: game state manager, waiting room

⚠️ TABLES WITH QUESTIONABLE USAGE:
- system_settings (26 rows) - SHOULD BE MIGRATED to admin_config
- transaction_history (4 rows) - May be duplicate of transactions table
- withdrawals (2 rows) - May be integrated into transactions
- super_admin_activity_log (2 rows) - Admin logging (may keep)
- super_admin_sessions (2 rows) - Admin sessions (may keep)

❌ EMPTY TABLES (SAFE TO DROP):
- game_history (0 rows) - Not used in codebase
- payments (0 rows) - Not used in codebase  
- bingo_claims (0 rows) - Not used in codebase
- game_numbers (0 rows) - Not used in codebase
- game_players (0 rows) - Not used in codebase (different from room_players)
- leaderboard (0 rows) - Not used (replaced by current_leaderboard)
- leaderboard_history (0 rows) - Not used in codebase
- game_status_audit (0 rows) - Not used in codebase

❌ ADMIN TABLES (LIKELY TEST DATA):
- super_admins (1 row) - May be test data
- admins (1 row) - May be test data

MISSING TABLES THAT SHOULD EXIST:
- user_achievements - For XP/achievement system
- referrals - For referral system  
- daily_bonuses - For daily bonus tracking
- game_logs - For detailed game event logging
*/

-- ============================================
-- RECOMMENDED ACTIONS
-- ============================================

-- 1. MIGRATE system_settings to admin_config
DO $$
BEGIN
    -- Check if system_settings exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        -- Migrate any remaining settings
        INSERT INTO admin_config (config_key, config_value, description, is_active, created_at, updated_at)
        SELECT 
            key as config_key,
            value as config_value,
            CONCAT('Migrated from system_settings: ', key) as description,
            true as is_active,
            NOW() as created_at,
            NOW() as updated_at
        FROM system_settings
        WHERE key NOT IN (SELECT config_key FROM admin_config)
        ON CONFLICT (config_key) DO NOTHING;
        
        RAISE NOTICE 'Migrated system_settings data to admin_config';
    END IF;
END $$;

-- 2. ADD XP COLUMN TO USERS TABLE (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'xp') THEN
        ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
        RAISE NOTICE 'Added xp column to users table';
    END IF;
END $$;

-- 3. ADD MISSING COLUMNS TO USERS TABLE
DO $$
BEGIN
    -- Add bonus_balance if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'bonus_balance') THEN
        ALTER TABLE users ADD COLUMN bonus_balance DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added bonus_balance column to users table';
    END IF;
    
    -- Add daily_streak if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'daily_streak') THEN
        ALTER TABLE users ADD COLUMN daily_streak INTEGER DEFAULT 0;
        RAISE NOTICE 'Added daily_streak column to users table';
    END IF;
    
    -- Add last_daily_claim if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'last_daily_claim') THEN
        ALTER TABLE users ADD COLUMN last_daily_claim TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added last_daily_claim column to users table';
    END IF;
END $$;

-- 4. VERIFY CRITICAL TABLES EXIST
DO $$
BEGIN
    -- Check if critical tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Critical table users does not exist!';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games') THEN
        RAISE EXCEPTION 'Critical table games does not exist!';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms') THEN
        RAISE EXCEPTION 'Critical table rooms does not exist!';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        RAISE EXCEPTION 'Critical table transactions does not exist!';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_config') THEN
        RAISE EXCEPTION 'Critical table admin_config does not exist!';
    END IF;
    
    RAISE NOTICE 'All critical tables verified to exist';
END $$;

-- ============================================
-- SAFE CLEANUP (ONLY AFTER VERIFICATION)
-- ============================================

-- STEP 1: Drop empty tables that are not used in codebase
-- UNCOMMENT THESE AFTER DOUBLE-CHECKING THEY'RE NOT NEEDED:

-- DROP TABLE IF EXISTS game_history CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;
-- DROP TABLE IF EXISTS bingo_claims CASCADE;
-- DROP TABLE IF EXISTS game_numbers CASCADE;
-- DROP TABLE IF EXISTS game_players CASCADE;
-- DROP TABLE IF EXISTS leaderboard CASCADE;
-- DROP TABLE IF EXISTS leaderboard_history CASCADE;
-- DROP TABLE IF EXISTS game_status_audit CASCADE;

-- STEP 2: Drop system_settings ONLY after confirming migration worked
-- DROP TABLE IF EXISTS system_settings CASCADE;

-- STEP 3: Analyze and potentially merge duplicate tables
-- Consider merging transaction_history into transactions
-- Consider merging withdrawals into transactions

RAISE NOTICE 'Database analysis complete. Review recommendations before proceeding with cleanup.';
