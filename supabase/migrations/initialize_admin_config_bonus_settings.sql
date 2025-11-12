-- Initialize admin configuration with bonus settings
-- This ensures all bonus settings are properly configured in the admin_config table

-- Insert or update all configuration values (using JSON format)
INSERT INTO admin_config (config_key, config_value, description, is_active, created_at, updated_at)
VALUES 
  -- Bonus Settings
  ('deposit_bonus', '10', 'Deposit bonus percentage (e.g., 10 for 10%)', true, NOW(), NOW()),
  ('daily_streak_bonus', '20', 'Daily streak bonus amount in ETB', true, NOW(), NOW()),
  ('daily_streak_days', '5', 'Number of days required for streak bonus', true, NOW(), NOW()),
  ('referral_bonus', '25', 'Referral bonus amount in ETB', true, NOW(), NOW()),
  
  -- System Settings
  ('registration_enabled', 'true', 'Allow new user registrations', true, NOW(), NOW()),
  ('auto_approve_deposits', 'false', 'Automatically approve deposit transactions', true, NOW(), NOW()),
  ('auto_approve_withdrawals', 'false', 'Automatically approve withdrawal transactions', true, NOW(), NOW()),
  ('email_notifications', 'true', 'Enable email notifications', true, NOW(), NOW()),
  ('telegram_notifications', 'true', 'Enable Telegram notifications', true, NOW(), NOW()),
  
  -- API Settings
  ('telegram_bot_token', '""', 'Telegram bot token for notifications', true, NOW(), NOW()),
  ('socket_url', '""', 'Socket.IO server URL for real-time features', true, NOW(), NOW()),
  
  -- App Settings
  ('app_name', '"BingoX"', 'Application name displayed to users', true, NOW(), NOW()),
  ('maintenance_mode', 'false', 'Enable maintenance mode', true, NOW(), NOW()),
  ('maintenance_message', '"System under maintenance. Please try again later."', 'Message shown during maintenance', true, NOW(), NOW()),
  ('app_version', '"2.0.0"', 'Current application version', true, NOW(), NOW()),
  
  -- Financial Settings
  ('min_withdrawal_amount', '100', 'Minimum withdrawal amount in ETB', true, NOW(), NOW()),
  ('max_withdrawal_amount', '100000', 'Maximum withdrawal amount in ETB', true, NOW(), NOW()),
  ('withdrawal_fee_rate', '0.02', 'Withdrawal fee rate (0.02 = 2%)', true, NOW(), NOW()),
  ('game_commission_rate', '0.1', 'Game commission rate (0.1 = 10%)', true, NOW(), NOW()),
  
  -- Contact Settings
  ('support_email', '"support@bingox.com"', 'Support email address', true, NOW(), NOW()),
  ('telegram_support', '"@bingox_support"', 'Support Telegram username', true, NOW(), NOW()),
  ('support_phone', '"+251911234567"', 'Support phone number', true, NOW(), NOW())
ON CONFLICT (config_key) 
DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Drop existing functions if they exist to avoid return type conflicts
DROP FUNCTION IF EXISTS get_config(TEXT);
DROP FUNCTION IF EXISTS set_config(TEXT, TEXT, UUID);

-- Create the get_config function
CREATE OR REPLACE FUNCTION get_config(key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT config_value INTO result
  FROM admin_config 
  WHERE config_key = key AND is_active = true;
  
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION set_admin_config(config_key_param TEXT, config_value_param TEXT, updated_by_user UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO admin_config (config_key, config_value, updated_by, is_active, created_at, updated_at)
  VALUES (config_key_param, config_value_param, updated_by_user, true, NOW(), NOW())
  ON CONFLICT (config_key) 
  DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION get_config(TEXT) IS 'Retrieves configuration value by key from admin_config table';
COMMENT ON FUNCTION set_admin_config(TEXT, TEXT, UUID) IS 'Sets configuration value in admin_config table with optional user tracking';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_admin_config_key_active ON admin_config(config_key, is_active);

-- Log the initialization
INSERT INTO admin_config (config_key, config_value, description, is_active, created_at, updated_at)
VALUES ('system_initialized', 'true', 'System configuration initialized', true, NOW(), NOW())
ON CONFLICT (config_key) DO NOTHING;
