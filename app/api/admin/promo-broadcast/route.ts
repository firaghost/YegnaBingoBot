import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'
import { getClientIp, rateLimit } from '@/lib/server/rate-limit'
import crypto from 'crypto'

const supabase = supabaseAdmin

const RAW_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
const TELEGRAM_API = RAW_BOT_TOKEN ? `https://api.telegram.org/bot${RAW_BOT_TOKEN}` : ''
const MINI_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.MINI_APP_URL || ''

function generateSecurePromoCode(prefix: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return `${prefix}-${out}`
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, 'broadcast_manage')

    const ip = getClientIp(req)
    const rl = await rateLimit(`admin-promo-broadcast:${ip}`, 3, 60 * 60 * 1000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many promo broadcasts. Please try again later.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const { title, message, filters, targetUserIds, promo, maxRecipients } = body || {}
    const {
      type: promoType = 'tournament',
      amount,
      tournamentId,
      metric = 'deposits',
      rank = 1,
      expiresAmount,
      expiresUnit,
      expiresInDays,
    } = promo || {}

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 },
      )
    }

    if (!amount) {
      return NextResponse.json({ error: 'Promo amount is required' }, { status: 400 })
    }

    if (promoType !== 'tournament' && promoType !== 'generic') {
      return NextResponse.json({ error: 'Invalid promo type' }, { status: 400 })
    }

    if (promoType === 'tournament' && !tournamentId) {
      return NextResponse.json(
        { error: 'Tournament is required for tournament promos' },
        { status: 400 },
      )
    }

    if (metric !== 'deposits' && metric !== 'plays') {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
    }

    if (!RAW_BOT_TOKEN || RAW_BOT_TOKEN === 'undefined') {
      console.error('BOT_TOKEN is not configured for promo broadcast')
      return NextResponse.json(
        { error: 'Bot token not configured. Please set BOT_TOKEN in environment variables.' },
        { status: 500 },
      )
    }

    let query = supabase
      .from('users')
      .select('id, telegram_id, username, created_at, balance, games_played')
      .not('telegram_id', 'is', null)

    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      query = query.in('id', targetUserIds)
    } else {
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
    }

    // Generate a stable id to link promo rows to this broadcast record
    const broadcastId = crypto.randomUUID()

    const maxRecipientsNum =
      typeof maxRecipients === 'number' && maxRecipients > 0 ? Math.floor(maxRecipients) : null

    if (maxRecipientsNum) {
      query = query.limit(maxRecipientsNum)
    }

    const { data: users, error } = await query

    if (error) throw error

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'No users found matching criteria (users must have Telegram ID)' },
        { status: 404 },
      )
    }

    const now = new Date()
    const expires = new Date(now)
    let labelAmount: number
    let labelUnit: 'hours' | 'days'

    if (typeof expiresAmount === 'number' && expiresAmount > 0 && expiresUnit === 'hours') {
      labelAmount = expiresAmount
      labelUnit = 'hours'
      expires.setHours(expires.getHours() + expiresAmount)
    } else if (typeof expiresAmount === 'number' && expiresAmount > 0 && expiresUnit === 'days') {
      labelAmount = expiresAmount
      labelUnit = 'days'
      expires.setDate(expires.getDate() + expiresAmount)
    } else if (typeof expiresInDays === 'number' && expiresInDays > 0) {
      labelAmount = expiresInDays
      labelUnit = 'days'
      expires.setDate(expires.getDate() + expiresInDays)
    } else {
      labelAmount = 7
      labelUnit = 'days'
      expires.setDate(expires.getDate() + 7)
    }

    const expiresIso = expires.toISOString()

    const results = {
      total: users.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    const baseMessage = String(message || '').trim()
    const trimmedImageUrl =
      typeof body?.imageUrl === 'string' && body.imageUrl.trim().length > 0
        ? body.imageUrl.trim()
        : null

    // For generic promos, generate a single shared code for all recipients
    let sharedCode: string | null = null
    if (promoType === 'generic') {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateSecurePromoCode('PRM')
        const { data: existing, error: existsErr } = await supabase
          .from('tournament_promos')
          .select('id')
          .eq('code', candidate)
          .maybeSingle()
        if (existsErr || !existing) {
          sharedCode = candidate
          break
        }
      }
      if (!sharedCode) {
        return NextResponse.json(
          { error: 'Failed to generate promo code. Please try again.' },
          { status: 500 },
        )
      }
    }

    for (const user of users as any[]) {
      try {
        if (!user.telegram_id) {
          results.failed++
          results.errors.push(`User ${user.username || user.id}: no telegram_id`)
          continue
        }

        // Generate promo code
        let code = ''
        if (promoType === 'generic' && sharedCode) {
          code = sharedCode
        } else {
          // Tournament promos: best-effort unique code per user
          for (let attempt = 0; attempt < 3; attempt++) {
            code = generateSecurePromoCode('PRM')
            const { data: existing, error: existsErr } = await supabase
              .from('tournament_promos')
              .select('id')
              .eq('code', code)
              .maybeSingle()
            if (existsErr || !existing) break
          }
        }

        const { error: promoErr } = await supabase
          .from('tournament_promos')
          .insert({
            tournament_id: promoType === 'tournament' ? tournamentId : null,
            user_id: user.id,
            code,
            amount: Number(amount),
            metric,
            rank,
            expires_at: expiresIso,
            broadcast_id: broadcastId,
            promo_type: promoType,
            meta: {
              broadcast: true,
              created_by: admin.id,
              broadcast_id: broadcastId,
            },
          })

        if (promoErr) {
          console.error('Promo insert failed for user', user.id, promoErr)
          results.failed++
          results.errors.push(`User ${user.username || user.id}: promo insert failed`)
          continue
        }

        const safeTitle = String(title || '').trim()
        const safeMessage = baseMessage
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        const safeCode = String(code || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        const expiresText =
          labelUnit === 'hours'
            ? `Expires in ${labelAmount} hour${labelAmount === 1 ? '' : 's'}`
            : `Expires in ${labelAmount} day${labelAmount === 1 ? '' : 's'}`

        const parts: string[] = []
        parts.push(`<b>${safeTitle}</b>`) 
        parts.push('━━━━━━━━━━━━━━━━━━')
        if (safeMessage) {
          parts.push(safeMessage)
          parts.push('')
        }
        parts.push(`<b>Your Promo Code</b>`) 
        parts.push(`<code>${safeCode}</code>`) 
        parts.push('')
        parts.push(`<b>${expiresText}</b>`)
        parts.push('')
        parts.push('<b>How to claim</b>')
        parts.push('1) Open the BingoX mini app')
        parts.push('2) Go to Profile → Claim Promo')
        parts.push('3) Paste the code and confirm')
        parts.push('')
        parts.push('<i>Tip: This code works once per account. Please keep it private.</i>')
        parts.push('━━━━━━━━━━━━━━━━━━')

        const text = parts.join('\n')

        const payload: any = trimmedImageUrl
          ? {
              chat_id: user.telegram_id,
              photo: trimmedImageUrl,
              caption: text,
              parse_mode: 'HTML',
            }
          : {
              chat_id: user.telegram_id,
              text,
              parse_mode: 'HTML',
            }

        const appUrl = MINI_APP_URL && MINI_APP_URL.startsWith('https://') ? MINI_APP_URL : null
        if (appUrl) {
          payload.reply_markup = {
            inline_keyboard: [
              [
                {
                  text: 'Claim Promo',
                  web_app: { url: `${appUrl}/account?promo=1` },
                },
              ],
            ],
          }
        }

        const endpoint = trimmedImageUrl ? 'sendPhoto' : 'sendMessage'

        const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const json = await response.json()

        if (!response.ok) {
          results.failed++
          const errMsg = json?.description || JSON.stringify(json)
          console.error('Telegram sendMessage failed:', errMsg)
          results.errors.push(`User ${user.username || user.id}: ${errMsg}`)
        } else {
          results.sent++
        }

        await new Promise((resolve) => setTimeout(resolve, 50))
      } catch (e: any) {
        console.error('Error sending promo to user', (user as any)?.id, e)
        results.failed++
        results.errors.push(`User ${(user as any)?.username || (user as any)?.id}: ${e?.message || String(e)}`)
      }
    }

    try {
      await supabase.from('broadcasts').insert({
        id: broadcastId,
        title,
        message,
        recipients: results.total,
        sent: results.sent,
        failed: results.failed,
        filters: {
          ...(filters || {}),
          promo: {
            type: promoType,
            amount: Number(amount),
            tournamentId,
            metric,
            rank,
            expiresAmount: labelAmount,
            expiresUnit: labelUnit,
            ...(labelUnit === 'days' ? { expiresInDays: labelAmount } : {}),
          },
        },
        created_at: new Date().toISOString(),
      })
    } catch (e) {
      console.warn('Failed to store promo broadcast record:', e)
    }

    return NextResponse.json({
      success: true,
      results: {
        total: results.total,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.slice(0, 10),
      },
    })
  } catch (error: any) {
    console.error('Promo broadcast error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send promo broadcast',
        details: error?.message || String(error),
      },
      { status: 500 },
    )
  }
}
