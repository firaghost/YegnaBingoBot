import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId, stake } = await request.json()

    if (!roomId || !userId || stake === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Find active or waiting game for this room
    let { data: activeGame } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'countdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Check if there's an active game (player should be queued)
    const { data: runningGame } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle()

    if (runningGame) {
      return NextResponse.json({
        status: 'queued',
        message: 'Game is running, you are in queue'
      })
    }

    if (!activeGame) {
      // Create new game with waiting status
      const { data: newGame, error: createError } = await supabase
        .from('games')
        .insert({
          room_id: roomId,
          status: 'waiting',
          countdown_time: 10,
          players: [userId],
          bots: [],
          called_numbers: [],
          stake: stake,
          prize_pool: stake,
          min_players: 2,
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating game:', createError)
        throw createError
      }

      return NextResponse.json({
        success: true,
        game: newGame,
        action: 'created'
      })
    }

    // Join existing game
    if (!activeGame.players.includes(userId)) {
      const updatedPlayers = [...activeGame.players, userId]
      const updatedPrizePool = activeGame.prize_pool + stake
      
      // If we now have enough players, start countdown
      const newStatus = updatedPlayers.length >= 2 ? 'countdown' : 'waiting'
      
      const { data: updatedGame, error: joinError } = await supabase
        .from('games')
        .update({
          players: updatedPlayers,
          prize_pool: updatedPrizePool,
          status: newStatus
        })
        .eq('id', activeGame.id)
        .select()
        .single()

      if (joinError) {
        console.error('Error joining game:', joinError)
        throw joinError
      }

      console.log(`✅ Player ${userId} joined game ${activeGame.id}. Status: ${newStatus}, Players: ${updatedPlayers.length}`)

      // Client-side ticker (useGameTicker) will automatically handle countdown progression
      if (newStatus === 'countdown') {
        console.log(`🎮 Game ${activeGame.id} entering countdown - client ticker will handle progression`)
      }

      return NextResponse.json({
        success: true,
        game: updatedGame,
        action: 'joined'
      })
    }

    // Player already in game
    return NextResponse.json({
      success: true,
      game: activeGame,
      action: 'already_joined'
    })

  } catch (error: any) {
    console.error('Error in game join:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
