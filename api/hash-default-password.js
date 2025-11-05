/**
 * One-time script to hash the default super admin password
 * Run this once after creating the super_admins table
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function hashDefaultPassword() {
  console.log('🔐 Hashing default super admin password...');
  
  // Get the super admin
  const { data: admin, error } = await supabase
    .from('super_admins')
    .select('*')
    .eq('username', 'superadmin')
    .single();

  if (error || !admin) {
    console.error('❌ Super admin not found');
    return;
  }

  // Check if already hashed
  if (admin.password.includes(':')) {
    console.log('✅ Password already hashed!');
    return;
  }

  // Hash the password
  const hashedPassword = hashPassword(admin.password);

  // Update in database
  const { error: updateError } = await supabase
    .from('super_admins')
    .update({ password: hashedPassword })
    .eq('id', admin.id);

  if (updateError) {
    console.error('❌ Failed to update password:', updateError);
    return;
  }

  console.log('✅ Password hashed successfully!');
  console.log('Username: superadmin');
  console.log('Password: SuperAdmin@2025! (unchanged, but now hashed)');
  console.log('');
  console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY via /super-settings');
}

hashDefaultPassword();
