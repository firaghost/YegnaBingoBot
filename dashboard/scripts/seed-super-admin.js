/**
 * Seed Super Admin Script
 * This script creates a super admin account in the database
 * 
 * Usage: node scripts/seed-super-admin.js
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedSuperAdmin() {
  console.log('🌱 Seeding Super Admin Account...\n');

  // Super Admin credentials
  const superAdmin = {
    username: 'superadmin',
    email: 'superadmin@yegnabingo.com',
    password: 'SuperAdmin2025!',
  };

  try {
    // Hash the password
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(superAdmin.password, 10);

    // Check if super_admins table exists, if not create it
    console.log('📋 Checking super_admins table...');
    
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS super_admins (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login TIMESTAMP WITH TIME ZONE,
          is_active BOOLEAN DEFAULT true
        );
        
        CREATE INDEX IF NOT EXISTS idx_super_admins_username ON super_admins(username);
        CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);
      `
    });

    // Insert super admin
    console.log('👤 Creating super admin account...');
    
    const { data, error } = await supabase
      .from('super_admins')
      .upsert({
        username: superAdmin.username,
        email: superAdmin.email,
        password: passwordHash,  // Changed from password_hash to password
        is_active: true,
      }, {
        onConflict: 'username',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.log('⚠️  Error:', error.message);
      console.log('Trying alternative method...');
      
      // Try direct insert
      const { error: insertError } = await supabase
        .from('super_admins')
        .insert({
          username: superAdmin.username,
          email: superAdmin.email,
          password: passwordHash,
          is_active: true,
        });

      if (insertError) {
        throw insertError;
      }
    }

    console.log('\n✅ Super Admin account created successfully!\n');
    console.log('═══════════════════════════════════════════');
    console.log('📧 Email:    ', superAdmin.email);
    console.log('👤 Username: ', superAdmin.username);
    console.log('🔑 Password: ', superAdmin.password);
    console.log('═══════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Change the password immediately after first login!\n');
    console.log('🔗 Login at: http://localhost:3000/super-login\n');

  } catch (error) {
    console.error('\n❌ Error seeding super admin:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure you have the correct Supabase credentials');
    console.error('2. Ensure you have the service role key (not anon key)');
    console.error('3. Check if the super_admins table exists in your database');
    console.error('\nManual SQL to run in Supabase SQL Editor:');
    console.error('─────────────────────────────────────────');
    console.error(`
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO super_admins (username, email, password, is_active)
VALUES (
  'superadmin',
  'superadmin@yegnabingo.com',
  '${await bcrypt.hash('SuperAdmin2025!', 10)}',
  true
)
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;
    `);
    console.error('─────────────────────────────────────────\n');
    process.exit(1);
  }
}

// Run the seed function
seedSuperAdmin();
