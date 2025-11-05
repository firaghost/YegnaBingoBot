import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Password hashing utilities
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, username, password } = req.body;

  if (action === 'login') {
    return await handleLogin(req, res, username, password);
  }

  return res.status(400).json({ error: 'Invalid action' });
}

async function handleLogin(req, res, username, password) {
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const { data: admins, error } = await supabase
    .from('admin_users')
    .select('*')
    .or(`username.eq.${username},email.eq.${username}`)
    .eq('is_active', true);

  if (error || !admins || admins.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const admin = admins[0];
  const passwordMatch = verifyPassword(password, admin.password_hash);

  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!admin.password_hash.includes(':')) {
    const hashedPassword = hashPassword(password);
    await supabase
      .from('admin_users')
      .update({ password_hash: hashedPassword })
      .eq('id', admin.id);
  }

  await supabase
    .from('admin_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', admin.id);

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
