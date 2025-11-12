import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { roomId, userId } = await request.json()

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: roomId, userId' },
        { status: 400 }
      )
    }

    // Get room data to use correct stake and settings
    console.log('🔍 Looking for room with ID:', roomId)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      console.error('❌ Room not found:', roomId, roomError)
      return NextResponse.json(
        { error: `Room '${roomId}' not found`, details: roomError?.message },
        { status: 404 }
      )
    }

    console.log('✅ Found room:', room.name, 'Stake:', room.stake)

    const stake = room.stake

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
        message: 'Game is running, you are in queue',
        gameId: runningGame.id
      })
    }

    if (!activeGame) {
      // Create new game with waiting status using room settings
      const { data: newGame, error: createError } = await supabase
        .from('games')
        .insert({
          room_id: roomId,
          status: 'waiting',
          countdown_time: 10,
          players: [userId], // userId should be UUID string
          bots: [],
          called_numbers: [],
          stake: room.stake,
          prize_pool: room.stake,
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating game:', createError)
        return NextResponse.json(
          { error: 'Failed to create game', details: createError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        gameId: newGame.id,
        game: newGame,
        action: 'created'
      })
    }

    // Join existing game
    if (!activeGame.players.includes(userId)) {
      const updatedPlayers = [...activeGame.players, userId]
      const updatedPrizePool = activeGame.prize_pool + stake
      
      let newStatus = activeGame.status
      if (activeGame.status === 'countdown') {
        newStatus = 'countdown'  // Keep countdown if already started
      } else {
        newStatus = 'waiting'  // Stay waiting
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
        return NextResponse.json(
          { error: 'Failed to join game', details: joinError.message },
          { status: 500 }
        )
      }

      console.log(`✅ Player ${userId} joined game ${activeGame.id}. Status: ${newStatus}, Players: ${updatedPlayers.length}`)

      // If we have 2+ players, start 15-second waiting period for more players
      if (updatedPlayers.length >= 2 && newStatus === 'waiting') {
        console.log(`⏳ Game ${activeGame.id} has ${updatedPlayers.length} players, starting 15-second waiting period...`)
        
        // Update status to countdown with 15-second waiting timer
        await supabase
          .from('games')
          .update({ 
            status: 'countdown',
            countdown_time: 15  // 15 seconds to wait for more players
          })
          .eq('id', activeGame.id)
        
        // Notify Socket.IO server to start the waiting period
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

      return NextResponse.json({
        success: true,
        gameId: activeGame.id,
        game: updatedGame,
        action: 'joined'
      })
    }

    // Player already in game
    // Check if game is stuck in waiting with 2+ players
    if (activeGame.players.length >= 2 && activeGame.status === 'waiting') {
      console.log(`⚠️ Game ${activeGame.id} stuck in waiting with ${activeGame.players.length} players, starting waiting period...`)
      
      await supabase
        .from('games')
        .update({ 
          status: 'countdown',
          countdown_time: 15  // 15 seconds waiting period
        })
        .eq('id', activeGame.id)
      
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
    
    return NextResponse.json({
      success: true,
      gameId: activeGame.id,
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
