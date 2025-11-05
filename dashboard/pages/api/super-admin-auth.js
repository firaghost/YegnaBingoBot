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

  const { action, username, password, oldPassword, newPassword, sessionToken } = req.body;

  try {
    switch (action) {
      case 'login':
        return await handleLogin(req, res, username, password);
      
      case 'verify':
        return await handleVerify(req, res, sessionToken);
      
      case 'changePassword':
        return await handleChangePassword(req, res, sessionToken, oldPassword, newPassword);
      
      case 'logout':
        return await handleLogout(req, res, sessionToken);
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Super admin auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleLogin(req, res, username, password) {
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const { data: admin, error } = await supabase
    .from('super_admins')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (error || !admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isLocked = admin.locked_until && new Date(admin.locked_until) > new Date();
  if (isLocked) {
    return res.status(423).json({ error: 'Account locked. Too many failed attempts. Try again in 30 minutes.' });
  }

  let passwordMatch = false;
  if (admin.password.includes(':')) {
    passwordMatch = verifyPassword(password, admin.password);
  } else {
    passwordMatch = password === admin.password;
    
    if (passwordMatch) {
      const hashedPassword = hashPassword(password);
      await supabase
        .from('super_admins')
        .update({ password: hashedPassword })
        .eq('id', admin.id);
    }
  }

  if (!passwordMatch) {
    const newAttempts = admin.login_attempts + 1;
    const lockedUntil = newAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;

    await supabase
      .from('super_admins')
      .update({
        login_attempts: newAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString()
      })
      .eq('id', admin.id);

    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await supabase
    .from('super_admins')
    .update({
      login_attempts: 0,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', admin.id);

  const sessionToken = generateSessionToken();
  await supabase.from('super_admin_sessions').insert({
    super_admin_id: admin.id,
    session_token: sessionToken,
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    user_agent: req.headers['user-agent'],
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  });

  await supabase.from('super_admin_activity_log').insert({
    super_admin_id: admin.id,
    action: 'login_success',
    details: { username: admin.username },
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  });

  return res.status(200).json({
    success: true,
    sessionToken,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name
    }
  });
}

async function handleVerify(req, res, sessionToken) {
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }

  const { data: session, error } = await supabase
    .from('super_admin_sessions')
    .select('*, super_admins(*)')
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !session || !session.super_admins.is_active) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  return res.status(200).json({
    success: true,
    admin: {
      id: session.super_admins.id,
      username: session.super_admins.username,
      email: session.super_admins.email
    }
  });
}

async function handleChangePassword(req, res, sessionToken, oldPassword, newPassword) {
  if (!sessionToken || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const { data: session, error: sessionError } = await supabase
    .from('super_admin_sessions')
    .select('*, super_admins(*)')
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (sessionError || !session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const admin = session.super_admins;

  if (!verifyPassword(oldPassword, admin.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const newPasswordHash = hashPassword(newPassword);

  const { error: updateError } = await supabase
    .from('super_admins')
    .update({
      password: newPasswordHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', admin.id);

  if (updateError) {
    return res.status(500).json({ error: 'Failed to update password' });
  }

  await supabase.from('super_admin_activity_log').insert({
    super_admin_id: admin.id,
    action: 'password_changed',
    details: { success: true }
  });

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
}

async function handleLogout(req, res, sessionToken) {
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }

  await supabase
    .from('super_admin_sessions')
    .delete()
    .eq('session_token', sessionToken);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}
