import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'
import { getClientIp, rateLimit } from '@/lib/server/rate-limit'

const RAW_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
const TELEGRAM_API = RAW_BOT_TOKEN ? `https://api.telegram.org/bot${RAW_BOT_TOKEN}` : ''

function escapeMarkdown(input: string) {
  return input.replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'broadcast_manage')

    // Protect against abuse: limit broadcasts per IP
    const ip = getClientIp(request)
    const rl = await rateLimit(`admin-broadcast:${ip}`, 5, 60 * 60 * 1000) // 5 broadcasts per hour
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many broadcast requests. Please try again later.' },
        { status: 429 }
      )
    }
    const { title, message, filters, imageUrl, targetUserIds } = await request.json()

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      )
    }

    // Check if BOT_TOKEN is configured
    if (!RAW_BOT_TOKEN || RAW_BOT_TOKEN === 'undefined') {
      console.error('BOT_TOKEN is not configured')
      return NextResponse.json(
        { error: 'Bot token not configured. Please set BOT_TOKEN in environment variables.' },
        { status: 500 }
      )
    }

    const baseQuery = () => supabase
      .from('users')
      .select('id, telegram_id, username', { count: 'exact' })
      .not('telegram_id', 'is', null)

    const applyFilters = (q: any) => {
      let query = q
      if (filters?.activeOnly) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gte('updated_at', yesterday.toISOString())
      }
      if (filters?.minBalance != null) {
        query = query.gte('balance', filters.minBalance)
      }
      if (filters?.minGames != null) {
        query = query.gte('games_played', filters.minGames)
      }
      if (filters?.newUsersSinceDays != null && filters.newUsersSinceDays > 0) {
        const since = new Date()
        since.setDate(since.getDate() - filters.newUsersSinceDays)
        query = query.gte('created_at', since.toISOString())
      }
      if (filters?.dormantDays != null && filters.dormantDays > 0) {
        const since = new Date()
        since.setDate(since.getDate() - filters.dormantDays)
        query = query.lt('updated_at', since.toISOString())
      }
      return query
    }

    const users: Array<{ id: string; telegram_id: string | null; username: string | null }> = []

    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      // Supabase can reject very large IN clauses; chunk by 500
      const chunkSize = 500
      for (let i = 0; i < targetUserIds.length; i += chunkSize) {
        const slice = targetUserIds.slice(i, i + chunkSize)
        const { data, error } = await baseQuery().in('id', slice)
        if (error) throw error
        users.push(...((data || []) as any[]))
      }
    } else {
      const pageSize = 1000
      // count first
      const { count, error: countErr } = await applyFilters(
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .not('telegram_id', 'is', null)
      )

      if (countErr) throw countErr
      const total = Number(count || 0)

      for (let offset = 0; offset < total; offset += pageSize) {
        const { data, error } = await applyFilters(baseQuery())
          .range(offset, offset + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        users.push(...((data || []) as any[]))
      }
    }

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found matching criteria (users must have Telegram ID)' },
        { status: 404 }
      )
    }

    // Send broadcast to all users
    const results = {
      total: users.length,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    const trimmedImageUrl = typeof imageUrl === 'string' && imageUrl.trim().length > 0 ? imageUrl.trim() : null
    const broadcastMessage = `📢 ${title}\n\n${message}`

    console.log(`📢 Starting broadcast to ${users.length} users`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    const endpoint = trimmedImageUrl ? 'sendPhoto' : 'sendMessage'

    let cursor = 0
    const concurrency = 3
    const throttleMs = 120
    const progressEvery = 100

    const pushError = (msg: string) => {
      if (results.errors.length < 25) {
        results.errors.push(msg)
      }
    }

    const logProgress = () => {
      const done = results.sent + results.failed
      if (done > 0 && done % progressEvery === 0) {
        console.log(`📣 Broadcast progress: ${done}/${results.total} processed (sent=${results.sent}, failed=${results.failed})`)
      }
    }

    const sendToUser = async (user: { id: string; telegram_id: string | null; username: string | null }) => {
      try {
        if (!user.telegram_id) {
          results.failed++
          pushError(`User ${user.username}: No telegram ID`)
          logProgress()
          return
        }

        const messagePayload: any = trimmedImageUrl
          ? { chat_id: user.telegram_id, photo: trimmedImageUrl, caption: broadcastMessage }
          : { chat_id: user.telegram_id, text: broadcastMessage }

        if (appUrl && appUrl.startsWith('https://')) {
          messagePayload.reply_markup = {
            inline_keyboard: [[{ text: '🎮 Play Now', web_app: { url: appUrl } }]]
          }
        }

        const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload)
        })

        const responseData = await response.json().catch(() => ({}))

        if (response.ok) {
          results.sent++
        } else {
          results.failed++
          const errorMsg = (responseData as any)?.description || JSON.stringify(responseData)
          if (response.status === 401) {
            console.error('❌ Telegram returned 401 Unauthorized. Please verify TELEGRAM_BOT_TOKEN / BOT_TOKEN.')
          }
          pushError(`User ${user.username}: ${errorMsg}`)
        }

        logProgress()
      } catch (err: any) {
        results.failed++
        const errorMsg = err?.message || String(err)
        pushError(`User ${user.username}: ${errorMsg}`)
        logProgress()
      } finally {
        await sleep(throttleMs)
      }
    }

    const worker = async () => {
      while (true) {
        const idx = cursor
        cursor++
        if (idx >= users.length) return
        await sendToUser(users[idx])
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, users.length) }, () => worker()))

    console.log(`📊 Broadcast complete: ${results.sent} sent, ${results.failed} failed`)

    // Store broadcast record
    const storedFilters = {
      ...(filters || {}),
      ...(trimmedImageUrl ? { imageUrl: trimmedImageUrl } : {}),
      ...(Array.isArray(targetUserIds) && targetUserIds.length > 0 ? { targetUserIds } : {})
    }

    await supabase.from('broadcasts').insert({
      title,
      message,
      recipients: results.total,
      sent: results.sent,
      failed: results.failed,
      filters: storedFilters,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      results: {
        total: results.total,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.slice(0, 10) // Return first 10 errors
      }
    })
  } catch (error: any) {
    console.error('Broadcast error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send broadcast',
        details: error.message || String(error)
      },
      { status: 500 }
    )
  }
}
