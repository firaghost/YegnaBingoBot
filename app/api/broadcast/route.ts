import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BOT_TOKEN = process.env.BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function POST(request: NextRequest) {
  try {
    const { title, message, filters } = await request.json()

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      )
    }

    // Get users based on filters
    let query = supabase.from('users').select('telegram_id, username')

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

    const { data: users, error } = await query

    if (error) throw error

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'No users found matching criteria' },
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

    const broadcastMessage = `📢 *${title}*\n\n${message}`

    for (const user of users) {
      try {
        const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.telegram_id,
            text: broadcastMessage,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Play Now', web_app: { url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' } }]
              ]
            }
          })
        })

        if (response.ok) {
          results.sent++
        } else {
          results.failed++
          const errorData = await response.json()
          results.errors.push(`User ${user.username}: ${errorData.description}`)
        }

        // Rate limiting: wait 50ms between messages
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (err) {
        results.failed++
        results.errors.push(`User ${user.username}: ${err}`)
      }
    }

    // Store broadcast record
    await supabase.from('broadcasts').insert({
      title,
      message,
      recipients: results.total,
      sent: results.sent,
      failed: results.failed,
      filters: filters || {},
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Broadcast error:', error)
    return NextResponse.json(
      { error: 'Failed to send broadcast' },
      { status: 500 }
    )
  }
}
