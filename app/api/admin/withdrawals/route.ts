import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAnyPermission, requirePermission } from '@/lib/server/admin-permissions'
import { getClientIp, rateLimit } from '@/lib/server/rate-limit'
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
      inline_keyboard: [[{ text: 'View Wallet', web_app: { url: APP_URL } }]]
    }
  }
  return undefined
}

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

    // Basic rate limiting for withdrawal approval/rejection actions
    const ip = getClientIp(request)
    const rl = await rateLimit(`admin-withdrawals:${ip}`, 60, 10 * 60 * 1000) // 60 actions / 10 minutes per IP
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many withdrawal actions. Please slow down and try again shortly.' },
        { status: 429 }
      )
    }
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
          const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
          if (botToken) {
            const amountText = escapeMarkdown(Number(withdrawal.amount).toFixed(2))
            const bankText = escapeMarkdown(withdrawal.bank_name || 'N/A')
            const accountText = escapeMarkdown(withdrawal.account_number || 'N/A')
            const noteText = adminNote ? `\n\n*Admin Note:* ${escapeMarkdown(adminNote)}` : ''

            const pdf = await generateReceiptPdfBuffer({
              kind: 'withdrawal',
              receiptNo: `WDR-${String(withdrawalId).slice(0, 8).toUpperCase()}`,
              issuedAtIso: new Date().toISOString(),
              username: withdrawal?.users?.username || 'Unknown',
              telegramId: withdrawal?.users?.telegram_id,
              amountEtb: Number(withdrawal.amount || 0),
              status: 'approved',
              subtitle: 'Withdrawal approved for processing',
              items: [
                { label: 'Withdrawal Amount', value: `${Number(withdrawal.amount || 0).toFixed(2)} ETB` },
                { label: 'Bank', value: String(withdrawal.bank_name || '—') },
                { label: 'Account Number', value: String(withdrawal.account_number || '—') },
                { label: 'Account Holder', value: String(withdrawal.account_holder || '—') },
                { label: 'Request ID', value: String(withdrawalId) },
              ],
            })

            const replyMarkup = getAppReplyMarkup()

            await sendTelegramMessage({
              botToken,
              chatId: withdrawal.users.telegram_id,
              parseMode: 'Markdown',
              replyMarkup,
              text:
                `*Withdrawal Approved*\n\n` +
                `Amount: *${amountText} ETB*\n` +
                `Bank: *${bankText}*\n` +
                `Account: *${accountText}*` +
                noteText +
                `\n\nA receipt PDF has been attached to this message.`,
            })

            await sendTelegramPdf({
              botToken,
              chatId: withdrawal.users.telegram_id,
              filename: `withdrawal-receipt-${String(withdrawalId).slice(0, 8).toLowerCase()}.pdf`,
              pdfBuffer: pdf,
              caption: 'Withdrawal Receipt (PDF)',
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
          const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
          if (botToken) {
            const amountText = escapeMarkdown(Number(withdrawal.amount).toFixed(2))
            const reasonText = adminNote
              ? `*Reason:* ${escapeMarkdown(adminNote)}`
              : 'Please contact support for more information.'

            const payload: any = {
              chat_id: withdrawal.users.telegram_id,
              text:
                `❌ *Withdrawal Rejected*\n\n` +
                `Your withdrawal request of *${amountText} ETB* has been rejected.\n\n` +
                `Your balance has been refunded to your account.\n\n${reasonText}`,
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
