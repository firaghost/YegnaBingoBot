import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(request: Request) {
  try {
    const { userId, purpose } = await request.json()
    if (!userId || !purpose) {
      return NextResponse.json({ error: 'userId and purpose are required' }, { status: 400 })
    }

    // Fetch user to get telegram_id
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id,username,telegram_id')
      .eq('id', userId)
      .single()

    if (uErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate OTP via RPC
    const { data: genRows, error: genErr } = await supabase.rpc('generate_otp', {
      p_user_id: userId,
      p_purpose: purpose,
      p_ttl_seconds: 600,
      p_max_attempts: 5,
    })

    if (genErr || !genRows || !Array.isArray(genRows) || !genRows[0]) {
      throw new Error(genErr?.message || 'Failed to generate OTP')
    }

    const { token_id, code, expires_at } = genRows[0]

    // Send the OTP via Telegram DM (free)
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
      if (botToken && user.telegram_id) {
        const msg = `🔐 Verification Code\n\nYour OTP: *${code}*\nPurpose: ${purpose}\nExpires in 10 minutes.`
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.telegram_id,
            text: msg,
            parse_mode: 'Markdown'
          })
        })
      }
    } catch (sendErr) {
      // Non-fatal; client can still read tokenId and ask user to check DM
      console.warn('Failed to send OTP via Telegram:', (sendErr as any)?.message || sendErr)
    }

    return NextResponse.json({ tokenId: token_id, expiresAt: expires_at })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to request OTP' }, { status: 500 })
  }
}
