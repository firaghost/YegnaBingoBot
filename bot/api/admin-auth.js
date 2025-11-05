import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, username, password } = req.body;

  if (action === 'login') {
    try {
      // Query admin from database
      const { data: admin, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !admin) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }

      // Simple password check (in production, use bcrypt)
      if (admin.password !== password) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }

      // Generate session token
      const sessionToken = generateSessionToken();

      // Update last login
      await supabase
        .from('admins')
        .update({ 
          last_login: new Date().toISOString(),
          session_token: sessionToken
        })
        .eq('id', admin.id);

      return res.status(200).json({
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role || 'admin'
        },
        sessionToken
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Server error' 
      });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}

function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
