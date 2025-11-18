import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

// Use admin client to bypass RLS in production
const supabase = supabaseAdmin

// Check if a bingo card has a valid bingo

function checkBingo(card: number[][], markedCells: boolean[][]): boolean {
  // Check rows
  for (let i = 0; i < 5; i++) {
    if (markedCells[i].every(cell => cell)) return true
  }

  // Check columns
  for (let j = 0; j < 5; j++) {
    if (markedCells.every(row => row[j])) return true
  }

  // Check diagonal (top-left to bottom-right)
  if (markedCells.every((row, i) => row[i])) return true

  // Check diagonal (top-right to bottom-left)
  if (markedCells.every((row, i) => row[4 - i])) return true

  return false
}

// Verify that all marked cells correspond to called numbers
function verifyMarkedCells(
  card: number[][],
  markedCells: boolean[][],
  calledNumbers: number[]
): boolean {
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      if (markedCells[i][j]) {
        const num = card[i][j]
        // Free space (center) is always valid
        if (i === 2 && j === 2) continue
        // Check if number was actually called
        if (!calledNumbers.includes(num)) {
          return false
        }
      }
    }
  }
  return true
}

export async function POST(request: NextRequest) {
  try {
    const { gameId, userId, card, marked } = await request.json()
    console.log(`Processing bingo claim for game ${gameId}, user ${userId}`)

    if (!gameId || !userId || !card) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, userId, card' },
        { status: 400 }
      )
    }

    // Force sync cache to database before validation (critical operation)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'yegnabingobot-production.up.railway.app'
      await fetch(`${baseUrl}/api/cache/force-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })
      console.log(`🔄 Forced cache sync for game ${gameId} before bingo validation`)
    } catch (syncError) {
      console.warn('Cache sync failed, continuing with database state:', syncError)
    }

    // Get game from database (should be fresh after sync)
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }
    
    console.log(`🎯 Validating bingo claim for game ${gameId}`)
    console.log(`📊 Called numbers count: ${game.called_numbers?.length || 0}`)
    console.log(`📋 Called numbers: ${JSON.stringify(game.called_numbers)}`)

    // Only allow claims on active games
    if (game.status !== 'active') {
      return NextResponse.json(
        { error: 'Game is not active', status: game.status },
        { status: 400 }
      )
    }

    // Check if there's already a winner
    if (game.winner_id) {
      return NextResponse.json(
        { error: 'Game already has a winner' },
        { status: 400 }
      )
    }

    // Validate that the claimant is in this game (player or bot)
    const isBotClaim = Array.isArray(game.bots) && game.bots.includes(userId)
    if (!game.players.includes(userId) && !isBotClaim) {
      return NextResponse.json(
        { error: 'Player not in this game' },
        { status: 403 }
      )
    }

    // Use client-provided marked grid if available; otherwise reconstruct from called numbers
    const markedCells: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false))
    if (Array.isArray(marked) && marked.length === 5 && marked.every(r => Array.isArray(r) && r.length === 5)) {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          // Always treat center as marked
          markedCells[i][j] = (i === 2 && j === 2) ? true : !!marked[i][j]
        }
      }
    } else {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const num = card[i][j]
          // Free space is always marked
          if (i === 2 && j === 2) markedCells[i][j] = true
          else markedCells[i][j] = game.called_numbers.includes(num)
        }
      }
    }

    // Log the card and marked cells for debugging
    console.log(`🎴 Player card:`, JSON.stringify(card))
    console.log(`✅ Marked cells:`, JSON.stringify(markedCells))

    // Verify marked cells are valid
    const isValid = verifyMarkedCells(card, markedCells, game.called_numbers)
    console.log(`🔍 Marked cells verification: ${isValid ? 'VALID' : 'INVALID'}`)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid bingo claim - marked cells do not match called numbers' },
        { status: 400 }
      )
    }

    // Initialize prize calculation variables
    let commissionRateDecimal = await getConfig('game_commission_rate') || 0.1
    let commissionRate = commissionRateDecimal * 100
    let commissionAmount = Math.round((game.prize_pool * commissionRate / 100) * 100) / 100
    let netPrize = Math.round((game.prize_pool - commissionAmount) * 100) / 100

    // Determine bingo pattern from the marked cells (reusable for both branches)
    let bingoPattern: 'row' | 'column' | 'diagonal' | 'unknown' = 'unknown'
    let patternString: string = 'unknown'

    // Check for row bingo
    for (let i = 0; i < 5; i++) {
      if (markedCells[i].every(cell => cell)) {
        bingoPattern = 'row'
        patternString = `row:${i}`
        break
      }
    }

    // Check for column bingo
    if (bingoPattern === 'unknown') {
      for (let j = 0; j < 5; j++) {
        if (markedCells.every(row => row[j])) {
          bingoPattern = 'column'
          patternString = `column:${j}`
          break
        }
      }
    }

    // Check for diagonal bingo
    if (bingoPattern === 'unknown') {
      if (markedCells.every((row, i) => row[i])) {
        bingoPattern = 'diagonal'
        patternString = 'diag:main'
      } else if (markedCells.every((row, i) => row[4 - i])) {
        bingoPattern = 'diagonal'
        patternString = 'diag:anti'
      }
    }

    // Use secure atomic resolver with tie-break preference for 100% bots
    try {
      console.log(`🔒 Using atomic resolver with tie-break (prefer 100% bots on ties)`)    
      // Build claimed cell numbers for resolver
      const claimedCells: number[] = []
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (markedCells[i][j]) claimedCells.push(card[i][j])
        }
      }

      // First, acquire a lock on the game to prevent race conditions
      const { data: lockedGame, error: lockError } = await supabase
        .rpc('get_game_for_update', { game_id: gameId })
      
      if (lockError || !lockedGame) {
        console.warn('⚠️ Could not acquire game lock, falling back to previous validation:', lockError?.message || 'Game not found')
        throw new Error('Fallback to previous validation')
      }

      // Double-check game state after acquiring lock
      if (lockedGame.status !== 'active') {
        return NextResponse.json(
          { error: 'Game is not active', status: lockedGame.status },
          { status: 400 }
        )
      }

      if (lockedGame.winner_id) {
        return NextResponse.json(
          { error: 'Game already has a winner' },
          { status: 400 }
        )
      }

      const { data: resolveResult, error: resolveError } = await supabase
        .rpc('resolve_bingo_claim', {
          p_game_id: gameId,
          p_user_id: userId,
          p_claimed_cells: claimedCells,
          p_bingo_pattern: patternString || bingoPattern,
          p_user_card: card,
          p_window_ms: 120
        })

      if (resolveError) {
        console.warn('⚠️ Atomic resolver failed, falling back to previous validation:', resolveError)
        throw new Error('Fallback to previous validation')
      }

      const resolution = resolveResult[0]
      if (!resolution?.is_valid) {
        return NextResponse.json(
          { error: 'Invalid bingo claim', details: resolution?.validation_details },
          { status: 400 }
        )
      }
      if (!resolution?.is_winner) {
        return NextResponse.json(
          { error: 'Valid bingo, but another player won first', details: resolution?.validation_details },
          { status: 400 }
        )
      }

      // Winner! The atomic resolver already set winner_id; update financials and visuals
      console.log(`🏆 ATOMIC WINNER! User ${userId} won with ${patternString || bingoPattern}`)
      console.log(`💰 Prize Pool: ${game.prize_pool} ETB`)
      console.log(`📊 Commission (${commissionRate}%): ${commissionAmount} ETB`)
      console.log(`🎁 Net Prize: ${netPrize} ETB`)

      await supabase
        .from('games')
        .update({
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_prize: netPrize,
          winner_card: card,
          winner_pattern: patternString || bingoPattern
        })
        .eq('id', gameId)

    } catch (fallbackError) {
      // FALLBACK: Use original manual validation if atomic function fails
      console.log('📋 Using fallback manual bingo validation')
      
      // Re-check game state before fallback validation
      const { data: currentGame } = await supabase
        .from('games')
        .select('status, winner_id')
        .eq('id', gameId)
        .single()
      
      if (currentGame?.winner_id) {
        return NextResponse.json(
          { error: 'Game already has a winner' },
          { status: 400 }
        )
      }
      
      if (currentGame?.status !== 'active') {
        return NextResponse.json(
          { error: 'Game is not active' },
          { status: 400 }
        )
      }
      
      const hasBingo = checkBingo(card, markedCells)
      console.log(`🎯 Bingo check result: ${hasBingo ? 'YES - VALID BINGO!' : 'NO - Not a bingo'}`)
      
      if (!hasBingo) {
        console.log(`❌ No bingo pattern found`)
        return NextResponse.json(
          { error: 'Not a valid bingo' },
          { status: 400 }
        )
      }

      console.log(`💰 Prize Pool: ${game.prize_pool} ETB`)
      console.log(`📊 Commission (${commissionRate}%): ${commissionAmount} ETB`)
      console.log(`🎁 Net Prize: ${netPrize} ETB`)

      // Update game with winner (original method) using atomic update
      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'finished',
          winner_id: userId,
          ended_at: new Date().toISOString(),
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_prize: netPrize,
          winner_card: card,
          winner_pattern: patternString || bingoPattern
        })
        .eq('id', gameId)
        .eq('status', 'active')
        .is('winner_id', null) // Atomic condition to prevent race conditions

      if (updateError) {
        console.error('Error updating game:', updateError)
        // Check if it's a race condition (someone else won)
        const { data: checkGame } = await supabase
          .from('games')
          .select('winner_id')
          .eq('id', gameId)
          .single()
        
        if (checkGame?.winner_id && checkGame.winner_id !== userId) {
          return NextResponse.json(
            { error: 'Another player won first' },
            { status: 400 }
          )
        }
        
        return NextResponse.json(
          { error: 'Failed to claim bingo - another player may have won' },
          { status: 500 }
        )
      }
    }

    // Record winner earnings
    if (!isBotClaim) {
      // Human winner: add to user balance and log transaction
      const { error: balanceError } = await supabase.rpc('add_balance', {
        user_id: userId,
        amount: netPrize
      })

      if (balanceError) {
        console.error('Error adding balance:', balanceError)
      }

      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'win',
        amount: netPrize,
        game_id: gameId,
        status: 'completed',
        metadata: {
          gross_prize: game.prize_pool,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_prize: netPrize
        }
      })
    } else {
      // Bot winner: record bot earnings
      try {
        await supabase.rpc('record_bot_earning', {
          p_bot_id: userId,
          p_amount: netPrize,
          p_type: 'win',
          p_game_id: gameId
        })
      } catch (e) {
        console.error('Error recording bot earning:', e)
      }
    }

    // Player XP and stats only for human winners
    if (!isBotClaim) {
      // Get room level to determine XP reward
      const { data: room } = await supabase
        .from('rooms')
        .select('game_level, default_level')
        .eq('id', game.room_id)
        .single()
      
      const gameLevel = room?.game_level || room?.default_level || 'medium'
      
      // Get XP reward for this level
      const { data: levelData } = await supabase
        .from('levels')
        .select('xp_reward')
        .eq('name', gameLevel)
        .single()
      
      const xpReward = levelData?.xp_reward || 25 // Default to medium level XP

      await supabase.rpc('update_user_stats', {
        user_id: userId,
        won: true,
        winnings: netPrize
      })

      try {
        const { error: xpError } = await supabase.rpc('add_user_xp', {
          user_id: userId,
          xp_amount: xpReward
        })
        if (xpError) {
          console.error('Error updating XP:', xpError)
        } else {
          console.log(`🎯 Player ${userId} gained ${xpReward} XP for winning ${gameLevel} level game`)
        }
      } catch (xpError) {
        console.error('Error in XP system:', xpError)
      }
    }

    console.log(`🎉 User ${userId} won game ${gameId}`)
    console.log(`💵 Gross Prize: ${game.prize_pool} ETB`)
    console.log(`💰 Net Prize (after ${commissionRate}% commission): ${netPrize} ETB`)

    // Stop number calling by calling the Railway server
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
      await fetch(`${baseUrl}/api/game/stop-calling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })
      console.log(`🛑 Stopped number calling for game ${gameId}`)
    } catch (error) {
      console.error('Error stopping number calling:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Bingo claimed successfully!',
      prize: netPrize,
      gross_prize: game.prize_pool,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      winner_id: userId,
      game_status: 'finished'
    })
  } catch (error) {
    console.error('Error claiming bingo:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
