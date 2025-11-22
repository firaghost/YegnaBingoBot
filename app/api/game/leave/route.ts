import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { clearGameTimer } from '@/lib/game-timers'
import { recordPlay } from '@/lib/server/tournament-service'

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
      // Stop number calling and force-sync cache on the socket server
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
        await fetch(`${baseUrl}/api/game/stop-calling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
        await fetch(`${baseUrl}/api/cache/force-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
      } catch (e) {
        console.warn('Failed to stop number calling after all left:', e)
      }
      return NextResponse.json({
        success: true,
        message: 'All players left, game ended'
      })
    }

    // If player leaves during waiting/waiting_for_players and only 1 player remains, END the game (don't keep it open)
    if (remainingPlayers === 1 && ['waiting', 'waiting_for_players', 'countdown'].includes(game.status)) {
      console.log(`🏁 Game ${gameId} ending - only 1 player remaining in waiting room`)
      
      // Clear any active countdown timer
      try {
        clearGameTimer(gameId)
      } catch (error) {
        console.warn('Could not clear game timer:', error)
      }
      
      // End the game instead of keeping it open
      await supabase
        .from('games')
        .update({
          status: 'finished',
          ended_at: new Date().toISOString(),
          players: updatedPlayers
        })
        .eq('id', gameId)

      console.log(`🏁 Game ended - single player cannot continue in waiting room`)
      
      // Stop number calling and force-sync cache
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
        await fetch(`${baseUrl}/api/game/stop-calling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
        await fetch(`${baseUrl}/api/cache/force-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
      } catch (e) {
        console.warn('Failed to stop number calling after single player left:', e)
      }

      return NextResponse.json({
        success: true,
        message: 'Game ended - insufficient players',
        refunded: false
      })
    }

    // If only 1 player remains and game is active/countdown, declare them winner
    if (remainingPlayers === 1 && (game.status === 'active' || game.status === 'countdown')) {
      const winnerId = updatedPlayers[0]
      
      console.log(`🏆 Auto-win: Player ${winnerId} wins by default (opponent left)`)

      // Get commission rate from admin config
      const commissionRateDecimal = await getConfig('game_commission_rate') || 0.1
      const commissionRate = commissionRateDecimal * 100 // Convert to percentage for display

      // Compute TOTAL prize pool (real + bonus) from stake transactions
      let realPrizePool = 0
      let bonusPrizePool = 0
      try {
        const { data: realPoolData, error: realErr } = await supabase.rpc('compute_real_prize_pool', { p_game_id: gameId })
        if (!realErr && typeof realPoolData === 'number') realPrizePool = realPoolData
      } catch (e) {
        realPrizePool = 0
      }

      try {
        const { data: bonusPoolData, error: bonusErr } = await supabase.rpc('compute_bonus_prize_pool', { p_game_id: gameId })
        if (!bonusErr && typeof bonusPoolData === 'number') bonusPrizePool = bonusPoolData
      } catch (e) {
        bonusPrizePool = 0
      }

      let totalPrizePool = realPrizePool + bonusPrizePool

      // Fallback: if RPCs not available, use existing game.prize_pool
      if (!totalPrizePool && game.prize_pool) {
        totalPrizePool = game.prize_pool
      }

      const commissionAmount = Math.round((totalPrizePool * commissionRate / 100) * 100) / 100
      const netPrize = Math.round((totalPrizePool - commissionAmount) * 100) / 100

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
          net_prize: netPrize,
          prize_pool: totalPrizePool
        })
        .eq('id', gameId)

      // Credit NET winnings to correct wallet based on stake breakdown
      try {
        await supabase.rpc('credit_win', {
          p_user_id: winnerId,
          p_game_id: gameId,
          p_amount: netPrize
        })
      } catch (e) {
        console.error('Error crediting auto-win via credit_win:', e)
      }

      // Update winner stats with NET winnings
      await supabase.rpc('update_user_stats', {
        user_id: winnerId,
        won: true,
        winnings: netPrize
      })

      // Record tournament plays for winner and the player who left
      try {
        await recordPlay(winnerId, gameId, null)
        if (userId && userId !== winnerId) {
          await recordPlay(userId, gameId, null)
        }
      } catch (e) {
        console.error('Error recording tournament plays on auto-win:', e)
      }

      console.log(`💰 Auto-win prize: ${netPrize} ETB (after ${commissionRate}% commission, Total Pool: ${totalPrizePool} ETB)`)

      // Stop number calling and force-sync cache
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
        await fetch(`${baseUrl}/api/game/stop-calling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
        await fetch(`${baseUrl}/api/cache/force-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
      } catch (e) {
        console.warn('Failed to stop number calling after auto-win:', e)
      }

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

      // Stop number calling and force-sync cache
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
        await fetch(`${baseUrl}/api/game/stop-calling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
        await fetch(`${baseUrl}/api/cache/force-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
      } catch (e) {
        console.warn('Failed to stop number calling after end-of-game:', e)
      }

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

    // Force-sync cache with the new state to prevent stale intervals
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
      await fetch(`${baseUrl}/api/cache/force-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })
    } catch (e) {
      console.warn('Failed to force-sync cache after player leave:', e)
    }

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
