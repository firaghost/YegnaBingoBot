import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { lookupIp } from '@/lib/geoip'

// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: Request) {
  try {
    const { userId, amount, bankName, accountNumber, accountHolder, otpTokenId, otpCode } = await request.json()

    const notifyAdmin = async (title: string, details: Record<string, any>) => {
      try {
        const enabled = Boolean(await getConfig('suspicious_activity_alerts'))
        if (!enabled) return
        const adminTelegramId = process.env.ADMIN_TELEGRAM_ID
        const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
        if (!adminTelegramId || !botToken) return
        const payload = {
          chat_id: adminTelegramId,
          text: `${title}\n\n${JSON.stringify(details)}`
        }
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        // ignore
      }
    }

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

    // Per-user velocity control (avoid NAT false-positives); skip if IP missing
    try {
      const maxPerMin = Number((await getConfig('ip_withdraw_max_per_min')) || 5)
      const windowSec = Number((await getConfig('ip_withdraw_window_seconds')) || 60)
      if (ip) {
        const actionKey = `withdraw_req:${userId}`
        const { data: allowed, error: ipErr } = await supabase.rpc('record_ip_action', {
          p_ip: ip,
          p_action_key: actionKey,
          p_window_seconds: windowSec,
          p_max_count: maxPerMin
        })
        if (!ipErr && allowed === false) {
          await notifyAdmin('⚠️ Withdraw blocked: rate limit', { userId, ip, amount })
          return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 })
        }
      }
    } catch (e) {
      // Soft-fail rate limiter
      console.warn('IP rate-limit check failed:', (e as any)?.message || e)
    }

    // Best-effort geolocation (city-level, no permission prompt)
    const geo = await lookupIp(ip)

    // Security toggle: restrict jurisdictions by GeoIP
    try {
      const blockRestricted = Boolean(await getConfig('block_restricted_jurisdictions'))
      if (blockRestricted) {
        const country = String(geo?.country || '').trim().toLowerCase()
        const restricted = new Set(['united states', 'us', 'france', 'fr', 'netherlands', 'nl'])
        if (country && restricted.has(country)) {
          await notifyAdmin('⛔ Withdraw blocked: restricted jurisdiction', { userId, ip, amount, country: geo?.country })
          return NextResponse.json(
            { error: 'RESTRICTED_JURISDICTION', message: 'Withdrawals are not available from your region.' },
            { status: 403 }
          )
        }
      }
    } catch (e) {
      console.warn('Restricted jurisdiction check failed:', (e as any)?.message || e)
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

    // Security toggle: strict KYC enforcement (best-effort, only if fields exist)
    try {
      const strictKyc = Boolean(await getConfig('strict_kyc_enforcement'))
      if (strictKyc) {
        const anyUser: any = user
        const kycFieldPresent = 'kyc_verified' in anyUser || 'id_verified' in anyUser || 'is_kyc_verified' in anyUser
        if (kycFieldPresent) {
          const isVerified = Boolean(anyUser.kyc_verified || anyUser.id_verified || anyUser.is_kyc_verified)
          if (!isVerified) {
            await notifyAdmin('⛔ Withdraw blocked: KYC required', { userId, ip, amount })
            return NextResponse.json(
              { error: 'KYC_REQUIRED', message: 'KYC verification is required before withdrawing.' },
              { status: 403 }
            )
          }
        }
      }
    } catch (e) {
      console.warn('Strict KYC check failed:', (e as any)?.message || e)
    }

    // Enforce "deposit gate": users with NO completed deposits cannot withdraw
    try {
      const { data: totalDeposits } = await supabase.rpc('user_total_deposits', { p_user_id: userId })
      const sumDeposits = Number(totalDeposits || 0)
      if (sumDeposits <= 0) {
        // Log location event for visibility and anti-abuse
        try {
          await supabase.from('user_location_events').insert({
            user_id: userId,
            event_key: 'withdraw_blocked',
            ip: ip || null,
            city: geo?.city || null,
            region: geo?.region || null,
            country: geo?.country || null,
            latitude: geo?.latitude || null,
            longitude: geo?.longitude || null,
          })
        } catch {}

        // Notify user via Telegram (no silent balance movement)
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
          if (botToken && user.telegram_id) {
            const msg = '⚠️ Withdrawal Blocked\n\nBonus-based balances cannot be withdrawn before your first real-money deposit. Please make a cash deposit to unlock withdrawals.'
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: user.telegram_id, text: msg })
            })
          }
        } catch (notifyErr) {
          console.warn('Failed to notify user about bonus rule:', (notifyErr as any)?.message || notifyErr)
        }

        await notifyAdmin('⛔ Withdraw blocked: bonus-only user', { userId, ip, amount })

        return NextResponse.json({
          error: 'BONUS_ONLY_BLOCKED',
          message: 'Bonus-based balances cannot be withdrawn before your first real-money deposit. Please make a cash deposit to unlock withdrawals.'
        }, { status: 403 })
      }
    } catch (gateErr) {
      console.warn('Deposit-gate check failed:', (gateErr as any)?.message || gateErr)
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

    // Call create_withdrawal function (DB re-validates deposit gate and limits)
    const { data, error } = await supabase.rpc('create_withdrawal', {
      p_user_id: userId,
      p_amount: amount,
      p_bank_name: bankName,
      p_account_number: accountNumber,
      p_account_holder: accountHolder
    })

    if (error) throw error

    const withdrawalId = data

    // Auto-approve all withdrawals (optional)
    let autoApproved = false
    try {
      const autoApproveAll = Boolean(await getConfig('auto_approve_withdrawals'))
      if (autoApproveAll) {
        const { error: approveErr } = await supabase.rpc('approve_withdrawal', {
          p_withdrawal_id: withdrawalId,
          p_admin_id: '00000000-0000-0000-0000-000000000000',
          p_admin_note: 'Auto-approved (global setting)',
        })
        if (!approveErr) {
          autoApproved = true
        }
      }
    } catch (e) {
      console.warn('Auto-approve withdrawal failed:', (e as any)?.message || e)
    }

    // Auto-approve small withdrawals (optional)
    try {
      const autoApproveSmall = Boolean(await getConfig('auto_approve_small_withdrawals'))
      const threshold = 500
      if (!autoApproved && autoApproveSmall && Number(amount) > 0 && Number(amount) <= threshold) {
        const { error: approveErr } = await supabase.rpc('approve_withdrawal', {
          p_withdrawal_id: withdrawalId,
          p_admin_id: '00000000-0000-0000-0000-000000000000',
          p_admin_note: 'Auto-approved (small withdrawal)',
        })
        if (!approveErr) {
          autoApproved = true
        }
      }
    } catch (e) {
      console.warn('Auto-approve small withdrawal failed:', (e as any)?.message || e)
    }

    // Enrich withdrawal and related transaction with IP and geo
    try {
      await supabase
        .from('withdrawals')
        .update({
          ip: ip || null,
          city: geo?.city || null,
          region: geo?.region || null,
          country: geo?.country || null,
          latitude: geo?.latitude || null,
          longitude: geo?.longitude || null,
        })
        .eq('id', withdrawalId)

      // Update pending withdrawal transaction row
      await supabase
        .from('transactions')
        .update({
          ip: ip || null,
          city: geo?.city || null,
          region: geo?.region || null,
          country: geo?.country || null,
          latitude: geo?.latitude || null,
          longitude: geo?.longitude || null,
        })
        .eq('type', 'withdrawal')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .eq('metadata->>withdrawal_id', withdrawalId)

      // Update user's last seen location
      await supabase
        .from('users')
        .update({
          last_seen_ip: ip || null,
          last_seen_city: geo?.city || null,
          last_seen_region: geo?.region || null,
          last_seen_country: geo?.country || null,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId)

      // Log location event
      await supabase.from('user_location_events').insert({
        user_id: userId,
        event_key: 'withdraw_request',
        ip: ip || null,
        city: geo?.city || null,
        region: geo?.region || null,
        country: geo?.country || null,
        latitude: geo?.latitude || null,
        longitude: geo?.longitude || null,
      })
    } catch (locErr) {
      console.warn('Failed to enrich withdrawal with geo info:', (locErr as any)?.message || locErr)
    }

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
      message: autoApproved ? 'Withdrawal approved automatically' : 'Withdrawal request submitted successfully'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
