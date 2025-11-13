import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const gameId = url.searchParams.get('gameId')

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId parameter' }, { status: 400 })
    }

    // Get current game state
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (error || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    return NextResponse.json({
      game: {
        id: game.id,
        status: game.status,
        countdown_time: game.countdown_time,
        players: game.players,
        player_count: game.players?.length || 0,
        created_at: game.created_at,
        waiting_started_at: game.waiting_started_at,
        countdown_started_at: game.countdown_started_at,
        started_at: game.started_at
      },
      timestamps: {
        now: new Date().toISOString(),
        created_age_seconds: Math.floor((Date.now() - new Date(game.created_at).getTime()) / 1000),
        waiting_age_seconds: game.waiting_started_at ? 
          Math.floor((Date.now() - new Date(game.waiting_started_at).getTime()) / 1000) : null,
        countdown_age_seconds: game.countdown_started_at ? 
          Math.floor((Date.now() - new Date(game.countdown_started_at).getTime()) / 1000) : null
      }
    })

  } catch (error) {
    console.error('Error debugging game:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, gameId } = await request.json()

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
    }

    if (action === 'force_waiting_period') {
      // Force start waiting period
      const { error: updateError } = await supabase
        .from('games')
        .update({ 
          status: 'waiting_for_players',
          countdown_time: 5, // Short test time
          waiting_started_at: new Date().toISOString()
        })
        .eq('id', gameId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Start the waiting period
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameId: gameId,
          waitingTime: 5,
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
    console.error('Error in debug game:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
