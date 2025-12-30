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
    const { userId, deltaCash = 0, deltaBonus = 0, deltaLocked = 0, reason } = body || {}

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const dCash = Number(deltaCash) || 0
    const dBonus = Number(deltaBonus) || 0
    const dLocked = Number(deltaLocked) || 0

    if (dCash === 0 && dBonus === 0 && dLocked === 0) {
      return NextResponse.json({ error: 'At least one non-zero delta is required' }, { status: 400 })
    }

    // Fetch existing balances
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, balance, bonus_balance, locked_balance, bonus_win_balance')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const nextBalance = Number(user.balance || 0) + dCash
    const nextBonus = Number(user.bonus_balance || 0) + dBonus
    const nextLocked = Number(user.locked_balance || 0) + dLocked

    const { error: updateError } = await supabase
      .from('users')
      .update({
        balance: nextBalance,
        bonus_balance: nextBonus,
        locked_balance: nextLocked,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('adjust-balance update error:', updateError)
      return NextResponse.json({ error: 'Failed to update balances' }, { status: 500 })
    }

    const { data: updatedUser } = await supabase
      .from('users')
      .select('id, balance, bonus_balance, locked_balance, bonus_win_balance')
      .eq('id', userId)
      .single()

    await auditLog(request, admin.id, 'wallet_adjust_balance', {
      target_user_id: userId,
      deltaCash: dCash,
      deltaBonus: dBonus,
      deltaLocked: dLocked,
      reason: reason || 'manual_adjustment',
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (e: any) {
    console.error('Error in adjust-balance admin API:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
