-- ============================================
-- ADD SUPPORT CONTACT SETTINGS
-- For configurable support contact information
-- ============================================

-- Insert support contact settings into admin_settings table
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('support_email', 'support@bingox.com', 'Support email address shown to users'),
  ('support_telegram', '@bingox_support', 'Support Telegram username (include @)'),
  ('support_phone', '+251 911 234 567', 'Support phone number for contact')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify the settings were added
SELECT setting_key, setting_value, description 
FROM admin_settings 
WHERE setting_key IN ('support_email', 'support_telegram', 'support_phone')
ORDER BY setting_key;
