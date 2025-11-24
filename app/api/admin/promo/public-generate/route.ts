import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, 'broadcast_manage')

    const body = await req.json().catch(() => ({}))
    const { amount, maxUses, expiresAmount, expiresUnit } = body || {}

    const numericAmount = Number(amount || 0)
    const numericMaxUses = Number(maxUses || 0)

    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }
    if (!numericMaxUses || numericMaxUses <= 0) {
      return NextResponse.json({ error: 'Max players is required' }, { status: 400 })
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
    } else {
      labelAmount = 7
      labelUnit = 'days'
      expires.setDate(expires.getDate() + 7)
    }

    const expiresIso = expires.toISOString()

    // Generate unique code not used in public_promos
    let code = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const base = Math.random().toString(36).substring(2, 8).toUpperCase()
      code = `PRM-${base}`
      const { data: existing, error: existsErr } = await supabase
        .from('public_promos')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (existsErr || !existing) break
    }

    if (!code) {
      return NextResponse.json({ error: 'Failed to generate promo code' }, { status: 500 })
    }

    const { error } = await supabase.from('public_promos').insert({
      code,
      amount: numericAmount,
      max_uses: numericMaxUses,
      expires_at: expiresIso,
      created_by: admin.id,
      meta: {
        expiresAmount: labelAmount,
        expiresUnit: labelUnit,
      },
    })

    if (error) {
      console.error('Error inserting public promo:', error)
      return NextResponse.json({ error: 'Failed to create promo' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      code,
      amount: numericAmount,
      maxUses: numericMaxUses,
      expiresAt: expiresIso,
      expiresAmount: labelAmount,
      expiresUnit: labelUnit,
    })
  } catch (e: any) {
    console.error('Error in POST /api/admin/promo/public-generate:', e)
    return NextResponse.json({ error: e.message || 'Failed to generate promo' }, { status: 500 })
  }
}
