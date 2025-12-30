CREATE TABLE IF NOT EXISTS game_player_cards (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_player_cards_game_id ON game_player_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_game_player_cards_user_id ON game_player_cards(user_id);

ALTER TABLE game_player_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_player_cards' AND policyname = 'Anyone can read game_player_cards'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can read game_player_cards" ON game_player_cards FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_player_cards' AND policyname = 'System can manage game_player_cards'
  ) THEN
    EXECUTE 'CREATE POLICY "System can manage game_player_cards" ON game_player_cards FOR ALL USING (true)';
  END IF;
END $$;
