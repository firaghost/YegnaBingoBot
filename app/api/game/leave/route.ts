import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { clearGameTimer } from '@/lib/game-timers'

// Use admin client to bypass RLS in production
const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    let gameId, userId
    
    // Handle both JSON and FormData (for sendBeacon)
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const body = await request.json()
      gameId = body.gameId
      userId = body.userId
    } else {
      // Handle FormData from sendBeacon
      const formData = await request.formData()
      gameId = formData.get('gameId') as string
      userId = formData.get('userId') as string
    }

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

    // Only process if game is in a state where players can leave
    if (!['waiting', 'waiting_for_players', 'countdown', 'active'].includes(game.status)) {
      return NextResponse.json({ 
        message: 'Game already finished' 
      })
    }

    console.log(`🚪 Player ${userId} leaving game ${gameId} (status: ${game.status}, players: ${game.players?.length})`)

    // Remove player from game
    const updatedPlayers = game.players.filter((id: string) => id !== userId)
    const remainingPlayers = updatedPlayers.length

    console.log(`👋 Player ${userId} left game ${gameId}. Remaining: ${remainingPlayers}, Status: ${game.status}`)

    // If player leaves during waiting and no players remain, end the game
    if (remainingPlayers === 0) {
      await supabase
        .from('games')
        .update({
          status: 'finished',
          ended_at: new Date().toISOString(),
          players: updatedPlayers
        })
        .eq('id', gameId)

      console.log(`🏁 All players left during ${game.status}, game ended`)
      return NextResponse.json({
        success: true,
        message: 'All players left, game ended'
      })
    }

    // If player leaves during waiting/waiting_for_players and only 1 player remains, reset to waiting
    if (remainingPlayers === 1 && ['waiting', 'waiting_for_players', 'countdown'].includes(game.status)) {
      console.log(`⏪ Game ${gameId} reset to waiting - only 1 player remaining`)
      
      // Clear any active countdown timer since we're back to 1 player
      try {
        clearGameTimer(gameId)
      } catch (error) {
        console.warn('Could not clear game timer:', error)
      }
      
      await supabase
        .from('games')
        .update({
          status: 'waiting',
          players: updatedPlayers,
          prize_pool: game.stake * remainingPlayers,
          countdown_time: 0,
          waiting_started_at: null,
          countdown_started_at: null
        })
        .eq('id', gameId)

      console.log(`⏳ 1 player remains in waiting state, keeping game open`)
      return NextResponse.json({
        success: true,
        message: 'Player left, waiting for more players',
        refunded: false // No refund needed in waiting room
      })
    }

    // If only 1 player remains and game is active/countdown, declare them winner
    if (remainingPlayers === 1 && (game.status === 'active' || game.status === 'countdown')) {
      const winnerId = updatedPlayers[0]
      
      console.log(`🏆 Auto-win: Player ${winnerId} wins by default (opponent left)`)

      // Get commission rate from admin config
      const commissionRateDecimal = await getConfig('game_commission_rate') || 0.1
      const commissionRate = commissionRateDecimal * 100 // Convert to percentage for display
      const commissionAmount = Math.round((game.prize_pool * commissionRate / 100) * 100) / 100
      const netPrize = Math.round((game.prize_pool - commissionAmount) * 100) / 100

      // Update game with winner and commission info
      await supabase
        .from('games')
        .update({
          status: 'finished',
          winner_id: winnerId,
          ended_at: new Date().toISOString(),
          players: updatedPlayers,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_prize: netPrize
        })
        .eq('id', gameId)

      // Add NET winnings to winner (after commission)
      await supabase.rpc('add_balance', {
        user_id: winnerId,
        amount: netPrize
      })

      // Create transaction for winner with commission details
      await supabase.from('transactions').insert({
        user_id: winnerId,
        type: 'win',
        amount: netPrize,
        game_id: gameId,
        status: 'completed',
        metadata: {
          gross_prize: game.prize_pool,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_prize: netPrize,
          auto_win: true
        }
      })

      // Update winner stats with NET winnings
      await supabase.rpc('update_user_stats', {
        user_id: winnerId,
        won: true,
        winnings: netPrize
      })

      console.log(`💰 Auto-win prize: ${netPrize} ETB (after ${commissionRate}% commission)`)

      return NextResponse.json({
        success: true,
        message: 'Player left, remaining player wins',
        winner_id: winnerId,
        auto_win: true,
        prize: netPrize,
        commission_rate: commissionRate
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
