-- Migration: Add bots tracking to games table
-- Date: 2025-11-15
-- Purpose: Track which bots are in each game for bot claiming logic

-- Add bots column if it doesn't exist
ALTER TABLE games
ADD COLUMN IF NOT EXISTS bots uuid[] DEFAULT '{}';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_games_bots ON games USING GIN (bots);
