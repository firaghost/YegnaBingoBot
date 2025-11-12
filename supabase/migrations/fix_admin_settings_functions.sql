-- Fix database functions that still reference admin_settings
-- Update them to use admin_config instead

-- 1. Update get_setting function to use admin_config
CREATE OR REPLACE FUNCTION get_setting(key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT config_value FROM admin_config WHERE config_key = key AND is_active = true);
END;
$$ LANGUAGE plpgsql;

-- 2. Update get_commission_rate function to use admin_config
CREATE OR REPLACE FUNCTION get_commission_rate()
RETURNS DECIMAL AS $$
DECLARE
  v_rate DECIMAL;
BEGIN
  SELECT CAST(config_value AS DECIMAL) INTO v_rate
  FROM admin_config
  WHERE config_key = 'game_commission_rate' AND is_active = true;
  
  RETURN COALESCE(v_rate, 0.1); -- Default to 10% (0.1 as decimal)
END;
$$ LANGUAGE plpgsql;

-- 2b. Update the trigger function that uses get_commission_rate
CREATE OR REPLACE FUNCTION set_game_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate DECIMAL;
BEGIN
  -- Get current commission rate (now uses admin_config)
  v_commission_rate := get_commission_rate();
  
  -- Only set commission fields if they exist in the table
  BEGIN
    -- Set commission rate and amounts (only if columns exist)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      -- Check if commission columns exist before setting them
      BEGIN
        NEW.commission_rate := v_commission_rate;
      EXCEPTION
        WHEN undefined_column THEN
          -- Column doesn't exist, skip
          NULL;
      END;
      
      BEGIN
        NEW.commission_amount := ROUND(NEW.prize_pool * v_commission_rate, 2);
      EXCEPTION
        WHEN undefined_column THEN
          -- Column doesn't exist, skip
          NULL;
      END;
      
      BEGIN
        NEW.net_prize := ROUND(NEW.prize_pool - COALESCE(NEW.commission_amount, NEW.prize_pool * v_commission_rate), 2);
      EXCEPTION
        WHEN undefined_column THEN
          -- Column doesn't exist, skip
          NULL;
      END;
    END IF;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create or update any other functions that might reference admin_settings
-- Update the daily streak function if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_daily_streak') THEN
    -- Drop and recreate the function to use admin_config
    DROP FUNCTION IF EXISTS update_daily_streak(UUID);
    
    CREATE OR REPLACE FUNCTION update_daily_streak(user_uuid UUID)
    RETURNS BOOLEAN AS $func$
    DECLARE
      last_play_date DATE;
      current_streak INTEGER;
      streak_days_required INTEGER;
      streak_bonus DECIMAL;
    BEGIN
      -- Get user's current streak and last play date
      SELECT 
        COALESCE(daily_streak, 0),
        COALESCE(last_play_date::DATE, '1900-01-01'::DATE)
      INTO current_streak, last_play_date
      FROM users 
      WHERE id = user_uuid;
      
      -- Get streak requirements from admin_config
      SELECT COALESCE(CAST(config_value AS INTEGER), 5) INTO streak_days_required
      FROM admin_config 
      WHERE config_key = 'daily_streak_days' AND is_active = true;
      
      SELECT COALESCE(CAST(config_value AS DECIMAL), 20.00) INTO streak_bonus
      FROM admin_config 
      WHERE config_key = 'daily_streak_bonus' AND is_active = true;
      
      -- Check if this is a consecutive day
      IF last_play_date = CURRENT_DATE - INTERVAL '1 day' THEN
        -- Consecutive day - increment streak
        current_streak := current_streak + 1;
      ELSIF last_play_date < CURRENT_DATE - INTERVAL '1 day' THEN
        -- Streak broken - reset to 1
        current_streak := 1;
      ELSE
        -- Same day - no change
        RETURN true;
      END IF;
      
      -- Update user's streak and last play date
      UPDATE users 
      SET 
        daily_streak = current_streak,
        last_play_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE id = user_uuid;
      
      -- Award bonus if streak completed
      IF current_streak >= streak_days_required THEN
        -- Award streak bonus
        UPDATE users 
        SET 
          bonus_balance = COALESCE(bonus_balance, 0) + streak_bonus,
          daily_streak = 0, -- Reset streak after bonus
          updated_at = NOW()
        WHERE id = user_uuid;
        
        -- Log the bonus transaction
        INSERT INTO transactions (user_id, type, amount, status, description)
        VALUES (
          user_uuid, 
          'bonus', 
          streak_bonus, 
          'completed',
          CONCAT('Daily streak bonus (', streak_days_required, ' days)')
        );
      END IF;
      
      RETURN true;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN false;
    END;
    $func$ LANGUAGE plpgsql;
    
    RAISE NOTICE 'Updated update_daily_streak function to use admin_config';
  END IF;
END $$;

-- 4. Drop the old admin_settings table if it exists (after confirming migration)
-- Uncomment this after verifying everything works:
-- DROP TABLE IF EXISTS admin_settings CASCADE;

