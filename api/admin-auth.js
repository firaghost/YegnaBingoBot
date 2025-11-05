import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Password hashing utilities
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  // Handle plain text passwords (for migration)
  if (!storedHash.includes(':')) {
    return password === storedHash;
  }
  
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(hash, 'hex'));
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
  // Enable CORS
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, username, password, sessionToken } = req.body;

  try {
    switch (action) {
      case 'login':
        return await handleLogin(req, res, username, password);
      
      case 'verify':
        return await handleVerify(req, res, sessionToken);
      
      case 'logout':
        return await handleLogout(req, res, sessionToken);
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleLogin(req, res, username, password) {
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Get admin from database
  const { data: admins, error } = await supabase
    .from('admin_users')
    .select('*')
    .or(`username.eq.${username},email.eq.${username}`)
    .eq('is_active', true);

  if (error || !admins || admins.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const admin = admins[0];

  // Verify password
  const passwordMatch = verifyPassword(password, admin.password);

  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Auto-hash plain text password on first login
  if (!admin.password.includes(':')) {
    const hashedPassword = hashPassword(password);
    await supabase
      .from('admin_users')
      .update({ password: hashedPassword })
      .eq('id', admin.id);
  }

  // Update last login
  await supabase
    .from('admin_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', admin.id);

  // Generate session token
  const sessionToken = generateSessionToken();

  return res.status(200).json({
    success: true,
    sessionToken,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role
    }
  });
}

async function handleVerify(req, res, sessionToken) {
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }

  // For now, just return success (you can implement session storage later)
  return res.status(200).json({
    success: true
  });
}

async function handleLogout(req, res, sessionToken) {
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}
