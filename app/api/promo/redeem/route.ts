import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { userId, code } = body || {}

    if (!userId || !code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing userId or promo code' }, { status: 400 })
    }

    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 })
    }

    const { data: amount, error } = await supabase.rpc('redeem_tournament_promo', {
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
      } else {
        status = 500
        clientMessage = 'Unexpected error while redeeming promo'
      }

      return NextResponse.json({ error: clientMessage }, { status })
    }

    const numericAmount = Number(amount || 0)

    const { data: user } = await supabase
      .from('users')
      .select('balance, real_balance, bonus_balance, bonus_win_balance')
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
