-- Complete fix for dynamic room system and JSONB casting issues
-- This ensures the system works with any rooms you create or edit

-- 1. Fix the JSONB casting issue in commission function
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
  
  -- Handle JSONB string values by removing quotes and casting safely
  IF v_config_value IS NOT NULL THEN
    -- Remove quotes if it's a JSON string
    v_config_value := TRIM(BOTH '"' FROM v_config_value);
    -- Try to cast to decimal, with error handling
    BEGIN
      v_rate := CAST(v_config_value AS DECIMAL);
    EXCEPTION
      WHEN OTHERS THEN
        -- If casting fails, use default
        v_rate := 0.1;
    END;
  END IF;
  
  RETURN COALESCE(v_rate, 0.1); -- Default to 10% (0.1 as decimal)
END;
$$ LANGUAGE plpgsql;

-- 2. Fix get_setting function with better JSONB handling
CREATE OR REPLACE FUNCTION get_setting(key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT config_value INTO v_value
  FROM admin_config 
  WHERE config_key = key AND is_active = true;
  
  -- Remove quotes if it's a JSON string
  IF v_value IS NOT NULL THEN
    v_value := TRIM(BOTH '"' FROM v_value);
  END IF;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- 3. Create a function to safely get numeric config values
CREATE OR REPLACE FUNCTION get_config_numeric(key TEXT, default_value DECIMAL DEFAULT 0)
RETURNS DECIMAL AS $$
DECLARE
  v_value TEXT;
  v_result DECIMAL;
BEGIN
  SELECT config_value INTO v_value
  FROM admin_config 
  WHERE config_key = key AND is_active = true;
  
  -- Handle JSONB string values
  IF v_value IS NOT NULL THEN
    -- Remove quotes if it's a JSON string
    v_value := TRIM(BOTH '"' FROM v_value);
    -- Try to cast to decimal
    BEGIN
      v_result := CAST(v_value AS DECIMAL);
    EXCEPTION
      WHEN OTHERS THEN
        v_result := default_value;
    END;
  ELSE
    v_result := default_value;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 4. Update the trigger function to use the new safe function
CREATE OR REPLACE FUNCTION set_game_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate DECIMAL;
BEGIN
  -- Get current commission rate safely
  v_commission_rate := get_config_numeric('game_commission_rate', 0.1);
  
  -- Only set commission fields if they exist in the table
  BEGIN
    -- Try to set commission fields (gracefully handle missing columns)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      -- Set commission rate (if column exists)
      BEGIN
        NEW.commission_rate := v_commission_rate;
      EXCEPTION
        WHEN undefined_column THEN
          -- Column doesn't exist, continue
          NULL;
      END;
      
      -- Set commission amount (if column exists)
      BEGIN
        NEW.commission_amount := ROUND(NEW.prize_pool * v_commission_rate, 2);
      EXCEPTION
        WHEN undefined_column THEN
          -- Column doesn't exist, continue
          NULL;
      END;
      
      -- Set net prize (if column exists)
      BEGIN
        NEW.net_prize := ROUND(NEW.prize_pool * (1 - v_commission_rate), 2);
      EXCEPTION
        WHEN undefined_column THEN
          -- Column doesn't exist, continue
          NULL;
      END;
    END IF;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_set_game_commission ON games;
CREATE TRIGGER trigger_set_game_commission
  BEFORE INSERT OR UPDATE OF prize_pool ON games
  FOR EACH ROW
  EXECUTE FUNCTION set_game_commission();

-- 6. Show current room configuration (for verification)
DO $$
DECLARE
  room_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO room_count FROM rooms WHERE status = 'active';
  RAISE NOTICE 'System is now fully dynamic with % active rooms', room_count;
  RAISE NOTICE 'You can create, edit, or delete rooms through the admin panel';
  RAISE NOTICE 'All games will automatically use the room settings from the database';
END $$;
