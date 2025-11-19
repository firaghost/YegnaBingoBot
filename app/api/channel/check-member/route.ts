import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_USERNAME

function resolveChannelId(username: string) {
  if (!username) return ''
  const trimmed = username.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('@') || trimmed.startsWith('-100')) {
    return trimmed
  }
  return `@${trimmed}`
}

export async function POST(request: NextRequest) {
  try {
    const { telegramId } = await request.json()

    if (!telegramId) {
      return NextResponse.json({ isMember: false, error: 'telegramId is required' }, { status: 200 })
    }

    if (!BOT_TOKEN) {
      return NextResponse.json({ isMember: false, error: 'TELEGRAM_BOT_TOKEN / BOT_TOKEN environment variable is not configured.' }, { status: 200 })
    }

    if (!CHANNEL_USERNAME) {
      return NextResponse.json({ isMember: false, error: 'TELEGRAM_CHANNEL_USERNAME environment variable is not configured.' }, { status: 200 })
    }

    const chatId = resolveChannelId(CHANNEL_USERNAME)
    if (!chatId) {
      return NextResponse.json({ isMember: false, error: 'Channel identifier is invalid.' }, { status: 200 })
    }

    const endpoint = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`

    let response: Response
    try {
      response = await fetch(`${endpoint}?chat_id=${encodeURIComponent(chatId)}&user_id=${encodeURIComponent(telegramId)}`, {
        method: 'GET',
        cache: 'no-store'
      })
    } catch (networkError: any) {
      console.error('Telegram getChatMember network error:', networkError)
      return NextResponse.json({ isMember: false, error: 'Unable to reach Telegram. Please ensure outbound traffic is allowed.' }, { status: 200 })
    }

    let data: any = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok || !data?.ok) {
      const description: string = data?.description || 'Unable to verify membership'
      const normalized = description.toLowerCase()
      if (normalized.includes('user not found') || normalized.includes('user is not a member')) {
        return NextResponse.json({ isMember: false, status: 'not_found' }, { status: 200 })
      }

      console.warn('Telegram getChatMember returned error:', description)
      return NextResponse.json({ isMember: false, error: description }, { status: 200 })
    }

    const status = data.result?.status as string | undefined
    const isMember = ['member', 'creator', 'administrator', 'restricted'].includes(status || '')

    return NextResponse.json({ isMember, status: status ?? null }, { status: 200 })
  } catch (error: any) {
    console.error('Channel membership check failed:', error)
    return NextResponse.json({ isMember: false, error: 'Failed to check channel membership.' }, { status: 200 })
  }
}
