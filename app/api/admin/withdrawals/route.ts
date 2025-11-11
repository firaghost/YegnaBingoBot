import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    // Fetch withdrawals
    let query = supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: withdrawals, error: withdrawalsError } = await query

    if (withdrawalsError) {
      console.error('Error fetching withdrawals:', withdrawalsError)
      throw withdrawalsError
    }

    // Manually fetch user data for each withdrawal
    const withdrawalsWithUsers = await Promise.all(
      (withdrawals || []).map(async (withdrawal) => {
        const { data: user } = await supabase
          .from('users')
          .select('username, telegram_id')
          .eq('id', withdrawal.user_id)
          .single()

        return {
          ...withdrawal,
          users: user || { username: 'Unknown', telegram_id: null }
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: withdrawalsWithUsers
    })
  } catch (error: any) {
    console.error('Error in withdrawals API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch withdrawals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, withdrawalId, adminNote } = await request.json()

    if (!action || !withdrawalId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Use the approve function
      const { error } = await supabase.rpc('approve_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_admin_id: '00000000-0000-0000-0000-000000000000', // System admin
        p_admin_note: adminNote || null
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Withdrawal approved'
      })
    } else if (action === 'reject') {
      // Use the reject function
      const { error } = await supabase.rpc('reject_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_admin_id: '00000000-0000-0000-0000-000000000000', // System admin
        p_admin_note: adminNote || null
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected and balance refunded'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error processing withdrawal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
