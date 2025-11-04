#!/usr/bin/env node

/**
 * Setup script for Bingo Vault
 * Helps configure environment and verify setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🎮 Bingo Vault Setup Wizard\n');
  console.log('This script will help you configure your environment.\n');

  // Check if .env exists
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log('\n📝 Please provide the following information:\n');

  // Collect information
  const botToken = await question('1. Telegram Bot Token (from @BotFather): ');
  const supabaseUrl = await question('2. Supabase URL (https://xxx.supabase.co): ');
  const supabaseKey = await question('3. Supabase Service Role Key: ');
  const supabaseAnonKey = await question('4. Supabase Anon Key: ');
  const adminPassword = await question('5. Admin Dashboard Password: ');

  // Create .env file
  const envContent = `# Telegram Bot Configuration
BOT_TOKEN=${botToken}

# Supabase Configuration
SUPABASE_URL=${supabaseUrl}
SUPABASE_KEY=${supabaseKey}

# Admin Configuration
ADMIN_PASSWORD=${adminPassword}

# Next.js Public Variables
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}

# Environment
NODE_ENV=development
`;

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env file created successfully!\n');

  // Verify setup
  console.log('🔍 Verifying setup...\n');

  const checks = [
    { name: 'Bot Token', value: botToken, valid: botToken.includes(':') },
    { name: 'Supabase URL', value: supabaseUrl, valid: supabaseUrl.startsWith('https://') },
    { name: 'Supabase Key', value: supabaseKey, valid: supabaseKey.length > 20 },
    { name: 'Anon Key', value: supabaseAnonKey, valid: supabaseAnonKey.length > 20 },
    { name: 'Admin Password', value: adminPassword, valid: adminPassword.length >= 8 }
  ];

  let allValid = true;
  for (const check of checks) {
    const status = check.valid ? '✅' : '❌';
    console.log(`${status} ${check.name}: ${check.valid ? 'Valid' : 'Invalid'}`);
    if (!check.valid) allValid = false;
  }

  console.log('\n');

  if (allValid) {
    console.log('🎉 Setup complete! Next steps:\n');
    console.log('1. Install dependencies:');
    console.log('   npm install');
    console.log('   cd dashboard && npm install\n');
    console.log('2. Set up Supabase database:');
    console.log('   - Go to Supabase SQL Editor');
    console.log('   - Run the schema from supabase/schema.sql\n');
    console.log('3. Test locally:');
    console.log('   npm run bot\n');
    console.log('4. Read SETUP_GUIDE.md for detailed instructions\n');
  } else {
    console.log('⚠️  Some values appear invalid. Please check and update .env file.\n');
  }

  rl.close();
}

main().catch(console.error);
