import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'
import { getClientIp, rateLimit } from '@/lib/server/rate-limit'

const RAW_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
const TELEGRAM_API = RAW_BOT_TOKEN ? `https://api.telegram.org/bot${RAW_BOT_TOKEN}` : ''

function escapeMarkdown(input: string) {
  return input.replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
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

    // Get users based on filters or explicit selection - only users with telegram_id
    let query = supabase
      .from('users')
      .select('id, telegram_id, username')
      .not('telegram_id', 'is', null)

    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      query = query.in('id', targetUserIds)
    } else {
      if (filters?.activeOnly) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gte('last_active', yesterday.toISOString())
      }

      if (filters?.minBalance) {
        query = query.gte('balance', filters.minBalance)
      }

      if (filters?.minGames) {
        query = query.gte('games_played', filters.minGames)
      }
    }

    const { data: users, error } = await query

    if (error) throw error

    if (!users || users.length === 0) {
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

    for (const user of users) {
      try {
        if (!user.telegram_id) {
          console.log(`⚠️ Skipping user ${user.username} - no telegram_id`)
          results.failed++
          results.errors.push(`User ${user.username}: No telegram ID`)
          continue
        }

        console.log(`Sending to user: ${user.username} (${user.telegram_id})`)

        // Get the app URL - use NEXT_PUBLIC_APP_URL or VERCEL_URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

        const messagePayload: any = trimmedImageUrl
          ? {
              chat_id: user.telegram_id,
              photo: trimmedImageUrl,
              caption: broadcastMessage
            }
          : {
              chat_id: user.telegram_id,
              text: broadcastMessage
            }

        // Only add web_app button if we have a valid HTTPS URL
        if (appUrl && appUrl.startsWith('https://')) {
          messagePayload.reply_markup = {
            inline_keyboard: [
              [{ text: '🎮 Play Now', web_app: { url: appUrl } }]
            ]
          }
        }

        const endpoint = trimmedImageUrl ? 'sendPhoto' : 'sendMessage'

        const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload)
        })

        const responseData = await response.json()

        if (response.ok) {
          results.sent++
          console.log(`✅ Sent to ${user.username}`)
        } else {
          results.failed++
          const errorMsg = responseData.description || JSON.stringify(responseData)
          if (response.status === 401) {
            console.error('❌ Telegram returned 401 Unauthorized. Please verify TELEGRAM_BOT_TOKEN / BOT_TOKEN.')
          }
          console.error(`❌ Failed to send to ${user.username}: ${errorMsg}`)
          results.errors.push(`User ${user.username}: ${errorMsg}`)
        }

        // Rate limiting: wait 50ms between messages
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (err: any) {
        results.failed++
        const errorMsg = err.message || String(err)
        console.error(`❌ Error sending to ${user.username}: ${errorMsg}`)
        results.errors.push(`User ${user.username}: ${errorMsg}`)
      }
    }

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
