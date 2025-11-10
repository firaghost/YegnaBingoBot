import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { gameId, userId } = await request.json()

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get game data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Only process if game is active or in countdown
    if (!['waiting', 'countdown', 'active'].includes(game.status)) {
      return NextResponse.json({ 
        message: 'Game already finished' 
      })
    }

    // Remove player from game
    const updatedPlayers = game.players.filter((id: string) => id !== userId)
    const remainingPlayers = updatedPlayers.length

    console.log(`👋 Player ${userId} left game ${gameId}. Remaining: ${remainingPlayers}`)

    // If only 1 player remains and game is active/countdown, declare them winner
    if (remainingPlayers === 1 && (game.status === 'active' || game.status === 'countdown')) {
      const winnerId = updatedPlayers[0]
      
      console.log(`🏆 Auto-win: Player ${winnerId} wins by default (opponent left)`)

      // Update game with winner
      await supabase
        .from('games')
        .update({
          status: 'finished',
          winner_id: winnerId,
          ended_at: new Date().toISOString(),
          players: updatedPlayers
        })
        .eq('id', gameId)

      // Add winnings to winner
      await supabase.rpc('add_balance', {
        user_id: winnerId,
        amount: game.prize_pool
      })

      // Create transaction for winner
      await supabase.from('transactions').insert({
        user_id: winnerId,
        type: 'win',
        amount: game.prize_pool,
        game_id: gameId,
        status: 'completed'
      })

      // Update winner stats
      await supabase.rpc('update_user_stats', {
        user_id: winnerId,
        won: true,
        winnings: game.prize_pool
      })

      return NextResponse.json({
        success: true,
        message: 'Player left, remaining player wins',
        winner_id: winnerId,
        auto_win: true
      })
    }

    // If no players remain or game is waiting, just end the game
    if (remainingPlayers === 0) {
      await supabase
        .from('games')
        .update({
          status: 'finished',
          ended_at: new Date().toISOString(),
          players: updatedPlayers
        })
        .eq('id', gameId)

      return NextResponse.json({
        success: true,
        message: 'All players left, game ended'
      })
    }

    // Otherwise just update player list
    await supabase
      .from('games')
      .update({
        players: updatedPlayers,
        prize_pool: game.stake * remainingPlayers
      })
      .eq('id', gameId)

    return NextResponse.json({
      success: true,
      message: 'Player left game'
    })
  } catch (error) {
    console.error('Error handling player leave:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
