-- ============================================
-- Enforce unique tx_ref for deposit transactions
-- Date: 2025-11-20
-- ============================================

-- Create unique index on metadata->>'tx_ref' for deposit transactions to avoid duplicates
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_deposit_tx_ref
      ON transactions ((metadata->>'tx_ref'))
      WHERE type = 'deposit';
  EXCEPTION
    WHEN others THEN
      -- If metadata column missing in some environments, skip silently
      NULL;
  END;
END $$;
