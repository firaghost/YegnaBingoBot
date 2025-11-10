import { NextRequest, NextResponse } from 'next/server'
import { Telegraf } from 'telegraf'
import { setupBotHandlers } from '@/lib/bot-handlers'

const BOT_TOKEN = process.env.BOT_TOKEN!

// Create bot instance (stateless for serverless)
let bot: Telegraf | null = null

function getBot() {
  if (!bot) {
    bot = new Telegraf(BOT_TOKEN)
    setupBotHandlers(bot)
    console.log('✅ Bot handlers initialized for webhook')
  }
  return bot
}

export async function POST(request: NextRequest) {
  try {
    if (!BOT_TOKEN) {
      console.error('BOT_TOKEN not configured')
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
    }

    const body = await request.json()
    
    console.log('📨 Webhook received update:', {
      update_id: body.update_id,
      message: body.message?.text,
      callback_query: body.callback_query?.data,
      from: body.message?.from?.username || body.callback_query?.from?.username
    })
    
    const botInstance = getBot()
    await botInstance.handleUpdate(body)
    
    console.log('✅ Update processed successfully')
    
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'Webhook endpoint is active',
    bot_token: BOT_TOKEN ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  })
}
