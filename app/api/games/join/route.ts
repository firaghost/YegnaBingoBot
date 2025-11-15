import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { userId, roomId } = await request.json()

    if (!userId || !roomId) {
      return NextResponse.json(
        { error: 'User ID and Room ID required' },
        { status: 400 }
      )
    }

    // Call the join_game function
    const { data: gameId, error } = await supabase.rpc('join_game', {
      p_user_id: userId,
      p_room_id: roomId
    })

    if (error) throw error

    // Autofill bots to the game if needed
    try {
      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('max_players')
        .eq('id', roomId)
        .single()

      if (room && gameId) {
        // Get current player count
        const { data: players } = await supabaseAdmin
          .from('game_players')
          .select('id')
          .eq('session_id', gameId)
          .eq('status', 'active')

        const currentPlayers = players?.length || 1
        const botsNeeded = room.max_players - currentPlayers

        if (botsNeeded > 0) {
          // Fetch available bots
          const { data: bots } = await supabaseAdmin
            .from('bots')
            .select('id, name')
            .eq('active', true)
            .limit(botsNeeded)

          if (bots && bots.length > 0) {
            // Add each bot to the game
            for (const bot of bots) {
              await supabaseAdmin
                .from('game_players')
                .insert({
                  id: crypto.randomUUID(),
                  session_id: gameId,
                  username: bot.name,
                  socket_id: `bot_${bot.id}`,
                  status: 'active',
                  board: [
                    [1, 2, 3, 4, 5],
                    [16, 17, 18, 19, 20],
                    [31, 32, 0, 34, 35],
                    [46, 47, 48, 49, 50],
                    [61, 62, 63, 64, 65]
                  ],
                  score: 0,
                  is_bot: true,
                  bot_id: bot.id
                })
            }

            // Update game player count and bots array
            const botIds = bots.map((b: any) => b.id)
            await supabaseAdmin
              .from('games')
              .update({ 
                players: currentPlayers + bots.length,
                bots: botIds
              })
              .eq('id', gameId)

            console.log(`🤖 Added ${bots.length} bots to game ${gameId}: ${botIds.join(', ')}`)
          }
        }
      }
    } catch (botError) {
      console.warn('⚠️ Failed to autofill bots:', botError)
      // Don't fail the join if bot autofill fails
    }

    return NextResponse.json({ gameId })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
