import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://yegna-bingo-bot.vercel.app/api/webhook';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

async function setupWebhook() {
  try {
    console.log('🔧 Setting up webhook...');
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);

    // Delete existing webhook
    console.log('\n1️⃣ Deleting existing webhook...');
    const deleteResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`
    );
    const deleteResult = await deleteResponse.json();
    console.log('Delete result:', deleteResult);

    // Set new webhook
    console.log('\n2️⃣ Setting new webhook...');
    const setResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message', 'callback_query', 'inline_query'],
          drop_pending_updates: true
        })
      }
    );
    const setResult = await setResponse.json();
    console.log('Set result:', setResult);

    // Get webhook info
    console.log('\n3️⃣ Verifying webhook...');
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const infoResult = await infoResponse.json();
    console.log('Webhook info:', JSON.stringify(infoResult, null, 2));

    if (infoResult.result.url === WEBHOOK_URL) {
      console.log('\n✅ Webhook setup successful!');
      console.log(`📍 URL: ${infoResult.result.url}`);
      console.log(`✔️ Pending updates: ${infoResult.result.pending_update_count}`);
    } else {
      console.log('\n❌ Webhook setup failed!');
      console.log('Expected:', WEBHOOK_URL);
      console.log('Got:', infoResult.result.url);
    }
  } catch (error) {
    console.error('❌ Error setting up webhook:', error);
    process.exit(1);
  }
}

setupWebhook();
