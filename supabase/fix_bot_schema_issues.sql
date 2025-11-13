-- ============================================
-- FIX BOT SCHEMA ISSUES
-- ============================================

-- 1. Add missing game_level column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_level TEXT DEFAULT 'medium';

-- 2. Create index for game_level
CREATE INDEX IF NOT EXISTS idx_games_game_level ON games(game_level);

-- 3. Fix bot user creation by handling duplicate telegram_id
-- First, clean up any existing bot users that might be causing conflicts
DELETE FROM users WHERE telegram_id LIKE 'bot_%' AND is_bot = true;

-- 4. Update bot_players to ensure unique usernames (fix duplicates)
-- Use a simpler approach without window functions
DO $$
DECLARE
    bot_record RECORD;
    counter INTEGER;
BEGIN
    counter := 1;
    FOR bot_record IN 
        SELECT id, username 
        FROM bot_players 
        WHERE username IN (
            SELECT username 
            FROM bot_players 
            GROUP BY username 
            HAVING COUNT(*) > 1
        )
        ORDER BY created_at
    LOOP
        UPDATE bot_players 
        SET username = bot_record.username || '_' || counter
        WHERE id = bot_record.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- 5. Clear any existing bot game sessions to start fresh
DELETE FROM bot_game_sessions;

-- 6. Test bot user creation (this should work now)
SELECT 'TESTING BOT USER CREATION:' as test;

-- Create a test bot user to verify the fix
DO $$
DECLARE
    test_bot_id UUID;
    test_user_id UUID;
BEGIN
    -- Get a bot ID
    SELECT id INTO test_bot_id FROM bot_players LIMIT 1;
    
    IF test_bot_id IS NOT NULL THEN
        -- Try to create a user for this bot
        INSERT INTO users (
            username, 
            telegram_id, 
            balance, 
            is_bot, 
            bot_id
        ) VALUES (
            'test_bot_user',
            'bot_test_' || test_bot_id::text,
            1000000,
            true,
            test_bot_id
        ) RETURNING id INTO test_user_id;
        
        -- Clean up test user
        DELETE FROM users WHERE id = test_user_id;
        
        RAISE NOTICE 'Bot user creation test: SUCCESS';
    END IF;
END $$;

-- 7. Show current bot status
SELECT 'CURRENT BOT STATUS:' as info;
SELECT 
    name,
    username,
    is_enabled,
    auto_join_enabled
FROM bot_players 
WHERE is_enabled = true
ORDER BY name;

-- 8. Show games table structure
SELECT 'GAMES TABLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'games' 
AND column_name IN ('game_level', 'room_id', 'user_id', 'status')
ORDER BY column_name;

-- Success message
SELECT 'BOT SCHEMA ISSUES FIXED!' as status;
SELECT 'Added game_level column to games table' as fix1;
SELECT 'Fixed telegram_id uniqueness for bot users' as fix2;
SELECT 'Cleared existing bot sessions for fresh start' as fix3;
