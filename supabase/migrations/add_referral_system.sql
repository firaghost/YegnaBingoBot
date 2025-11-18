-- ============================================
-- REFERRAL SYSTEM MIGRATION
-- ============================================
-- Adds referral tracking and bonus system to users table

-- Add referral columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_earnings DECIMAL(10, 2) DEFAULT 0;

-- Create index for faster referral lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);

-- Create referrals table to track all referral relationships
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bonus_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referrer_id, referred_user_id)
);

-- Create indexes for referrals table
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Function to process referral bonus when a new user registers with a referral code
CREATE OR REPLACE FUNCTION process_referral_bonus(
  p_referred_user_id UUID,
  p_referral_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_bonus DECIMAL;
BEGIN
  -- Get referrer from referral code
  SELECT id INTO v_referrer_id
  FROM users
  WHERE referral_code = p_referral_code
  LIMIT 1;

  -- If no referrer found, return false
  IF v_referrer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get referral bonus amount from admin config
  SELECT CAST(config_value AS DECIMAL)
  INTO v_referral_bonus
  FROM admin_config
  WHERE config_key = 'referral_bonus'
  AND is_active = true
  LIMIT 1;

  -- Use default if not configured
  IF v_referral_bonus IS NULL THEN
    v_referral_bonus := 25.00;
  END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referred_user_id, bonus_amount, status)
  VALUES (v_referrer_id, p_referred_user_id, v_referral_bonus, 'completed');

  -- Update referrer stats
  UPDATE users
  SET 
    total_referrals = COALESCE(total_referrals, 0) + 1,
    referral_earnings = COALESCE(referral_earnings, 0) + v_referral_bonus,
    bonus_balance = COALESCE(bonus_balance, 0) + v_referral_bonus,
    updated_at = NOW()
  WHERE id = v_referrer_id;

  -- Update referred user's referrer_id
  UPDATE users
  SET 
    referrer_id = v_referrer_id,
    updated_at = NOW()
  WHERE id = p_referred_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID, TEXT) TO service_role;

-- Populate referral codes for existing users (if not already set)
-- Use telegram_id as referral code for existing users
UPDATE users
SET referral_code = telegram_id
WHERE referral_code IS NULL;

-- Log the changes
SELECT 'REFERRAL SYSTEM INSTALLED SUCCESSFULLY!' as status;
SELECT 'New columns: users.referrer_id, users.referral_code, users.total_referrals, users.referral_earnings' as changes;
SELECT 'New table: referrals' as tables;
SELECT 'New function: process_referral_bonus' as functions;
SELECT COUNT(*) as users_with_referral_codes FROM users WHERE referral_code IS NOT NULL;
