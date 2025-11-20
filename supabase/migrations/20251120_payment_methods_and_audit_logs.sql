-- ============================================
-- PAYMENT METHODS + AUDIT LOGS
-- Date: 2025-11-20
-- ============================================

-- 1) payment_methods table (admin-managed)
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  instructions TEXT,
  min_amount NUMERIC,
  max_amount NUMERIC,
  fee_rate NUMERIC, -- 0.02 = 2%
  bonus_percent NUMERIC, -- 10 = 10%
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_enabled ON payment_methods(enabled);

-- Seed defaults (idempotent)
INSERT INTO payment_methods (name, enabled, instructions)
VALUES
  ('Chapa', FALSE, 'Pay instantly using Chapa inline checkout.'),
  ('Manual', TRUE, 'Transfer to one of the bank accounts and upload proof.')
ON CONFLICT (name) DO NOTHING;

-- 2) audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 3) Ensure transactions has metadata JSONB (if migration missed)
DO $$
BEGIN
  BEGIN
    ALTER TABLE transactions ADD COLUMN metadata JSONB;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
END $$;

-- 4) Add handy indexes for transactions lookups
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin ON transactions USING GIN (metadata);

-- 5) Add admin_config keys for payments (idempotent)
INSERT INTO admin_config (config_key, config_value, is_active)
VALUES
  ('chapa_enabled', 'false', true),
  ('manual_deposit_enabled', 'true', true),
  ('deposit_max', '100000', true),
  ('deposit_fee', '0', true)
ON CONFLICT (config_key) DO NOTHING;

-- 6) Helper view for daily deposit analytics (optional)
CREATE OR REPLACE VIEW deposits_per_day AS
SELECT
  DATE(created_at) AS day,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS completed_amount,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
FROM transactions
WHERE type = 'deposit'
GROUP BY 1
ORDER BY 1 DESC;
