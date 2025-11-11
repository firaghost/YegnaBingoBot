-- Add metadata column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata ON transactions USING GIN (metadata);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added metadata column to transactions table';
END $$;
