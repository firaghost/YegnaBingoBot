-- ============================================
-- ADMIN CONFIGURATION SYSTEM
-- ============================================
-- This creates a flexible configuration system for admins

-- Create admin_config table
CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_config_key ON admin_config(config_key);
CREATE INDEX IF NOT EXISTS idx_admin_config_category ON admin_config(category);

-- Insert default configuration values
INSERT INTO admin_config (config_key, config_value, description, category) VALUES
-- Game Configuration
('game_commission_rate', '0.10', 'Platform commission rate (0.10 = 10%)', 'game'),
('game_min_players', '2', 'Minimum players required to start a game', 'game'),
('game_max_players_easy', '10', 'Maximum players for easy level games', 'game'),
('game_max_players_medium', '8', 'Maximum players for medium level games', 'game'),
('game_max_players_hard', '6', 'Maximum players for hard level games', 'game'),
('game_waiting_time', '30', 'Seconds to wait for more players before countdown', 'game'),
('game_countdown_time', '10', 'Countdown seconds before game starts', 'game'),
('game_call_interval_easy', '3000', 'Milliseconds between number calls (easy)', 'game'),
('game_call_interval_medium', '2000', 'Milliseconds between number calls (medium)', 'game'),
('game_call_interval_hard', '1500', 'Milliseconds between number calls (hard)', 'game'),

-- Stake Configuration
('stake_easy', '5', 'Entry stake for easy level games (ETB)', 'stakes'),
('stake_medium', '10', 'Entry stake for medium level games (ETB)', 'stakes'),
('stake_hard', '25', 'Entry stake for hard level games (ETB)', 'stakes'),
('prize_pool_easy', '50', 'Base prize pool for easy level games (ETB)', 'stakes'),
('prize_pool_medium', '80', 'Base prize pool for medium level games (ETB)', 'stakes'),
('prize_pool_hard', '150', 'Base prize pool for hard level games (ETB)', 'stakes'),

-- Financial Configuration
('min_deposit_amount', '10', 'Minimum deposit amount (ETB)', 'financial'),
('max_deposit_amount', '10000', 'Maximum deposit amount (ETB)', 'financial'),
('min_withdrawal_amount', '20', 'Minimum withdrawal amount (ETB)', 'financial'),
('max_withdrawal_amount', '50000', 'Maximum withdrawal amount (ETB)', 'financial'),
('withdrawal_fee_rate', '0.02', 'Withdrawal fee rate (0.02 = 2%)', 'financial'),
('daily_withdrawal_limit', '5000', 'Daily withdrawal limit per user (ETB)', 'financial'),

-- Contact & Support
('support_email', '"support@bingox.com"', 'Support email address', 'contact'),
('support_phone', '"+251911234567"', 'Support phone number', 'contact'),
('telegram_support', '"@BingoXSupport"', 'Telegram support username', 'contact'),
('website_url', '"https://bingox.com"', 'Official website URL', 'contact'),

-- App Configuration
('app_name', '"BingoX"', 'Application name', 'app'),
('app_version', '"2.0.0"', 'Current app version', 'app'),
('maintenance_mode', 'false', 'Enable maintenance mode', 'app'),
('maintenance_message', '"System under maintenance. Please try again later."', 'Maintenance mode message', 'app'),
('welcome_bonus', '50', 'Welcome bonus amount for new users (ETB)', 'app'),
('referral_bonus', '25', 'Referral bonus amount (ETB)', 'app'),

-- Room Configuration
('room_colors', '{"easy": "from-green-500 to-green-700", "medium": "from-blue-500 to-blue-700", "hard": "from-red-500 to-red-700"}', 'Room color schemes', 'rooms'),
('room_descriptions', '{"easy": "Perfect for beginners - Relaxed pace", "medium": "Balanced gameplay - Moderate pace", "hard": "Expert level - Fast-paced action"}', 'Room descriptions', 'rooms')

ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  updated_at = NOW();

-- Create function to get config value
CREATE OR REPLACE FUNCTION get_config(key TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT config_value 
    FROM admin_config 
    WHERE config_key = key AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to set config value
CREATE OR REPLACE FUNCTION set_config(key TEXT, value JSONB, updated_by_user UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO admin_config (config_key, config_value, updated_by)
  VALUES (key, value, updated_by_user)
  ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON admin_config TO anon, authenticated;
GRANT ALL ON admin_config TO service_role;
