import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

export async function GET(request: Request) {
  try {
    const enabled = Boolean(await getConfig('global_leaderboard'))
    if (!enabled) {
      return NextResponse.json(
        { error: 'Leaderboard disabled' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const period = searchParams.get('period') || 'weekly'
    const userId = searchParams.get('userId')

    if (!['weekly', 'monthly'].includes(period)) {
      return NextResponse.json(
        { error: 'Period must be weekly or monthly' },
        { status: 400 }
      )
    }

    // Get leaderboard data
    const { data: leaderboard, error } = await supabaseAdmin
      .from('current_leaderboard')
      .select('*')
      .eq('period', period)
      .order('xp', { ascending: false })
      .limit(limit)

    if (error) throw error

    let userPosition = null
    if (userId) {
      // Get user's position in the leaderboard
      const { data: userPos } = await supabaseAdmin
        .from('current_leaderboard')
        .select('rank, wins, xp, username, level_progress')
        .eq('period', period)
        .eq('telegram_id', userId.toString())
        .maybeSingle()

      userPosition = userPos
    }

    // Get total participants
    const { count: totalParticipants } = await supabaseAdmin
      .from('current_leaderboard')
      .select('*', { count: 'exact', head: true })
      .eq('period', period)
      .gt('xp', 0)

    return NextResponse.json({ 
      leaderboard,
      userPosition,
      totalParticipants: totalParticipants || 0,
      period
    })
  } catch (error: any) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// POST endpoint for admin operations
export async function POST(request: Request) {
  try {
    const enabled = Boolean(await getConfig('global_leaderboard'))
    if (!enabled) {
      return NextResponse.json(
        { error: 'Leaderboard disabled' },
        { status: 404 }
      )
    }

    const { action, period, adminKey } = await request.json()

    // Simple admin key check (implement proper auth in production)
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (action === 'reset' && period) {
      if (!['weekly', 'monthly'].includes(period)) {
        return NextResponse.json(
          { error: 'Period must be weekly or monthly' },
          { status: 400 }
        )
      }

      // Reset leaderboard
      const { error } = await supabaseAdmin.rpc('reset_leaderboard', {
        p_period: period
      })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        message: `${period} leaderboard reset successfully` 
      })
    }

    if (action === 'recalculate' && period) {
      // Recalculate ranks
      const { error } = await supabaseAdmin.rpc('calculate_leaderboard_ranks', {
        p_period: period
      })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        message: `${period} leaderboard ranks recalculated` 
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Leaderboard admin API error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
