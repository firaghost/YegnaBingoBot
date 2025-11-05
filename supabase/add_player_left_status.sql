-- Add has_left column to track players who exit mid-game
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS has_left boolean DEFAULT false;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS left_at timestamp;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false;

-- Add index for querying active players
CREATE INDEX IF NOT EXISTS idx_game_players_has_left ON game_players(game_id, has_left);
