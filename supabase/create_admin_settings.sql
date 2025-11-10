-- ============================================
-- CREATE ADMIN SETTINGS TABLE
-- For configurable bonus limits and game settings
-- ============================================

CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id)
);

-- Insert default bonus settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
  ('welcome_bonus', '3.00', 'Welcome bonus for new users (ETB)'),
  ('daily_streak_bonus', '5.00', 'Bonus for completing 5-day streak (ETB)'),
  ('daily_streak_days', '5', 'Number of days required for streak bonus'),
  ('referral_bonus', '10.00', 'Bonus for successful referral (ETB)'),
  ('first_deposit_match_percent', '100', 'First deposit match percentage'),
  ('first_deposit_match_max', '100.00', 'Maximum first deposit match (ETB)'),
  ('min_withdrawal', '100.00', 'Minimum withdrawal amount (ETB)'),
  ('max_bonus_balance', '1000.00', 'Maximum bonus balance a user can have (ETB)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to get setting value
CREATE OR REPLACE FUNCTION get_setting(key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT setting_value FROM admin_settings WHERE setting_key = key);
END;
$$ LANGUAGE plpgsql;

-- Create function to update daily streak
CREATE OR REPLACE FUNCTION update_daily_streak(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
  last_date DATE;
  current_streak INTEGER;
  streak_days_required INTEGER;
  streak_bonus DECIMAL(10, 2);
BEGIN
  -- Get user's last play date and current streak
  SELECT last_play_date, daily_streak INTO last_date, current_streak
  FROM users WHERE id = user_id_param;

  -- Get streak settings
  streak_days_required := (SELECT get_setting('daily_streak_days')::INTEGER);
  streak_bonus := (SELECT get_setting('daily_streak_bonus')::DECIMAL);

  -- Check if user played today already
  IF last_date = CURRENT_DATE THEN
    RETURN; -- Already played today
  END IF;

  -- Check if streak continues (played yesterday)
  IF last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Continue streak
    current_streak := current_streak + 1;
    
    -- Award bonus if streak completed
    IF current_streak >= streak_days_required THEN
      UPDATE users 
      SET bonus_balance = bonus_balance + streak_bonus,
          daily_streak = 0, -- Reset streak after bonus
          last_play_date = CURRENT_DATE
      WHERE id = user_id_param;
      
      -- Create transaction record
      INSERT INTO transactions (user_id, type, amount, status, description)
      VALUES (user_id_param, 'bonus', streak_bonus, 'completed', 
              'Daily streak bonus (' || streak_days_required || ' days)');
    ELSE
      -- Update streak without bonus
      UPDATE users 
      SET daily_streak = current_streak,
          last_play_date = CURRENT_DATE
      WHERE id = user_id_param;
    END IF;
  ELSE
    -- Streak broken, reset to 1
    UPDATE users 
    SET daily_streak = 1,
        last_play_date = CURRENT_DATE
    WHERE id = user_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE admin_settings IS 'Configurable game and bonus settings managed by admins';
COMMENT ON FUNCTION update_daily_streak IS 'Updates user daily streak and awards bonus when completed';
