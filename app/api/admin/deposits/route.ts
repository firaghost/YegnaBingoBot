import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    // Fetch deposits (transactions with type='deposit')
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: deposits, error: depositsError } = await query

    if (depositsError) {
      console.error('Error fetching deposits:', depositsError)
      throw depositsError
    }

    // Manually fetch user data for each deposit
    const depositsWithUsers = await Promise.all(
      (deposits || []).map(async (deposit: any) => {
        const { data: user } = await supabase
          .from('users')
          .select('username, telegram_id')
          .eq('id', deposit.user_id)
          .single()

        return {
          ...deposit,
          users: user || { username: 'Unknown', telegram_id: null }
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: depositsWithUsers
    })
  } catch (error: any) {
    console.error('Error in deposits API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deposits' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, transactionId, reason } = await request.json()

    if (!action || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Get transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (txError || !transaction) {
      throw new Error('Transaction not found')
    }

    // Get user details for Telegram notification
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, username')
      .eq('id', transaction.user_id)
      .single()

    if (action === 'approve') {
      // Update transaction status to completed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', transactionId)

      if (updateError) throw updateError

      // Get deposit bonus percentage from admin config
      const depositBonusPercent = await getConfig('deposit_bonus') || 0
      const bonusAmount = (transaction.amount * depositBonusPercent) / 100

      // Apply deposit to real balance and bonus to bonus_balance
      const { error: applyErr } = await supabase.rpc('apply_deposit', {
        p_user_id: transaction.user_id,
        p_amount: transaction.amount,
        p_bonus: bonusAmount
      })

      if (applyErr) throw applyErr

      // If there's a bonus, create a separate bonus transaction
      if (bonusAmount > 0) {
        await supabase
          .from('transactions')
          .insert({
            user_id: transaction.user_id,
            type: 'bonus',
            amount: bonusAmount,
            status: 'completed',
            description: `Deposit bonus (${depositBonusPercent}% of ${transaction.amount} ETB)`
          })
      }

      // Send Telegram notification
      if (user?.telegram_id) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken) {
            const totalAdded = transaction.amount + bonusAmount
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: user.telegram_id,
                text: bonusAmount > 0 
                  ? `✅ *Deposit Approved*\n\nYour deposit of *${transaction.amount} ETB* has been approved!\n\n💰 *Bonus Applied:* ${bonusAmount} ETB (${depositBonusPercent}%)\n📊 *Total Added:* ${totalAdded} ETB\n\nYou can now use this balance to play games!`
                  : `✅ *Deposit Approved*\n\nYour deposit of *${transaction.amount} ETB* has been approved and added to your account.\n\nYou can now use this balance to play games!`,
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
        message: 'Deposit approved and balance added'
      })
    } else if (action === 'reject') {
      // Update transaction status to failed with rejection reason in metadata
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'failed',
          metadata: {
            ...transaction.metadata,
            rejection_reason: reason,
            rejected_at: new Date().toISOString(),
            rejected_by: 'admin'
          }
        })
        .eq('id', transactionId)

      if (updateError) throw updateError

      // Send Telegram notification
      if (user?.telegram_id) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: user.telegram_id,
                text: `❌ *Deposit Rejected*\n\nYour deposit request of *${transaction.amount} ETB* has been rejected.\n\n*Reason:* ${reason}\n\nPlease contact support if you have any questions.`,
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
        message: 'Deposit rejected'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error processing deposit:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process deposit' },
      { status: 500 }
    )
  }
}
