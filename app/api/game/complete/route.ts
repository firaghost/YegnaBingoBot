import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { handleGameCompletion } from '@/lib/level-handlers'

export async function POST(request: NextRequest) {
  try {
    const { userId, result, levelName, gameId } = await request.json()

    if (!userId || !result || !levelName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, result, levelName' },
        { status: 400 }
      )
    }

    if (!['win', 'lose'].includes(result)) {
      return NextResponse.json(
        { error: 'Result must be either "win" or "lose"' },
        { status: 400 }
      )
    }

    if (!['easy', 'medium', 'hard'].includes(levelName)) {
      return NextResponse.json(
        { error: 'Level must be easy, medium, or hard' },
        { status: 400 }
      )
    }

    // Get user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get level settings
    const { data: level, error: levelError } = await supabaseAdmin
      .from('levels')
      .select('*')
      .eq('name', levelName)
      .single()

    if (levelError || !level) {
      return NextResponse.json(
        { error: 'Level not found' },
        { status: 404 }
      )
    }

    let responseData: any = {
      success: true,
      result,
      level: levelName,
      user: {
        username: user.username,
        previousXP: user.xp,
        previousWins: user.total_wins
      }
    }

    if (result === 'win') {
      // Update player stats with XP
      const { error: statsError } = await supabaseAdmin.rpc('update_player_stats', {
        p_user_id: user.id,
        p_xp: level.xp_reward
      })

      if (statsError) {
        console.error('Error updating player stats:', statsError)
        return NextResponse.json(
          { error: 'Failed to update player stats' },
          { status: 500 }
        )
      }

      // Recalculate leaderboard ranks
      await Promise.all([
        supabaseAdmin.rpc('calculate_leaderboard_ranks', { p_period: 'weekly' }),
        supabaseAdmin.rpc('calculate_leaderboard_ranks', { p_period: 'monthly' })
      ])

      // Get updated user data
      const { data: updatedUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      // Check for rank progression
      const oldRank = user.level_progress
      const newRank = updatedUser?.level_progress || oldRank
      const rankUp = oldRank !== newRank

      responseData = {
        ...responseData,
        xpGained: level.xp_reward,
        newXP: updatedUser?.xp || user.xp,
        newWins: updatedUser?.total_wins || user.total_wins,
        rankUp,
        oldRank,
        newRank,
        message: `🎉 You won on ${levelName.toUpperCase()} level! +${level.xp_reward} XP${rankUp ? ` 🎊 RANK UP: ${newRank}!` : ''}`
      }

      // Get current leaderboard positions
      const { data: weeklyPos } = await supabaseAdmin
        .from('current_leaderboard')
        .select('rank')
        .eq('period', 'weekly')
        .eq('telegram_id', userId.toString())
        .maybeSingle()

      const { data: monthlyPos } = await supabaseAdmin
        .from('current_leaderboard')
        .select('rank')
        .eq('period', 'monthly')
        .eq('telegram_id', userId.toString())
        .maybeSingle()

      responseData.leaderboard = {
        weekly: weeklyPos?.rank || null,
        monthly: monthlyPos?.rank || null
      }

    } else {
      // Handle loss - just update games played
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ 
          games_played: user.games_played + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating user games played:', updateError)
      }

      responseData.message = `😔 You lost on ${levelName} level. Try again!`
    }

    // Update game record if gameId provided
    if (gameId) {
      await supabaseAdmin
        .from('games')
        .update({
          status: 'finished',
          winner_id: result === 'win' ? user.id : null,
          ended_at: new Date().toISOString(),
          level_name: levelName
        })
        .eq('id', gameId)
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error in game completion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve level settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const levelName = searchParams.get('level')

    if (levelName) {
      // Get specific level
      const { data: level, error } = await supabaseAdmin
        .from('levels')
        .select('*')
        .eq('name', levelName)
        .single()

      if (error || !level) {
        return NextResponse.json(
          { error: 'Level not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ level })
    } else {
      // Get all levels
      const { data: levels, error } = await supabaseAdmin
        .from('levels')
        .select('*')
        .order('xp_reward', { ascending: true })

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch levels' },
          { status: 500 }
        )
      }

      return NextResponse.json({ levels })
    }
  } catch (error) {
    console.error('Error fetching levels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
