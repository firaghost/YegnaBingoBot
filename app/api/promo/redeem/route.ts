import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromSession } from '@/lib/server/user-session'
import { getConfig } from '@/lib/admin-config'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { code } = body || {}

    let userId: string | null = null
    try {
      const sessionUser = await getUserFromSession(req)
      userId = sessionUser.id
    } catch (e) {
      // Temporary fallback for old clients that still send userId explicitly
      userId = (body as any)?.userId || null
      if (userId) {
        console.warn('Promo redeem is falling back to body.userId; consider migrating client to cookie-based sessions.')
      }
    }

    if (!userId || !code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing user or promo code' }, { status: 400 })
    }

    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 })
    }

    try {
      const allowStacking = Boolean(await getConfig('allow_bonus_stacking'))
      if (!allowStacking) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: existingPromoTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'bonus')
          .eq('status', 'completed')
          .gte('created_at', since)
          .not('metadata->>code', 'is', null)
          .limit(1)

        if (Array.isArray(existingPromoTx) && existingPromoTx.length > 0) {
          return NextResponse.json({ error: 'You already have an active promo. Try again later.' }, { status: 409 })
        }
      }
    } catch {
      // ignore enforcement failures
    }

    const { data: amount, error } = await supabase.rpc('redeem_any_promo', {
      p_user_id: userId,
      p_code: trimmed,
    })

    if (error) {
      const msg = error.message || ''
      let clientMessage = 'Failed to redeem promo'
      let status = 400

      if (msg.includes('PROMO_INVALID')) {
        clientMessage = 'Invalid promo code'
      } else if (msg.includes('PROMO_WRONG_USER')) {
        clientMessage = 'This promo code belongs to another account'
        status = 403
      } else if (msg.includes('PROMO_ALREADY_USED')) {
        clientMessage = 'This promo code was already used'
        status = 409
      } else if (msg.includes('PROMO_EXPIRED')) {
        clientMessage = 'This promo code has expired'
        status = 410
      } else if (msg.includes('PROMO_EXHAUSTED')) {
        clientMessage = 'This promo is fully claimed'
        status = 410
      } else {
        status = 500
        clientMessage = 'Unexpected error while redeeming promo'
      }

      return NextResponse.json({ error: clientMessage }, { status })
    }

    const numericAmount = Number(amount || 0)

    const { data: user } = await supabase
      .from('users')
      .select('balance, bonus_balance, bonus_win_balance')
      .eq('id', userId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      amount: numericAmount,
      balances: user || null,
    })
  } catch (err: any) {
    console.error('Error in POST /api/promo/redeem:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
