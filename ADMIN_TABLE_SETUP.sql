-- Create admins table if it doesn't exist
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  session_token TEXT,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create default admin (change password after first login!)
INSERT INTO admins (username, password, role)
VALUES ('admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Add RLS policies
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Allow service key to access
CREATE POLICY "Service role can access admins"
  ON admins
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
