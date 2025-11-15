-- Migration: Add 'unbeatable' difficulty level to bot_difficulty enum
-- Date: 2025-11-15

-- Alter the bot_difficulty enum to include 'unbeatable'
ALTER TYPE bot_difficulty ADD VALUE 'unbeatable' AFTER 'hard';

-- Update the select_active_bot function to accept the new difficulty
-- (This is already generic, so no changes needed there)

-- Update the seed data to allow unbeatable difficulty in future inserts
-- (The seed function already handles this generically)

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Successfully added unbeatable difficulty to bot_difficulty enum';
END $$;
