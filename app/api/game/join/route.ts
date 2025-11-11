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
      
      // Determine status: if 4+ players, start countdown immediately
      let newStatus = 'waiting'
      if (updatedPlayers.length >= 4) {
        newStatus = 'countdown'
      } else if (activeGame.status === 'countdown') {
        newStatus = 'countdown'  // Keep countdown if already started
      }
      
      // Update game with new player
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

      // If we have minimum players (2), wait 15 seconds for more players before starting countdown
      if (updatedPlayers.length === 2) {
        console.log(`⏰ Game ${activeGame.id} has 2 players, waiting 15s for more players...`)
        
        setTimeout(async () => {
          // Check current player count
          const { data: currentGame } = await supabase
            .from('games')
            .select('players, status')
            .eq('id', activeGame.id)
            .single()
          
          // Only start countdown if still waiting and has at least 2 players
          if (currentGame && currentGame.status === 'waiting' && currentGame.players.length >= 2) {
            await supabase
              .from('games')
              .update({ status: 'countdown' })
              .eq('id', activeGame.id)
            
            console.log(`🎮 Game ${activeGame.id} starting countdown with ${currentGame.players.length} players`)
            
            // Notify Socket.IO server to start the game loop
            try {
              const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
              await fetch(`${socketUrl}/trigger-game-start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: activeGame.id })
              }).catch(err => console.error('Failed to trigger game start:', err))
            } catch (error) {
              console.error('Error notifying socket server:', error)
            }
          }
        }, 15000)  // 15 second wait
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
