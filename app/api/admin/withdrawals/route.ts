import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAnyPermission, requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, ['transactions_view','withdrawals_manage'])
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
      (withdrawals || []).map(async (withdrawal: any) => {
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
    await requirePermission(request, 'withdrawals_manage')
    const { action, withdrawalId, adminNote } = await request.json()

    if (!action || !withdrawalId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get withdrawal details for notification
    const { data: withdrawal } = await supabase
      .from('withdrawals')
      .select('*, users(telegram_id, username)')
      .eq('id', withdrawalId)
      .single()

    if (action === 'approve') {
      // Use the approve function
      const { error } = await supabase.rpc('approve_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_admin_id: '00000000-0000-0000-0000-000000000000', // System admin
        p_admin_note: adminNote || null
      })

      if (error) throw error

      // Send Telegram notification
      if (withdrawal?.users?.telegram_id) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: withdrawal.users.telegram_id,
                text: `✅ *Withdrawal Approved*\n\nYour withdrawal request of *${withdrawal.amount} ETB* has been approved.\n\nThe funds will be transferred to your bank account within 24-48 hours.\n\n*Bank:* ${withdrawal.bank_name}\n*Account:* ${withdrawal.account_number}`,
                parse_mode: 'Markdown'
              })
            })
          }
        } catch (error) {
          console.error('Failed to send Telegram notification:', error)
        }
      }

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

      // Send Telegram notification
      if (withdrawal?.users?.telegram_id) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: withdrawal.users.telegram_id,
                text: `❌ *Withdrawal Rejected*\n\nYour withdrawal request of *${withdrawal.amount} ETB* has been rejected.\n\nYour balance has been refunded to your account.\n\n${adminNote ? `*Reason:* ${adminNote}` : 'Please contact support for more information.'}`,
                parse_mode: 'Markdown'
              })
            })
          }
        } catch (error) {
          console.error('Failed to send Telegram notification:', error)
        }
      }

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
