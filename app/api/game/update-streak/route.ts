import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user's last play date and current streak
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('last_play_date, daily_streak')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const lastPlayDate = user.last_play_date

    // If already played today, don't update
    if (lastPlayDate === today) {
      return NextResponse.json({ 
        message: 'Already played today',
        streak: user.daily_streak 
      })
    }

    let newStreak = 1

    if (lastPlayDate) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // If played yesterday, continue streak
      if (lastPlayDate === yesterdayStr) {
        newStreak = (user.daily_streak || 0) + 1
      }
      // Otherwise, streak is broken, reset to 1
    }

    // Update user's streak and last play date
    const { error: updateError } = await supabase
      .from('users')
      .update({
        daily_streak: newStreak,
        last_play_date: today
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating streak:', updateError)
      return NextResponse.json({ error: 'Failed to update streak' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      streak: newStreak,
      message: newStreak > 1 ? `Streak continued! ${newStreak} days` : 'Streak started!'
    })
  } catch (error) {
    console.error('Error updating daily streak:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
