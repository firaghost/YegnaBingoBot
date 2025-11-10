import { NextRequest, NextResponse } from 'next/server'
import { Telegraf } from 'telegraf'

const BOT_TOKEN = process.env.BOT_TOKEN!

// Import the bot instance
let bot: Telegraf | null = null

// Initialize bot only once
function getBot() {
  if (!bot) {
    bot = new Telegraf(BOT_TOKEN)
    
    // Import and setup all bot handlers
    // Note: This is a simplified version - you'll need to copy all handlers from telegram-bot.ts
    bot.command('start', async (ctx) => {
      await ctx.reply('Bot is running via webhook! Use the full bot commands.')
    })
    
    bot.command('balance', async (ctx) => {
      await ctx.reply('Balance command via webhook')
    })
  }
  return bot
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Webhook received:', body)
    
    const botInstance = getBot()
    await botInstance.handleUpdate(body)
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'Webhook endpoint is active',
    bot_token: BOT_TOKEN ? 'configured' : 'missing'
  })
}
