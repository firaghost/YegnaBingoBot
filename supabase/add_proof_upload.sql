-- ============================================
-- Add Proof Upload Support for Deposits/Withdrawals
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Add proof_url column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Step 2: Create storage bucket for transaction proofs
-- Note: This must be done in Supabase Dashboard > Storage
-- Bucket name: transaction-proofs
-- Public: Yes (so admins can view proofs)
-- File size limit: 5MB
-- Allowed MIME types: image/*, application/pdf

-- Step 3: Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_proof ON transactions(proof_url);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Proof upload support added!';
  RAISE NOTICE '⚠️ Remember to create storage bucket "transaction-proofs" in Supabase Dashboard';
END $$;
