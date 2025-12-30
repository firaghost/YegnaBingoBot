import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromSession } from '@/lib/server/user-session'
import { getConfig } from '@/lib/admin-config'
import { applyFirstDepositUnlock } from '@/lib/server/wallet-service'
import { recordDeposit } from '@/lib/server/tournament-service'

// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { amount, paymentMethod, bankId, bankInfo, transactionRef, proofUrl, userId: bodyUserId } = await request.json()

    let userId: string | null = null
    try {
      const sessionUser = await getUserFromSession(request)
      userId = sessionUser.id
    } catch {
      // Temporary fallback for older clients that still send userId explicitly
      userId = bodyUserId || null
    }

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Transaction reference is REQUIRED
    if (!transactionRef || transactionRef.trim() === '') {
      return NextResponse.json(
        { error: 'Transaction reference/FTP number is required' },
        { status: 400 }
      )
    }

    // Get user data
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create pending transaction with metadata
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        status: 'pending',
        metadata: {
          payment_method: paymentMethod || 'Bank Transfer',
          bank_id: bankId,
          bank_info: bankInfo,
          transaction_reference: transactionRef,
          proof_url: proofUrl || null
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      return NextResponse.json(
        { error: 'Failed to create transaction', details: error.message },
        { status: 500 }
      )
    }

    // Notify admin via Telegram
    try {
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID
      if (adminTelegramId) {
        const botToken = process.env.BOT_TOKEN
        const message = 
          `💰 *New Deposit Request*\n\n` +
          `User: ${user.username}\n` +
          `Telegram ID: ${user.telegram_id}\n` +
          `Amount: ${amount} ETB\n` +
          `Method: ${paymentMethod || 'Bank Transfer'}\n` +
          `${transactionRef ? `Reference: ${transactionRef}\n` : ''}` +
          `Transaction ID: ${transaction.id}\n\n` +
          `Use the buttons below to approve or reject this deposit.`

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminTelegramId,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Approve', callback_data: `approve_deposit_${transaction.id}` },
                { text: '❌ Reject', callback_data: `reject_deposit_${transaction.id}` }
              ]]
            }
          })
        })
      }
    } catch (notifyError) {
      console.error('Error notifying admin:', notifyError)
      // Don't fail the request if notification fails
    }

    // Auto-approve deposits (optional) - non-crypto
    try {
      const autoApprove = Boolean(await getConfig('auto_approve_deposits'))
      if (autoApprove) {
        const depositBonusPercentRaw = await getConfig('deposit_bonus')
        const depositBonusPercent = Number(depositBonusPercentRaw) || 0
        const bonusAmount = (Number(transaction.amount || 0) * depositBonusPercent) / 100
        const totalCredit = Number(transaction.amount || 0) + Number(bonusAmount || 0)

        const { data: userBefore } = await supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single()

        await applyFirstDepositUnlock(userId, totalCredit, {
          ...(transaction.metadata || {}),
          method: 'manual',
          via: 'auto-approve',
          transaction_id: transaction.id,
        })

        const { data: userAfter } = await supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single()

        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            metadata: {
              ...(transaction.metadata || {}),
              auto_approved: true,
              approved_at: new Date().toISOString(),
              real_balance_before: Number(userBefore?.balance ?? 0),
              real_balance_after: Number(userAfter?.balance ?? 0),
            },
          } as any)
          .eq('id', transaction.id)

        try {
          await recordDeposit(userId, Number(transaction.amount || 0))
        } catch (e) {
          console.warn('Failed to record tournament deposit metric:', e)
        }

        if (bonusAmount > 0) {
          await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              type: 'bonus',
              amount: bonusAmount,
              status: 'completed',
              description: `Deposit bonus (${depositBonusPercent}% of ${transaction.amount} ETB) credited to real balance`,
              metadata: { code: 'deposit_bonus', source: 'auto_approve_deposits' },
            })
        }

        return NextResponse.json({
          success: true,
          message: 'Deposit approved automatically',
          transaction_id: transaction.id,
        })
      }
    } catch (e) {
      console.warn('Auto-approve deposit failed:', (e as any)?.message || e)
    }

    return NextResponse.json({
      success: true,
      message: 'Deposit request submitted successfully',
      transaction_id: transaction.id
    })
  } catch (error) {
    console.error('Error processing deposit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
