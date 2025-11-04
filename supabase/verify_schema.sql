-- Verify game_players table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'game_players'
ORDER BY ordinal_position;

-- Check if selected_numbers column exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'game_players' 
  AND column_name = 'selected_numbers'
) AS selected_numbers_exists;

-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'game_players';
