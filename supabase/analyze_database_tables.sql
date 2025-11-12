-- Database Analysis and Cleanup Script
-- This script analyzes existing tables and identifies what to keep, modify, or drop

-- 1. List all tables in the public schema
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Check table sizes and row counts
SELECT 
    schemaname,
    tablename,
    n_tup_ins as "Inserts",
    n_tup_upd as "Updates", 
    n_tup_del as "Deletes",
    n_live_tup as "Live Rows",
    n_dead_tup as "Dead Rows"
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;

-- 3. Identify foreign key relationships
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema='public'
ORDER BY tc.table_name;

-- 4. Check for unused/empty tables
SELECT 
    t.table_name,
    COALESCE(s.n_live_tup, 0) as row_count
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY COALESCE(s.n_live_tup, 0);

-- Analysis Results and Recommendations:

/*
ESSENTIAL TABLES (Keep):
- users: Core user data with XP, levels, balances
- games: Game instances and results  
- rooms: Game room configurations
- transactions: Financial transaction history
- admin_config: Unified configuration system
- game_numbers: Called numbers for each game
- user_cards: Bingo cards for players

TABLES TO REVIEW/MODIFY:
- system_settings: DEPRECATED - Replace with admin_config
- admin_settings: DROPPED - Already migrated to admin_config  
- user_sessions: May be redundant if using Supabase auth
- notifications: Keep if used for in-app notifications
- leaderboard: May be redundant - can generate from users table

TABLES TO POTENTIALLY DROP:
- test_* tables: Any test tables should be removed
- backup_* tables: Old backup tables
- temp_* tables: Temporary tables
- migration_* tables: Old migration tracking tables

MISSING TABLES NEEDED:
- user_achievements: For tracking achievements and badges
- game_logs: For detailed game event logging
- referrals: For tracking referral system
- daily_bonuses: For tracking daily bonus claims
*/
