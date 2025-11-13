import 'dotenv/config'

const BOT_TOKEN = process.env.BOT_TOKEN
const WEBHOOK_URL = process.env.WEBHOOK_URL // Should be your deployed bot URL

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not found in environment variables')
  process.exit(1)
}

async function setupWebhook() {
  try {
    // First, delete any existing webhook
    console.log('🗑️ Deleting existing webhook...')
    const deleteResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`)
    const deleteResult = await deleteResponse.json()
    console.log('Delete webhook result:', deleteResult)

    if (WEBHOOK_URL) {
      // Set new webhook
      console.log(`🔗 Setting webhook to: ${WEBHOOK_URL}`)
      const setResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: WEBHOOK_URL })
      })
      const setResult = await setResponse.json()
      console.log('Set webhook result:', setResult)
    } else {
      console.log('📱 No WEBHOOK_URL provided, bot will run in polling mode')
    }

    // Get webhook info
    console.log('ℹ️ Getting webhook info...')
    const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
    const infoResult = await infoResponse.json()
    console.log('Webhook info:', JSON.stringify(infoResult, null, 2))

    // Get bot info
    console.log('🤖 Getting bot info...')
    const botResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
    const botResult = await botResponse.json()
    console.log('Bot info:', JSON.stringify(botResult, null, 2))

  } catch (error) {
    console.error('❌ Error setting up webhook:', error)
  }
}

setupWebhook()
