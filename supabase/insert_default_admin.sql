-- ============================================
-- INSERT DEFAULT ADMIN USER
-- ============================================

-- Insert default admin (password will be hashed on first login)
INSERT INTO public.admin_users (username, password_hash, email)
VALUES ('admin', 'YegnaBingo2025!', 'admin@yegnabingo.com')
ON CONFLICT (username) 
DO UPDATE SET 
  password_hash = 'YegnaBingo2025!';

-- Verify
SELECT * FROM public.admin_users;

-- ============================================
-- Default Admin Credentials:
-- Username: admin
-- Email: admin@yegnabingo.com
-- Password: YegnaBingo2025!
-- 
-- Password will be auto-hashed on first login!
-- ============================================
