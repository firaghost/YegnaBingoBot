import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user's current streak
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('daily_streak, bonus_balance')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get streak settings
    const { data: streakDaysSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'daily_streak_days')
      .single()

    const { data: streakBonusSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'daily_streak_bonus')
      .single()

    const requiredDays = parseInt(streakDaysSetting?.setting_value || '5')
    const bonusAmount = parseFloat(streakBonusSetting?.setting_value || '5.00')

    // Check if user has completed the streak
    if (user.daily_streak < requiredDays) {
      return NextResponse.json({ 
        error: `Need ${requiredDays - user.daily_streak} more days to claim bonus` 
      }, { status: 400 })
    }

    // Award bonus and reset streak
    const { error: updateError } = await supabase
      .from('users')
      .update({
        bonus_balance: user.bonus_balance + bonusAmount,
        daily_streak: 0
      })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to claim bonus' }, { status: 500 })
    }

    // Create transaction record
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'bonus',
        amount: bonusAmount,
        status: 'completed',
        description: `Daily streak bonus (${requiredDays} days)`
      })

    return NextResponse.json({ 
      success: true, 
      bonusAmount,
      newBalance: user.bonus_balance + bonusAmount
    })
  } catch (error) {
    console.error('Error claiming streak bonus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
