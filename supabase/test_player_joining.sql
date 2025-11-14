-- Test atomic player joining function
-- Run this to verify the new player joining works

-- First, create a test game
SELECT * FROM create_game_safe('classic', gen_random_uuid(), 10.00);

-- Get the game ID from the result above and test adding players
-- Replace 'YOUR_GAME_ID' with the actual game_id from above
-- SELECT * FROM add_player_to_game('YOUR_GAME_ID'::uuid, gen_random_uuid(), 20);

-- Example test (you'll need to replace with actual IDs):
-- SELECT * FROM add_player_to_game('123e4567-e89b-12d3-a456-426614174000'::uuid, gen_random_uuid(), 20);
