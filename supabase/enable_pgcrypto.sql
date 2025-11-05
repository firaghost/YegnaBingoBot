-- ============================================
-- ENABLE PGCRYPTO EXTENSION
-- Run this FIRST before creating super admin tables
-- ============================================

-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify it's enabled
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- Test that gen_salt works
SELECT gen_salt('bf');

-- Test that crypt works
SELECT crypt('test_password', gen_salt('bf'));

-- ============================================
-- If you see results above, pgcrypto is working!
-- Now you can run create_super_admin_table.sql
-- ============================================
