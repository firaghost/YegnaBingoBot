import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: Request) {
  try {
    const { userId, amount, bankName, accountNumber, accountHolder } = await request.json()

    if (!userId || !amount || !bankName || !accountNumber || !accountHolder) {
      return NextResponse.json(
        { error: 'All fields required' },
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

    // Calculate available balance (balance - pending withdrawal holds)
    const pendingHold = user.pending_withdrawal_hold || 0
    const availableBalance = user.balance - pendingHold

    // Check if user has sufficient available balance
    if (availableBalance < amount) {
      return NextResponse.json(
        { 
          error: 'Insufficient available balance',
          details: {
            totalBalance: user.balance,
            pendingWithdrawalHold: pendingHold,
            availableBalance: availableBalance,
            requestedAmount: amount
          }
        },
        { status: 400 }
      )
    }

    // Call create_withdrawal function
    const { data, error } = await supabase.rpc('create_withdrawal', {
      p_user_id: userId,
      p_amount: amount,
      p_bank_name: bankName,
      p_account_number: accountNumber,
      p_account_holder: accountHolder
    })

    if (error) throw error

    const withdrawalId = data

    // Notify admin via Telegram
    try {
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID
      if (adminTelegramId) {
        const botToken = process.env.BOT_TOKEN
        const message = 
          `💸 *New Withdrawal Request*\n\n` +
          `User: ${user.username}\n` +
          `Telegram ID: ${user.telegram_id}\n` +
          `Amount: ${amount} ETB\n` +
          `Bank: ${bankName}\n` +
          `Account: ${accountNumber}\n` +
          `Holder: ${accountHolder}\n` +
          `Withdrawal ID: ${withdrawalId}\n\n` +
          `Use the buttons below to approve or reject this withdrawal.`

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminTelegramId,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Approve', callback_data: `approve_withdraw_${withdrawalId}` },
                { text: '❌ Reject', callback_data: `reject_withdraw_${withdrawalId}` }
              ]]
            }
          })
        })
      }
    } catch (notifyError) {
      console.error('Error notifying admin:', notifyError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ 
      success: true,
      withdrawalId: withdrawalId,
      message: 'Withdrawal request submitted successfully'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
