import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
// Use admin client to bypass RLS
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString()
    console.log(`🎮 ===== GAME JOIN API CALLED [${timestamp}] =====`)
    const { roomId, userId } = await request.json()
    console.log(`🎯 Join request: Room=${roomId}, User=${userId} at ${timestamp}`)

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

    // Only cleanup truly stuck games (older than 10 minutes)
    try {
      const { data: stuckGames } = await supabase
        .from('games')
        .select('id')
        .contains('players', [userId])
        .in('status', ['waiting', 'waiting_for_players', 'countdown'])
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // 10 minutes ago
      
      if (stuckGames && stuckGames.length > 0) {
        await supabase.rpc('force_cleanup_user_from_games', { user_uuid: userId })
        console.log(`🧹 Cleaned up user ${userId} from ${stuckGames.length} stuck games`)
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError)
      // Continue even if cleanup fails
    }


    // Find active or waiting game for this room
    console.log(`🔍 Looking for existing games in room: ${roomId}`)
    
    let { data: activeGame, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'countdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log(`🎮 Found existing game:`, activeGame ? `${activeGame.id} (status: ${activeGame.status}, players: ${activeGame.players?.length})` : 'None')

    // Check if there's an active game (player should be queued)
    const { data: runningGame } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle()

    if (runningGame) {
      console.log(`🏃 Game is running, queueing player: ${runningGame.id}`)
      return NextResponse.json({
        status: 'queued',
        message: 'Game is running, you are in queue',
        gameId: runningGame.id
      })
    }

    if (!activeGame) {
      console.log(`🆕 No existing game found, creating new game for room: ${roomId}`)
      
      // Double-check for race condition - another player might have just created a game
      const { data: raceCheckGame } = await supabase
        .from('games')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['waiting', 'countdown'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (raceCheckGame) {
        console.log(`🏃 Race condition detected! Found game: ${raceCheckGame.id}, joining instead of creating`)
        activeGame = raceCheckGame
      } else {
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

        console.log(`✅ Created new game: ${newGame.id}`)
        return NextResponse.json({
          success: true,
          gameId: newGame.id,
          game: newGame,
          action: 'created'
        })
      }
    }

    // Join existing game (or rejoin if already in)
    console.log(`👥 Joining existing game: ${activeGame.id}, current players: ${activeGame.players?.length}`)
    
    if (!activeGame.players.includes(userId)) {
      console.log(`➕ Adding new player ${userId} to game ${activeGame.id}`)
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

      // If we have 2+ players and game is still in waiting status, start 30-second waiting period
      if (updatedPlayers.length >= 2 && (newStatus === 'waiting' || activeGame.status === 'waiting')) {
        console.log(`⏳ Game ${activeGame.id} has ${updatedPlayers.length} players, starting 30-second waiting period...`)
        
        // Update status to waiting_for_players with 30-second timer
        const { error: updateError } = await supabase
          .from('games')
          .update({ 
            status: 'waiting_for_players',
            countdown_time: 30,  // 30 seconds to wait for more players
            waiting_started_at: new Date().toISOString()
          })
          .eq('id', activeGame.id)
        
        if (updateError) {
          console.error('❌ Failed to update game status to waiting_for_players:', updateError)
        } else {
          console.log('✅ Game status updated to waiting_for_players')
        }
        
        // Notify API to start the waiting period
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_STATIC_URL || 'https://yegnabingobot-production.up.railway.app'
          console.log(`🔔 Calling waiting period API: ${baseUrl}/api/socket/start-waiting-period`)
          
          const response = await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              gameId: activeGame.id,
              waitingTime: 30,
              countdownTime: 10
            })
          })
          
          if (!response.ok) {
            console.error('❌ Waiting period API failed:', response.status, response.statusText)
            const errorText = await response.text()
            console.error('❌ Error details:', errorText)
          } else {
            const result = await response.json()
            console.log('✅ Waiting period started successfully:', result)
          }
        } catch (error) {
          console.error('❌ Error calling waiting period API:', error)
        }
      }

      // Get the latest game state after all updates
      const { data: finalGameState } = await supabase
        .from('games')
        .select('*')
        .eq('id', activeGame.id)
        .single()

      return NextResponse.json({
        success: true,
        gameId: activeGame.id,
        game: finalGameState || updatedGame,
        action: 'joined'
      })
    }

    // Player already in game
    console.log(`🔄 Player ${userId} already in game ${activeGame.id}, rejoining`)
    
    // Check if game is stuck in waiting with 2+ players
    if (activeGame.players.length >= 2 && activeGame.status === 'waiting') {
      console.log(`⚠️ Game ${activeGame.id} stuck in waiting with ${activeGame.players.length} players, starting waiting period...`)
      
      // Update status to waiting_for_players
      await supabase
        .from('games')
        .update({ 
          status: 'waiting_for_players',
          countdown_time: 30,
          waiting_started_at: new Date().toISOString()
        })
        .eq('id', activeGame.id)
      
      // Start the waiting period
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_STATIC_URL || 'https://yegnabingobot-production.up.railway.app'
        await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            gameId: activeGame.id,
            waitingTime: 30,
            countdownTime: 10
          })
        })
        console.log('✅ Started waiting period for stuck game')
      } catch (error) {
        console.error('❌ Error starting waiting period for stuck game:', error)
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
