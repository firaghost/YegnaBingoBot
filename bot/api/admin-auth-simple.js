// Simple admin auth without Supabase for testing
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, username, password } = req.body;

    if (action === 'login') {
      // Simple hardcoded check for testing
      if (username === 'admin' && password === 'admin123') {
        return res.status(200).json({
          success: true,
          admin: {
            id: '1',
            username: 'admin',
            role: 'admin'
          },
          sessionToken: 'test-token-' + Date.now()
        });
      }

      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error: ' + err.message 
    });
  }
}
