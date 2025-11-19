import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: Request) {
  try {
    const { userId, amount, bankName, accountNumber, accountHolder, otpTokenId, otpCode } = await request.json()

    if (!userId || !amount || !bankName || !accountNumber || !accountHolder) {
      return NextResponse.json(
        { error: 'All fields required' },
        { status: 400 }
      )
    }

    // Extract client IP for rate limiting (best-effort)
    const forwarded = request.headers.get('x-forwarded-for') || ''
    const ip = (forwarded.split(',')[0] || '').trim() ||
               request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-real-ip') ||
               ''

    // IP velocity control
    try {
      const maxPerMin = Number((await getConfig('ip_withdraw_max_per_min')) || 5)
      const windowSec = Number((await getConfig('ip_withdraw_window_seconds')) || 60)
      const { data: allowed, error: ipErr } = await supabase.rpc('record_ip_action', {
        p_ip: ip,
        p_action_key: 'withdraw_req',
        p_window_seconds: windowSec,
        p_max_count: maxPerMin
      })
      if (!ipErr && allowed === false) {
        return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
      }
    } catch (e) {
      // Soft-fail rate limiter
      console.warn('IP rate-limit check failed:', (e as any)?.message || e)
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

    // Minimum balance requirement (must keep at least 50 ETB in account)
    const MINIMUM_BALANCE_REQUIRED = 15

    // Optional OTP enforcement
    try {
      const requireOtp = String(await getConfig('require_otp_on_withdrawal')) === 'true'
      if (requireOtp) {
        // If code provided, verify now; else require fresh verified token
        if (otpTokenId && otpCode) {
          const { data: ok } = await supabase.rpc('verify_otp', {
            p_user_id: userId,
            p_token_id: otpTokenId,
            p_code: otpCode
          })
          if (!ok) {
            return NextResponse.json({ error: 'OTP_INVALID' }, { status: 401 })
          }
        } else if (otpTokenId) {
          const { data: fresh } = await supabase.rpc('is_otp_fresh', {
            p_user_id: userId,
            p_token_id: otpTokenId,
            p_purpose: 'withdraw',
            p_max_age_seconds: 600
          })
          if (!fresh) {
            return NextResponse.json({ error: 'OTP_REQUIRED' }, { status: 401 })
          }
        } else {
          return NextResponse.json({ error: 'OTP_REQUIRED' }, { status: 401 })
        }
      }
    } catch (e) {
      console.warn('OTP enforcement check failed:', (e as any)?.message || e)
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

    // Check if withdrawal would leave user with less than minimum balance
    const balanceAfterWithdrawal = user.balance - amount
    if (balanceAfterWithdrawal < MINIMUM_BALANCE_REQUIRED) {
      return NextResponse.json(
        { 
          error: `You must keep at least ${MINIMUM_BALANCE_REQUIRED} ETB in your account`,
          details: {
            totalBalance: user.balance,
            requestedAmount: amount,
            balanceAfterWithdrawal: balanceAfterWithdrawal,
            minimumRequired: MINIMUM_BALANCE_REQUIRED,
            maximumCanWithdraw: user.balance - MINIMUM_BALANCE_REQUIRED
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
