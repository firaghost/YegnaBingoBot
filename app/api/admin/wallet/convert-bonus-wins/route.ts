import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminFromRequest, auditLog } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, amount, reason } = body || {}

    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'userId and positive amount are required' },
        { status: 400 }
      )
    }

    // Fetch current bonus_win_balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, balance, bonus_balance, bonus_win_balance')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const maxConvertible = Number(user.bonus_win_balance || 0)
    if (maxConvertible <= 0) {
      return NextResponse.json(
        { error: 'User has no Bonus Wins to convert' },
        { status: 400 }
      )
    }

    const convertAmount = Math.min(Number(amount), maxConvertible)

    const { data: converted, error: convError } = await supabase.rpc('convert_bonus_wins_to_real', {
      p_user_id: userId,
      p_amount: convertAmount,
      p_actor: admin.id,
      p_reason: reason || 'manual_bonus_win_to_real',
      p_metadata: { source: 'admin_panel' }
    })

    if (convError) {
      console.error('convert_bonus_wins_to_real error:', convError)
      return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
    }

    // Refetch updated user balances
    const { data: updatedUser } = await supabase
      .from('users')
      .select('id, username, balance, bonus_balance, bonus_win_balance')
      .eq('id', userId)
      .single()

    await auditLog(request, admin.id, 'wallet_bonus_win_to_real', {
      target_user_id: userId,
      requested_amount: amount,
      converted_amount: converted,
    })

    return NextResponse.json({
      success: true,
      convertedAmount: converted,
      user: updatedUser,
    })
  } catch (e: any) {
    console.error('Error in convert-bonus-wins admin API:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
