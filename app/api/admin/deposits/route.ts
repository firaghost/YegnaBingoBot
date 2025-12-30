import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { requireAnyPermission, requirePermission } from '@/lib/server/admin-permissions'
import { getClientIp, rateLimit } from '@/lib/server/rate-limit'
import { applyFirstDepositUnlock } from '@/lib/server/wallet-service'
import { recordDeposit } from '@/lib/server/tournament-service'
import { generateReceiptPdfBuffer } from '@/lib/server/receipt-pdf'
import { sendTelegramMessage, sendTelegramPdf } from '@/lib/server/telegram-send'

const supabase = supabaseAdmin

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.MINI_APP_URL || process.env.APP_URL || ''

function escapeMarkdown(text: string): string {
  return text.replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

function getAppReplyMarkup() {
  if (APP_URL && APP_URL.startsWith('https://')) {
    return {
      inline_keyboard: [[{ text: 'Open Wallet', web_app: { url: APP_URL } }]]
    }
  }
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, ['transactions_view','deposits_manage'])
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
    await requirePermission(request, 'deposits_manage')

    // Basic rate limiting for deposit approval/rejection actions
    const ip = getClientIp(request)
    const rl = await rateLimit(`admin-deposits:${ip}`, 60, 10 * 60 * 1000) // 60 actions / 10 minutes per IP
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many deposit actions. Please slow down and try again shortly.' },
        { status: 429 }
      )
    }
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
      // Get deposit bonus percentage from admin config
      const depositBonusPercentRaw = await getConfig('deposit_bonus')
      const depositBonusPercent = Number(depositBonusPercentRaw) || 0
      const bonusAmount = (transaction.amount * depositBonusPercent) / 100
      const totalCredit = transaction.amount + bonusAmount

      // Capture real balance before credit
      const { data: userBefore } = await supabase
        .from('users')
        .select('balance')
        .eq('id', transaction.user_id)
        .single()

      // Apply entire credit to real balance using first-deposit unlock semantics
      await applyFirstDepositUnlock(transaction.user_id, totalCredit, {
        ...(transaction.metadata || {}),
        method: 'manual',
        via: 'admin-approve',
        transaction_id: transactionId,
      })

      // Capture real balance after credit
      const { data: userAfter } = await supabase
        .from('users')
        .select('balance')
        .eq('id', transaction.user_id)
        .single()

      // Mark transaction completed and attach balance snapshots
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          metadata: {
            ...(transaction.metadata || {}),
            approved_by_admin: true,
            approved_at: new Date().toISOString(),
            real_balance_before: Number(userBefore?.balance ?? 0),
            real_balance_after: Number(userAfter?.balance ?? 0)
          }
        } as any)
        .eq('id', transactionId)

      if (updateError) throw updateError

      // Record tournament metrics for approved deposit (principal amount only)
      try {
        await recordDeposit(transaction.user_id, Number(transaction.amount || 0))
      } catch (e) {
        console.warn('Failed to record tournament deposit metric:', e)
      }

      // If there's a bonus, create a separate bonus transaction
      if (bonusAmount > 0) {
        await supabase
          .from('transactions')
          .insert({
            user_id: transaction.user_id,
            type: 'bonus',
            amount: bonusAmount,
            status: 'completed',
            description: `Deposit bonus (${depositBonusPercent}% of ${transaction.amount} ETB) credited to real balance`
          })
      }

      // Send Telegram notification
      if (user?.telegram_id) {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
          if (!botToken) return

          const amountText = escapeMarkdown(Number(transaction.amount || 0).toFixed(2))
          const bonusText = escapeMarkdown(Number(bonusAmount || 0).toFixed(2))
          const totalAdded = Number(transaction.amount || 0) + Number(bonusAmount || 0)
          const totalText = escapeMarkdown(totalAdded.toFixed(2))

          const pdf = await generateReceiptPdfBuffer({
            kind: 'deposit',
            receiptNo: `DEP-${String(transactionId).slice(0, 8).toUpperCase()}`,
            issuedAtIso: new Date().toISOString(),
            username: user?.username || 'Unknown',
            telegramId: user.telegram_id,
            amountEtb: Number(transaction.amount || 0),
            status: 'approved',
            subtitle: bonusAmount > 0 ? 'Deposit approved with bonus and credited to your wallet' : 'Deposit approved and credited to your wallet',
            items: [
              { label: 'Deposit Amount', value: `${Number(transaction.amount || 0).toFixed(2)} ETB` },
              { label: 'Bonus', value: `${Number(bonusAmount || 0).toFixed(2)} ETB` },
              { label: 'Total Credited', value: `${totalAdded.toFixed(2)} ETB` },
              { label: 'Balance Before', value: `${Number(userBefore?.balance ?? 0).toFixed(2)} ETB` },
              { label: 'Balance After', value: `${Number(userAfter?.balance ?? 0).toFixed(2)} ETB` },
              { label: 'Transaction ID', value: String(transactionId) },
            ],
          })

          const replyMarkup = getAppReplyMarkup()

          await sendTelegramMessage({
            botToken,
            chatId: user.telegram_id,
            parseMode: 'Markdown',
            replyMarkup,
            text:
              `*Deposit Approved*\n\n` +
              `Amount: *${amountText} ETB*\n` +
              `Bonus: *${bonusText} ETB*\n` +
              `Total Credited: *${totalText} ETB*\n\n` +
              `A receipt PDF has been attached to this message.`,
          })

          await sendTelegramPdf({
            botToken,
            chatId: user.telegram_id,
            filename: `deposit-receipt-${String(transactionId).slice(0, 8).toLowerCase()}.pdf`,
            pdfBuffer: pdf,
            caption: 'Deposit Receipt (PDF)',
          })
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
            const amountText = escapeMarkdown(transaction.amount.toFixed(2))
            const reasonText = escapeMarkdown(reason)

            const payload: any = {
              chat_id: user.telegram_id,
              text: `❌ *Deposit Rejected*\n\nYour deposit request of *${amountText} ETB* has been rejected.\n\n*Reason:* ${reasonText}\n\nPlease contact support if you have any questions.`,
              parse_mode: 'Markdown'
            }

            const replyMarkup = getAppReplyMarkup()
            if (replyMarkup) payload.reply_markup = replyMarkup

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
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
