-- ============================================
-- Add Commission System
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create admin_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Insert default commission rate (10%)
INSERT INTO admin_settings (setting_key, setting_value, description)
VALUES ('commission_rate', '10', 'Commission percentage deducted from prize pool (0-100)')
ON CONFLICT (setting_key) DO NOTHING;

-- Step 3: Add commission tracking to games table
ALTER TABLE games
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 10;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS net_prize DECIMAL(10, 2);

-- Step 4: Create function to calculate prize with commission
CREATE OR REPLACE FUNCTION calculate_net_prize(
  p_prize_pool DECIMAL,
  p_commission_rate DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND(p_prize_pool * (1 - p_commission_rate / 100), 2);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to get current commission rate
CREATE OR REPLACE FUNCTION get_commission_rate()
RETURNS DECIMAL AS $$
DECLARE
  v_rate DECIMAL;
BEGIN
  SELECT CAST(setting_value AS DECIMAL) INTO v_rate
  FROM admin_settings
  WHERE setting_key = 'commission_rate';
  
  RETURN COALESCE(v_rate, 10);
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-calculate commission on game creation
CREATE OR REPLACE FUNCTION set_game_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate DECIMAL;
BEGIN
  -- Get current commission rate
  v_commission_rate := get_commission_rate();
  
  -- Set commission rate and amounts
  NEW.commission_rate := v_commission_rate;
  NEW.commission_amount := ROUND(NEW.prize_pool * v_commission_rate / 100, 2);
  NEW.net_prize := ROUND(NEW.prize_pool - NEW.commission_amount, 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_game_commission ON games;
CREATE TRIGGER trigger_set_game_commission
  BEFORE INSERT OR UPDATE OF prize_pool ON games
  FOR EACH ROW
  EXECUTE FUNCTION set_game_commission();

-- Step 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- Step 8: Update existing games to have commission calculated
UPDATE games
SET 
  commission_rate = get_commission_rate(),
  commission_amount = ROUND(prize_pool * get_commission_rate() / 100, 2),
  net_prize = ROUND(prize_pool * (1 - get_commission_rate() / 100), 2)
WHERE commission_amount IS NULL OR commission_amount = 0;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Commission system added successfully!';
  RAISE NOTICE '✅ Default commission rate: 10%%';
  RAISE NOTICE '✅ Admin can change rate in admin_settings table';
END $$;
