import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      // Clean up all old games
      const { data, error } = await supabase.rpc('cleanup_disconnected_players')
      
      if (error) {
        console.error('Error cleaning up games:', error)
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${data} old games`
      })
    } else {
      // Clean up specific user from games
      const { data, error } = await supabase.rpc('force_cleanup_user_from_games', {
        user_uuid: userId
      })
      
      if (error) {
        console.error('Error cleaning up user:', error)
        return NextResponse.json({ error: 'User cleanup failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Removed user from ${data} games`
      })
    }
  } catch (error) {
    console.error('Error in cleanup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check current games
export async function GET() {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, status, players, created_at, room_id')
      .in('status', ['waiting', 'countdown'])
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const gamesWithPlayerCount = games?.map(game => ({
      ...game,
      player_count: game.players?.length || 0,
      age_minutes: Math.floor((Date.now() - new Date(game.created_at).getTime()) / (1000 * 60))
    }))

    return NextResponse.json({
      games: gamesWithPlayerCount,
      total: games?.length || 0
    })
  } catch (error) {
    console.error('Error fetching games:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
