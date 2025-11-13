-- ============================================
-- FIX GAMES TABLE SCHEMA FOR BOTS
-- ============================================

-- 1. Check current games table structure
SELECT 'CURRENT GAMES TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
ORDER BY ordinal_position;

-- 2. Add missing columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_level TEXT DEFAULT 'medium';
ALTER TABLE games ADD COLUMN IF NOT EXISTS stake DECIMAL(10,2) DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_id TEXT;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_game_level ON games(game_level);

-- 4. Add foreign key constraint for user_id (if users table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'games_user_id_fkey' 
            AND table_name = 'games'
        ) THEN
            ALTER TABLE games ADD CONSTRAINT games_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 5. Show updated games table structure
SELECT 'UPDATED GAMES TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
ORDER BY ordinal_position;

-- 6. Test bot game creation (simulate what bot manager does)
SELECT 'TESTING BOT GAME CREATION SCHEMA:' as test;

-- Check if we can insert a test game record
DO $$
DECLARE
    test_user_id UUID;
    test_game_id UUID;
BEGIN
    -- Get a test user (or create one)
    SELECT id INTO test_user_id FROM users WHERE is_bot = true LIMIT 1;
    
    IF test_user_id IS NULL THEN
        -- Create a temporary test user
        INSERT INTO users (username, telegram_id, balance, is_bot) 
        VALUES ('temp_test_bot', 'temp_test_123', 1000000, true)
        RETURNING id INTO test_user_id;
    END IF;
    
    -- Try to insert a test game
    INSERT INTO games (
        room_id,
        user_id,
        stake,
        status,
        game_level
    ) VALUES (
        'test_room',
        test_user_id,
        50,
        'waiting',
        'medium'
    ) RETURNING id INTO test_game_id;
    
    -- Clean up test data
    DELETE FROM games WHERE id = test_game_id;
    DELETE FROM users WHERE username = 'temp_test_bot';
    
    RAISE NOTICE 'Game creation test: SUCCESS - All required columns exist';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Game creation test: FAILED - %', SQLERRM;
END $$;

-- Success message
SELECT 'GAMES TABLE SCHEMA FIXED!' as status;
SELECT 'Added missing columns: user_id, game_level, stake, status, room_id' as columns_added;
SELECT 'Bot game creation should now work' as result;
