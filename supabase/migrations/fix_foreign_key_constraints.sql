-- Fix foreign key constraints to allow user deletion
-- This migration updates the foreign key constraints to set NULL on delete

-- Drop existing foreign key constraint for games.winner_id
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;

-- Add new foreign key constraint with ON DELETE SET NULL
ALTER TABLE games 
ADD CONSTRAINT games_winner_id_fkey 
FOREIGN KEY (winner_id) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Drop existing foreign key constraint for transactions.user_id if it exists
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

-- Add new foreign key constraint with ON DELETE CASCADE for transactions
-- This will automatically delete all transactions when a user is deleted
ALTER TABLE transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Optional: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_winner_id ON games(winner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT games_winner_id_fkey ON games IS 'Foreign key to users table with SET NULL on delete to handle user deletion gracefully';
COMMENT ON CONSTRAINT transactions_user_id_fkey ON transactions IS 'Foreign key to users table with CASCADE on delete to remove user transactions when user is deleted';
