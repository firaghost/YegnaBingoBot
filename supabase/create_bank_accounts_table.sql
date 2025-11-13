-- ============================================
-- CREATE BANK ACCOUNTS TABLE
-- ============================================

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  branch TEXT,
  swift_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_created_at ON bank_accounts(created_at);

-- Enable RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read bank_accounts" ON bank_accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert bank_accounts" ON bank_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update bank_accounts" ON bank_accounts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete bank_accounts" ON bank_accounts FOR DELETE USING (true);

-- No sample data - admins will add their own bank accounts through the management interface

-- Success message
SELECT 'BANK ACCOUNTS TABLE CREATED SUCCESSFULLY!' as status;
SELECT 'Table: bank_accounts ready for admin configuration' as created;
SELECT 'Policies: Full CRUD access enabled' as policies;
