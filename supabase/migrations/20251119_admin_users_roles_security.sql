-- Admin users hardening and maintenance bypass support

-- 1) Ensure admin_users has required columns
ALTER TABLE IF EXISTS admin_users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_iterations INTEGER DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) Constraints
DO $$ BEGIN
  ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('super_admin','admin','moderator'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users((lower(username)));

-- 3) Trigger to update updated_at
DO $do$
BEGIN
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $body$
  BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
  END;
  $body$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
  CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL;
END
$do$;

-- 4) Create default super admin if none exists (password to be set later via API)
INSERT INTO admin_users (id, username, role, permissions)
SELECT uuid_generate_v4(), 'superadmin', 'super_admin', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE role='super_admin');

-- 5) Maintenance bypass config seed if missing
INSERT INTO admin_config (config_key, config_value, is_active, created_at, updated_at)
SELECT 'maintenance_bypass_ids', '[]', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_config WHERE config_key='maintenance_bypass_ids'
);
