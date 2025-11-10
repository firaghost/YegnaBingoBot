-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create admin_users table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  status VARCHAR(20) DEFAULT 'active',
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_admin_users_username ON admin_users(username);
CREATE INDEX idx_admin_users_status ON admin_users(status);

-- Insert default admin user
INSERT INTO admin_users (username, password, email, role, status)
VALUES ('admin', 'admin123', 'admin@bingoroyale.com', 'super_admin', 'active');

-- Enable RLS (Row Level Security)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading admin_users (for login)
CREATE POLICY "Allow read access to admin_users" ON admin_users
  FOR SELECT
  USING (true);

-- Create policy to allow updating admin_users (for last_login)
CREATE POLICY "Allow update access to admin_users" ON admin_users
  FOR UPDATE
  USING (true);

COMMENT ON TABLE admin_users IS 'Admin users for the admin panel';
