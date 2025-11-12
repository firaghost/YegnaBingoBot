-- Add XP System and Database Cleanup Migration
-- This migration adds the XP system and cleans up unnecessary tables

-- 1. Add XP column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'xp') THEN
        ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
        RAISE NOTICE 'Added xp column to users table';
    END IF;
END $$;

-- 2. Update existing users to have some initial XP based on games played
UPDATE users 
SET xp = COALESCE(games_played * 10, 0) 
WHERE xp IS NULL OR xp = 0;

-- 3. Create user_achievements table for tracking achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    achievement_name VARCHAR(100) NOT NULL,
    description TEXT,
    xp_reward INTEGER DEFAULT 0,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_type, achievement_name)
);

-- 4. Create referrals table for tracking referral system
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20),
    bonus_amount DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(referred_id) -- Each user can only be referred once
);

-- 5. Create daily_bonuses table for tracking daily bonus claims
CREATE TABLE IF NOT EXISTS daily_bonuses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bonus_type VARCHAR(30) NOT NULL, -- 'daily_login', 'streak', 'special'
    amount DECIMAL(10,2) NOT NULL,
    streak_day INTEGER DEFAULT 1,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 6. Create game_logs table for detailed game event logging
CREATE TABLE IF NOT EXISTS game_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'join', 'leave', 'number_called', 'mark', 'bingo', 'win'
    event_data JSONB,
    xp_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_daily_bonuses_user_date ON daily_bonuses(user_id, claimed_at);
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_user_id ON game_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_event_type ON game_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);

-- 8. Drop unnecessary tables (be careful - check if they're actually unused first)
-- Uncomment these after confirming they're not needed:

-- DROP TABLE IF EXISTS system_settings CASCADE; -- Replaced by admin_config
-- DROP TABLE IF EXISTS old_admin_settings CASCADE; -- If this exists
-- DROP TABLE IF EXISTS user_sessions CASCADE; -- If using Supabase auth instead
-- DROP TABLE IF EXISTS temp_migrations CASCADE; -- Temporary migration tables
-- DROP TABLE IF EXISTS backup_users CASCADE; -- Old backup tables

-- 9. Create functions for XP management
CREATE OR REPLACE FUNCTION award_xp(user_uuid UUID, xp_amount INTEGER, reason TEXT DEFAULT 'Game activity')
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update user XP
    UPDATE users 
    SET xp = COALESCE(xp, 0) + xp_amount,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Log the XP award if it's significant
    IF xp_amount >= 10 THEN
        INSERT INTO game_logs (user_id, event_type, event_data, xp_earned)
        VALUES (user_uuid, 'xp_award', jsonb_build_object('reason', reason, 'amount', xp_amount), xp_amount);
    END IF;
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- 10. Create function to get user level from XP
CREATE OR REPLACE FUNCTION get_user_level(user_xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN FLOOR(COALESCE(user_xp, 0) / 100) + 1;
END;
$$;

-- 11. Create function to get level badge
CREATE OR REPLACE FUNCTION get_level_badge(user_level INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    CASE 
        WHEN user_level <= 10 THEN RETURN '🟢 Beginner';
        WHEN user_level <= 25 THEN RETURN '🟡 Intermediate';
        WHEN user_level <= 50 THEN RETURN '🟠 Advanced';
        WHEN user_level <= 75 THEN RETURN '🔴 Expert';
        ELSE RETURN '⚫ Legend';
    END CASE;
END;
$$;

-- 12. Add comments for documentation
COMMENT ON TABLE user_achievements IS 'Tracks user achievements and badges';
COMMENT ON TABLE referrals IS 'Manages referral system and bonuses';
COMMENT ON TABLE daily_bonuses IS 'Tracks daily bonus claims and streaks';
COMMENT ON TABLE game_logs IS 'Detailed logging of game events and XP awards';
COMMENT ON FUNCTION award_xp(UUID, INTEGER, TEXT) IS 'Awards XP to a user and logs the event';
COMMENT ON FUNCTION get_user_level(INTEGER) IS 'Calculates user level from XP amount';
COMMENT ON FUNCTION get_level_badge(INTEGER) IS 'Returns level badge text for given level';

-- 13. Insert some initial achievements
INSERT INTO user_achievements (user_id, achievement_type, achievement_name, description, xp_reward)
SELECT DISTINCT 
    id,
    'milestone',
    'First Game',
    'Played your first bingo game',
    25
FROM users 
WHERE games_played >= 1
ON CONFLICT (user_id, achievement_type, achievement_name) DO NOTHING;

INSERT INTO user_achievements (user_id, achievement_type, achievement_name, description, xp_reward)
SELECT DISTINCT 
    id,
    'milestone', 
    'First Win',
    'Won your first bingo game',
    50
FROM users 
WHERE games_won >= 1
ON CONFLICT (user_id, achievement_type, achievement_name) DO NOTHING;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'XP system and database cleanup completed successfully';
    RAISE NOTICE 'Added: XP column, achievements, referrals, daily bonuses, game logs';
    RAISE NOTICE 'Created: XP management functions and level system';
END
$$;
