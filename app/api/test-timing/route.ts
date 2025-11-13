import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function GET() {
  try {
    // Check current games and their status
    const { data: games, error } = await supabase
      .from('games')
      .select('id, status, countdown_time, players, created_at, waiting_started_at, countdown_started_at')
      .in('status', ['waiting', 'waiting_for_players', 'countdown'])
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const gameDetails = games?.map(game => ({
      ...game,
      player_count: game.players?.length || 0,
      age_minutes: Math.floor((Date.now() - new Date(game.created_at).getTime()) / (1000 * 60)),
      waiting_age: game.waiting_started_at ? 
        Math.floor((Date.now() - new Date(game.waiting_started_at).getTime()) / 1000) : null,
      countdown_age: game.countdown_started_at ? 
        Math.floor((Date.now() - new Date(game.countdown_started_at).getTime()) / 1000) : null
    }))

    return NextResponse.json({
      message: 'Current game timing status',
      games: gameDetails,
      total: games?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking game timing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, gameId } = await request.json()

    if (action === 'force_start_waiting') {
      // Force start waiting period for a specific game
      if (!gameId) {
        return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameId: gameId,
          waitingTime: 5, // Short test time
          countdownTime: 3
        })
      })

      const result = await response.json()
      return NextResponse.json({
        message: 'Forced waiting period start',
        result,
        gameId
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error in test timing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
