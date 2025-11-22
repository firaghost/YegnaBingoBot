import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { createUserSession } from '@/lib/server/user-session'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const telegramData = body?.telegramData

    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ error: 'Missing telegram user data' }, { status: 400 })
    }

    const telegramId = String(telegramData.id)
    const username: string = telegramData.username || `Player_${telegramId}`
    const phone: string | undefined = telegramData.phone_number

    // Look up existing user by telegram_id
    let { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching user in telegram-login:', fetchError)
    }

    if (!existingUser) {
      // Registration bonus from admin config (0 if disabled or missing)
      let registrationBonus = 0
      try {
        const rawBonus = await getConfig('welcome_bonus')
        const parsedBonus = Number(rawBonus)
        registrationBonus = Number.isFinite(parsedBonus) ? parsedBonus : 0
      } catch (e) {
        console.warn('Failed to load welcome_bonus config:', e)
      }

      const insertPayload: any = {
        telegram_id: telegramId,
        username,
        balance: 0,
        bonus_balance: registrationBonus,
        games_played: 0,
        games_won: 0,
        total_winnings: 0,
        referral_code: telegramId,
        daily_streak: 0,
      }
      if (phone) insertPayload.phone = phone

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(insertPayload)
        .select()
        .single()

      if (insertError || !newUser) {
        console.error('Error creating user in telegram-login:', insertError)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }

      existingUser = newUser
    }

    // Create secure cookie-based session
    let res: NextResponse = NextResponse.json({ success: true, data: existingUser } as any)
    res = await createUserSession(res, existingUser.id, req)
    return res
  } catch (err: any) {
    console.error('Error in POST /api/auth/telegram-login:', err)
    return NextResponse.json(
      { error: 'Failed to authenticate Telegram user' },
      { status: 500 },
    )
  }
}
