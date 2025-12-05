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
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

      if (stuckGames && stuckGames.length > 0) {
        await supabase.rpc('force_cleanup_user_from_games', { user_uuid: userId })
        console.log(`🧹 Cleaned up user ${userId} from ${stuckGames.length} stuck games`)
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError)
    }

    // Check if there's an active game in this room
    const { data: runningGame } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle()

    if (runningGame) {
      const isPlayerInRunningGame = Array.isArray(runningGame.players) && runningGame.players.includes(userId)
      if (isPlayerInRunningGame) {
        // User is already a player in this active game – treat as rejoin, not spectator
        console.log(`🔁 User ${userId} rejoining active game ${runningGame.id} as player`)
        return NextResponse.json({
          success: true,
          action: 'already_joined_active',
          message: 'Rejoined active game as player.',
          gameId: runningGame.id,
          game: runningGame
        })
      }

      console.log(`🏃 Game is running, user ${userId} sent to spectate live game: ${runningGame.id}`)
      return NextResponse.json({
        success: true,
        action: 'spectate',
        message: 'Game is running; you are spectating this game.',
        gameId: runningGame.id,
        game: runningGame
      })
    }

    // Find active or waiting game for this room
    let { data: activeGame, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'waiting_for_players', 'countdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log(`🎮 Found existing game:`, activeGame ? `${activeGame.id} (status: ${activeGame.status}, players: ${activeGame.players?.length})` : 'None')

    let actualGame = activeGame;
    if (!activeGame) {
      // Try atomic create; handle race and fallback
      try {
        const { data: newGame, error: createError } = await supabase
          .from('games')
          .insert({
            room_id: roomId,
            status: 'waiting',
            countdown_time: 10,
            players: [userId],
            bots: [],
            called_numbers: [],
            stake,
            prize_pool: 0,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError?.code === '23505') {
          // Unique constraint violation/race: fetch latest "waiting"/"countdown" game
          const { data: raceCheckGame } = await supabase
            .from('games')
            .select('*')
            .eq('room_id', roomId)
            .in('status', ['waiting', 'countdown'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          actualGame = raceCheckGame;
          console.log(`⚡ Race: joined existing game ${actualGame?.id}`);
        } else if (createError) {
          return NextResponse.json({ error: 'Failed to create game', details: createError.message }, { status: 500 });
        } else {
          actualGame = newGame;
          console.log(`✅ Created new game: ${actualGame?.id}`);
        }
      } catch (err) {
        console.error('Game join error (DB race)', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    if (!actualGame) {
      return NextResponse.json({ error: 'Game not found after join attempt.' }, { status: 500 });
    }

    // If the game was just created, return it (no bots)
    if (!activeGame) {
      console.log(`✅ Created new game: ${actualGame?.id} (waiting for human players only)`)
      return NextResponse.json({
        success: true,
        gameId: actualGame.id,
        game: actualGame,
        action: 'created'
      })
    }

    // Join existing game (or rejoin if already in)
    if (!actualGame.players.includes(userId)) {
      const updatedPlayers = [...actualGame.players, userId];
      let newStatus = actualGame.status === 'countdown' ? 'countdown' : 'waiting';

      const { data: updatedGame, error: joinError } = await supabase
        .from('games')
        .update({
          players: updatedPlayers,
          status: newStatus
        })
        .eq('id', actualGame.id)
        .select()
        .single();

      if (joinError) {
        console.error('Error joining game:', joinError)
        return NextResponse.json(
          { error: 'Failed to join game', details: joinError.message },
          { status: 500 }
        )
      }

      // Waiting period logic (only human players, no bots)
      // NOTE: Timer logic moved to client-side (game page) to avoid serverless timeout issues
      const participants = updatedGame.players?.length || 0
      if (participants >= 2 && (updatedGame.status === 'waiting' || updatedGame.status === 'waiting_for_players')) {
        await supabase
          .from('games')
          .update({
            status: 'waiting_for_players',
            countdown_time: 30,
            waiting_started_at: new Date().toISOString()
          })
          .eq('id', actualGame.id)
        console.log('✅ Set game to waiting_for_players, client will handle countdown')
      }


      // Refresh
      const { data: finalGameState } = await supabase
        .from('games')
        .select('*')
        .eq('id', actualGame.id)
        .single()

      return NextResponse.json({
        success: true,
        gameId: actualGame.id,
        game: finalGameState || updatedGame,
        action: 'joined'
      })
    }

    // Already in game
    if (actualGame.players.length >= 2 && actualGame.status === 'waiting') {
      await supabase
        .from('games')
        .update({
          status: 'waiting_for_players',
          countdown_time: 30,
          waiting_started_at: new Date().toISOString()
        })
        .eq('id', actualGame.id)
      console.log('✅ Set stuck game to waiting_for_players, client will handle countdown')
    }


    return NextResponse.json({
      success: true,
      gameId: actualGame.id,
      game: actualGame,
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