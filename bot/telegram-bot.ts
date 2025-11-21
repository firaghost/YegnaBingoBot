import { Telegraf } from 'telegraf'
import { setupBotHandlers } from '../lib/bot-handlers'

const BOT_TOKEN = process.env.BOT_TOKEN

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set. Please configure it in your environment.')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)
setupBotHandlers(bot)

async function launch() {
  try {
    console.log('🚀 Launching Telegram bot with polling...')
    await bot.launch()
    console.log('✅ Bot is up and running')

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
  } catch (err) {
    console.error('Failed to launch bot:', err)
    process.exit(1)
  }
}

launch()
