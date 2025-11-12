-- Quick fix for the admin_settings error
-- This updates the get_commission_rate function to use admin_config

CREATE OR REPLACE FUNCTION get_commission_rate()
RETURNS DECIMAL AS $$
DECLARE
  v_rate DECIMAL;
  v_config_value TEXT;
BEGIN
  -- Get the config value as text first
  SELECT config_value INTO v_config_value
  FROM admin_config
  WHERE config_key = 'game_commission_rate' AND is_active = true;
  
  -- Handle JSONB string values by removing quotes
  IF v_config_value IS NOT NULL THEN
    -- Remove quotes if it's a JSON string
    v_config_value := TRIM(BOTH '"' FROM v_config_value);
    -- Cast to decimal
    v_rate := CAST(v_config_value AS DECIMAL);
  END IF;
  
  RETURN COALESCE(v_rate, 0.1); -- Default to 10% (0.1 as decimal)
END;
$$ LANGUAGE plpgsql;

-- Also update get_setting function
CREATE OR REPLACE FUNCTION get_setting(key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT config_value FROM admin_config WHERE config_key = key AND is_active = true);
END;
$$ LANGUAGE plpgsql;
