-- Migration: Add earnings tracking for bots and bot_transactions table
-- Date: 2025-11-14

-- 1) Add total_earnings column to bots
ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC NOT NULL DEFAULT 0;

-- 2) Create bot_transactions table
CREATE TABLE IF NOT EXISTS bot_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('stake','win')),
  amount NUMERIC NOT NULL,
  game_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_transactions_bot_id ON bot_transactions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_transactions_game_id ON bot_transactions(game_id);

-- 3) Function to record a bot earning or stake
CREATE OR REPLACE FUNCTION record_bot_earning(
  p_bot_id uuid,
  p_amount NUMERIC,
  p_type text,
  p_game_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO bot_transactions (bot_id, type, amount, game_id)
  VALUES (p_bot_id, p_type, p_amount, p_game_id);

  IF p_type = 'win' THEN
    UPDATE bots SET total_earnings = total_earnings + p_amount WHERE id = p_bot_id;
  END IF;
END;$$;
