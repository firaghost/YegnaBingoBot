-- ============================================
-- ADD BONUS BALANCE AND REFERRAL TRACKING
-- Run this in Supabase SQL Editor
-- ============================================

-- Add bonus_balance column to users table
-- New users get 3 ETB bonus for registration only
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance DECIMAL(10, 2) DEFAULT 0.00;

-- Add referral tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_earnings DECIMAL(10, 2) DEFAULT 0;

-- Add daily streak tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_play_date DATE;

-- Create unique index on referral_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- Update existing users to have a referral code (using telegram_id)
UPDATE users SET referral_code = telegram_id WHERE referral_code IS NULL;

COMMENT ON COLUMN users.bonus_balance IS 'Bonus balance that can be used for playing games';
COMMENT ON COLUMN users.referral_code IS 'Unique referral code for inviting friends';
COMMENT ON COLUMN users.referred_by IS 'Referral code of the user who referred this user';
COMMENT ON COLUMN users.total_referrals IS 'Total number of successful referrals';
COMMENT ON COLUMN users.referral_earnings IS 'Total ETB earned from referrals';
COMMENT ON COLUMN users.daily_streak IS 'Current daily play streak';
COMMENT ON COLUMN users.last_play_date IS 'Last date the user played a game';
