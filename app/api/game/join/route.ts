import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { autofillBotsForGame, assignBotIfNeeded } from '@/server/bot-service'

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

    // Check if there's an active game (player should be queued)
    const { data: runningGame } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle()

    if (runningGame) {
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
            prize_pool: stake,
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

    // If the game was just created, run autofill bots, etc
    if (!activeGame) {
      try {
        const { updatedGame } = await autofillBotsForGame(supabase, actualGame, stake)
        const participants = (updatedGame.players?.length || 0) + (updatedGame.bots?.length || 0)
        if (participants >= 2 && updatedGame.status === 'waiting') {
          await supabase.from('games').update({
            status: 'waiting_for_players',
            countdown_time: 30,
            waiting_started_at: new Date().toISOString()
          }).eq('id', updatedGame.id)
        }
        return NextResponse.json({
          success: true,
          gameId: updatedGame.id,
          game: updatedGame,
          action: 'created'
        })
      } catch (e) {
        console.warn('autofillBotsForGame failed after create:', e)
        return NextResponse.json({
          success: true,
          gameId: actualGame.id,
          game: actualGame,
          action: 'created'
        })
      }
    }

    // Join existing game (or rejoin if already in)
    if (!actualGame.players.includes(userId)) {
      const updatedPlayers = [...actualGame.players, userId];
      const updatedPrizePool = actualGame.prize_pool + stake;
      let newStatus = actualGame.status === 'countdown' ? 'countdown' : 'waiting';

      const { data: updatedGame, error: joinError } = await supabase
        .from('games')
        .update({
          players: updatedPlayers,
          prize_pool: updatedPrizePool,
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

      // Bots logic
      let gameAfterBots = updatedGame;
      try {
        const { updatedGame: withDefaultBots } = await autofillBotsForGame(supabase, updatedGame, stake)
        gameAfterBots = withDefaultBots || updatedGame
        const participantsNow = (gameAfterBots.players?.length || 0) + (gameAfterBots.bots?.length || 0)
        if (participantsNow < 2) {
          const { updatedGame: ensured } = await assignBotIfNeeded(supabase, gameAfterBots, stake)
          gameAfterBots = ensured || gameAfterBots
        }
      } catch (e) {
        console.warn('Bot auto-fill error after join:', e)
      }

      // Waiting period logic
      const participants = (gameAfterBots.players?.length || 0) + (gameAfterBots.bots?.length || 0)
      if (participants >= 2 && (gameAfterBots.status === 'waiting' || gameAfterBots.status === 'waiting_for_players')) {
        const { error: updateError } = await supabase
          .from('games')
          .update({ 
            status: 'waiting_for_players',
            countdown_time: 30,
            waiting_started_at: new Date().toISOString()
          })
          .eq('id', actualGame.id)
        if (!updateError) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_STATIC_URL || 'https://BingoXbot-production.up.railway.app'
            const response = await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                gameId: actualGame.id,
                waitingTime: 30,
                countdownTime: 10
              })
            })
            if (response.ok) {
              const result = await response.json()
              console.log('✅ Waiting period started successfully:', result)
            } else {
              const errorText = await response.text()
              console.error('❌ Waiting period API failed:', response.status, response.statusText, errorText)
            }
          } catch (error) {
            console.error('❌ Error calling waiting period API:', error)
          }
        }
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
        game: finalGameState || gameAfterBots,
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
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_STATIC_URL || 'https://BingoXbot-production.up.railway.app'
        await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            gameId: actualGame.id,
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