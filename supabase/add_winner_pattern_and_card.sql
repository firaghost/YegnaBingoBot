-- Add columns to store the winner's card and exact winning pattern
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS winner_card JSONB,
  ADD COLUMN IF NOT EXISTS winner_pattern TEXT;
