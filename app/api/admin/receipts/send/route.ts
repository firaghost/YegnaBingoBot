import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAnyPermission } from '@/lib/server/admin-permissions'
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

export async function POST(request: NextRequest) {
  try {
    await requireAnyPermission(request, ['transactions_view', 'deposits_manage', 'withdrawals_manage'])

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
    if (!botToken) {
      return NextResponse.json({ error: 'BOT_TOKEN / TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const kind = body?.kind as 'deposit' | 'withdrawal'
    const id = String(body?.id || '')

    if (!kind || (kind !== 'deposit' && kind !== 'withdrawal') || !id) {
      return NextResponse.json({ error: 'Missing kind or id' }, { status: 400 })
    }

    const replyMarkup = getAppReplyMarkup()

    if (kind === 'deposit') {
      const { data: tx, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('type', 'deposit')
        .single()

      if (error || !tx) return NextResponse.json({ error: 'Deposit transaction not found' }, { status: 404 })

      const { data: user } = await supabase
        .from('users')
        .select('username, telegram_id, balance')
        .eq('id', tx.user_id)
        .single()

      if (!user?.telegram_id) {
        return NextResponse.json({ error: 'User has no telegram_id' }, { status: 400 })
      }

      const amount = Number(tx.amount || 0)
      const meta = (tx.metadata || {}) as any
      const bonusAmount = Number(meta?.bonus_amount ?? 0)
      const totalCredited = amount + bonusAmount
      const balanceBefore = Number(meta?.real_balance_before ?? 0)
      const balanceAfter = Number(meta?.real_balance_after ?? user?.balance ?? 0)

      const pdf = await generateReceiptPdfBuffer({
        kind: 'deposit',
        receiptNo: `DEP-${String(id).slice(0, 8).toUpperCase()}`,
        issuedAtIso: new Date().toISOString(),
        username: user?.username || 'Unknown',
        telegramId: user.telegram_id,
        amountEtb: amount,
        status: 'approved',
        subtitle: bonusAmount > 0 ? 'Deposit approved with bonus and credited to your wallet' : 'Deposit approved and credited to your wallet',
        items: [
          { label: 'Deposit Amount', value: `${amount.toFixed(2)} ETB` },
          { label: 'Bonus', value: `${bonusAmount.toFixed(2)} ETB` },
          { label: 'Total Credited', value: `${totalCredited.toFixed(2)} ETB` },
          { label: 'Balance Before', value: `${balanceBefore.toFixed(2)} ETB` },
          { label: 'Balance After', value: `${balanceAfter.toFixed(2)} ETB` },
          { label: 'Transaction ID', value: String(id) },
        ],
      })

      const amountText = escapeMarkdown(amount.toFixed(2))
      const bonusText = escapeMarkdown(bonusAmount.toFixed(2))
      const totalText = escapeMarkdown(totalCredited.toFixed(2))

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
        filename: `deposit-receipt-${String(id).slice(0, 8).toLowerCase()}.pdf`,
        pdfBuffer: pdf,
        caption: 'Deposit Receipt (PDF)',
      })

      return NextResponse.json({ success: true })
    }

    // withdrawal
    const { data: wd, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !wd) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })

    const { data: user } = await supabase
      .from('users')
      .select('username, telegram_id')
      .eq('id', wd.user_id)
      .single()

    if (!user?.telegram_id) {
      return NextResponse.json({ error: 'User has no telegram_id' }, { status: 400 })
    }

    const amount = Number(wd.amount || 0)

    const pdf = await generateReceiptPdfBuffer({
      kind: 'withdrawal',
      receiptNo: `WDR-${String(id).slice(0, 8).toUpperCase()}`,
      issuedAtIso: new Date().toISOString(),
      username: user?.username || 'Unknown',
      telegramId: user.telegram_id,
      amountEtb: amount,
      status: 'approved',
      subtitle: 'Withdrawal approved for processing',
      items: [
        { label: 'Withdrawal Amount', value: `${amount.toFixed(2)} ETB` },
        { label: 'Bank', value: String(wd.bank_name || '—') },
        { label: 'Account Number', value: String(wd.account_number || '—') },
        { label: 'Account Holder', value: String(wd.account_holder || '—') },
        { label: 'Request ID', value: String(id) },
      ],
    })

    const amountText = escapeMarkdown(amount.toFixed(2))
    const bankText = escapeMarkdown(String(wd.bank_name || 'N/A'))
    const accountText = escapeMarkdown(String(wd.account_number || 'N/A'))

    await sendTelegramMessage({
      botToken,
      chatId: user.telegram_id,
      parseMode: 'Markdown',
      replyMarkup,
      text:
        `*Withdrawal Approved*\n\n` +
        `Amount: *${amountText} ETB*\n` +
        `Bank: *${bankText}*\n` +
        `Account: *${accountText}*\n\n` +
        `A receipt PDF has been attached to this message.`,
    })

    await sendTelegramPdf({
      botToken,
      chatId: user.telegram_id,
      filename: `withdrawal-receipt-${String(id).slice(0, 8).toLowerCase()}.pdf`,
      pdfBuffer: pdf,
      caption: 'Withdrawal Receipt (PDF)',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin send receipt error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send receipt' },
      { status: 500 }
    )
  }
}
