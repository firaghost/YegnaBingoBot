-- Fix admin_config table permissions and RLS issues

-- Disable RLS for admin_config table (since it's admin-only)
ALTER TABLE admin_config DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS, create proper policies
-- ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
-- CREATE POLICY "Allow all for authenticated users" ON admin_config
--   FOR ALL USING (auth.role() = 'authenticated');

-- Grant necessary permissions to authenticated role
GRANT ALL ON admin_config TO authenticated;
GRANT ALL ON admin_config TO anon;

-- Grant usage on the sequence if it exists
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Ensure the functions have proper security
ALTER FUNCTION get_config(TEXT) SECURITY DEFINER;
ALTER FUNCTION set_admin_config(TEXT, TEXT, UUID) SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_config(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_admin_config(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_admin_config(TEXT, TEXT, UUID) TO anon;
