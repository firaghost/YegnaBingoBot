-- Fix payments table - add missing columns and make receipt_number nullable

-- Add missing columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'bank_transfer';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_proof TEXT;

-- Make receipt_number nullable (it's auto-generated, not user-provided)
ALTER TABLE payments ALTER COLUMN receipt_number DROP NOT NULL;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;
