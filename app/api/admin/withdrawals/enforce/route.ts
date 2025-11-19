import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    // 1) Process all pending withdrawals for users with no deposits
    const { data: rows, error } = await supabase.rpc('process_pending_withdrawals_no_deposit')
    if (error) throw error

    const affected = Array.isArray(rows) ? rows : []

    // 2) Notify affected users
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
    if (botToken && affected.length > 0) {
      // Fetch telegram ids in batch
      const userIds = affected.map((r: any) => r.user_id)
      const { data: users } = await supabase
        .from('users')
        .select('id, telegram_id')
        .in('id', userIds)

      const map = new Map<string, string>()
      for (const u of users || []) map.set(u.id, u.telegram_id)

      const message = '⚠️ Withdrawal Blocked\n\nYour withdrawal was generated from bonus-based funds. Bonus winnings require a real deposit before withdrawal. Your balance has been moved to your Bonus Wallet.'

      await Promise.all(
        affected.map(async (r: any) => {
          const chatId = map.get(r.user_id)
          if (!chatId) return
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: message })
            })
          } catch (e) {
            // continue
          }
        })
      )
    }

    return NextResponse.json({
      success: true,
      processed: affected.length,
      details: affected,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to enforce rules' }, { status: 500 })
  }
}
