#!/usr/bin/env node

/**
 * Test database and bot connections
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSupabase() {
  log('\n🔍 Testing Supabase Connection...', 'blue');
  
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log('❌ Missing Supabase credentials in .env', 'red');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection by querying users table
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      log(`❌ Supabase Error: ${error.message}`, 'red');
      return false;
    }

    log('✅ Supabase connection successful!', 'green');
    return true;
  } catch (error) {
    log(`❌ Supabase connection failed: ${error.message}`, 'red');
    return false;
  }
}

async function testTelegramBot() {
  log('\n🔍 Testing Telegram Bot...', 'blue');

  return new Promise((resolve) => {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      log('❌ Missing BOT_TOKEN in .env', 'red');
      resolve(false);
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/getMe`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.ok) {
            log(`✅ Bot connected: @${response.result.username}`, 'green');
            log(`   Bot Name: ${response.result.first_name}`, 'blue');
            log(`   Bot ID: ${response.result.id}`, 'blue');
            resolve(true);
          } else {
            log(`❌ Bot error: ${response.description}`, 'red');
            resolve(false);
          }
        } catch (error) {
          log(`❌ Failed to parse response: ${error.message}`, 'red');
          resolve(false);
        }
      });
    }).on('error', (error) => {
      log(`❌ Bot connection failed: ${error.message}`, 'red');
      resolve(false);
    });
  });
}

async function testWebhook() {
  log('\n🔍 Checking Telegram Webhook...', 'blue');

  return new Promise((resolve) => {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      log('⚠️  Skipping webhook check (no BOT_TOKEN)', 'yellow');
      resolve(true);
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.ok) {
            const info = response.result;
            
            if (info.url) {
              log(`✅ Webhook set: ${info.url}`, 'green');
              log(`   Pending updates: ${info.pending_update_count}`, 'blue');
              if (info.last_error_message) {
                log(`   ⚠️  Last error: ${info.last_error_message}`, 'yellow');
              }
            } else {
              log('ℹ️  No webhook set (using polling mode)', 'yellow');
            }
            resolve(true);
          } else {
            log(`❌ Webhook check failed: ${response.description}`, 'red');
            resolve(false);
          }
        } catch (error) {
          log(`❌ Failed to parse response: ${error.message}`, 'red');
          resolve(false);
        }
      });
    }).on('error', (error) => {
      log(`❌ Webhook check failed: ${error.message}`, 'red');
      resolve(false);
    });
  });
}

async function checkEnvFile() {
  log('\n🔍 Checking Environment Variables...', 'blue');

  const required = [
    'BOT_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'ADMIN_PASSWORD'
  ];

  let allPresent = true;

  for (const key of required) {
    if (process.env[key]) {
      log(`✅ ${key} is set`, 'green');
    } else {
      log(`❌ ${key} is missing`, 'red');
      allPresent = false;
    }
  }

  return allPresent;
}

async function main() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║   🎮 Bingo Vault Connection Test 🎮   ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');

  const envOk = await checkEnvFile();
  const supabaseOk = await testSupabase();
  const botOk = await testTelegramBot();
  const webhookOk = await testWebhook();

  log('\n' + '═'.repeat(40), 'blue');
  log('📊 Test Results:', 'blue');
  log('═'.repeat(40), 'blue');

  const results = [
    { name: 'Environment Variables', status: envOk },
    { name: 'Supabase Connection', status: supabaseOk },
    { name: 'Telegram Bot', status: botOk },
    { name: 'Webhook Status', status: webhookOk }
  ];

  for (const result of results) {
    const icon = result.status ? '✅' : '❌';
    const color = result.status ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  }

  const allOk = envOk && supabaseOk && botOk;

  log('\n' + '═'.repeat(40), 'blue');
  
  if (allOk) {
    log('🎉 All tests passed! System is ready.', 'green');
    log('\nNext steps:', 'blue');
    log('1. Run: npm run bot', 'blue');
    log('2. Test bot in Telegram', 'blue');
    log('3. Run dashboard: npm run dev', 'blue');
  } else {
    log('⚠️  Some tests failed. Please fix the issues above.', 'yellow');
    log('\nTroubleshooting:', 'blue');
    log('1. Check .env file exists and has correct values', 'blue');
    log('2. Verify Supabase project is active', 'blue');
    log('3. Verify bot token from @BotFather', 'blue');
    log('4. Read SETUP_GUIDE.md for help', 'blue');
  }

  log('');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
