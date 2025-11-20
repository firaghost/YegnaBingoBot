import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/admin-config'

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

    // Bypass in development environment
    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      return NextResponse.json({ isMember: true, bypass: 'dev' }, { status: 200 })
    }

    // Check admin-config toggle to optionally disable membership requirement
    try {
      const cfg = await getConfig('require_channel_join')
      let requireJoin: boolean
      if (typeof cfg === 'boolean') requireJoin = cfg
      else if (cfg == null) requireJoin = true
      else {
        const s = String(cfg).trim().toLowerCase()
        requireJoin = !(s === 'false' || s === '0' || s === 'no')
      }
      if (!requireJoin) {
        return NextResponse.json({ isMember: true, bypass: 'disabled' }, { status: 200 })
      }
    } catch {
      // If config fetch fails, default to requiring join (fall through)
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
