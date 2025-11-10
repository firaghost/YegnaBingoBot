import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
    const { gameId, userId, card } = await request.json()

    if (!gameId || !userId || !card) {
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

    // Check if game is still active
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

    // Get player's card from database
    const { data: playerCard, error: cardError } = await supabase
      .from('player_cards')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .single()

    if (cardError || !playerCard) {
      return NextResponse.json(
        { error: 'Player card not found' },
        { status: 404 }
      )
    }

    // Create marked cells array from the card
    const markedCells: boolean[][] = []
    for (let i = 0; i < 5; i++) {
      markedCells[i] = []
      for (let j = 0; j < 5; j++) {
        const num = card[i][j]
        // Free space is always marked
        if (i === 2 && j === 2) {
          markedCells[i][j] = true
        } else {
          // Mark if number was called
          markedCells[i][j] = game.called_numbers.includes(num)
        }
      }
    }

    // Verify marked cells are valid
    if (!verifyMarkedCells(card, markedCells, game.called_numbers)) {
      return NextResponse.json(
        { error: 'Invalid bingo claim - marked cells do not match called numbers' },
        { status: 400 }
      )
    }

    // Check if it's a valid bingo
    if (!checkBingo(card, markedCells)) {
      return NextResponse.json(
        { error: 'Not a valid bingo' },
        { status: 400 }
      )
    }

    // Get commission rate from settings
    const { data: commissionSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'commission_rate')
      .single()

    const commissionRate = commissionSetting ? parseFloat(commissionSetting.setting_value) : 10
    const commissionAmount = Math.round((game.prize_pool * commissionRate / 100) * 100) / 100
    const netPrize = Math.round((game.prize_pool - commissionAmount) * 100) / 100

    console.log(`💰 Prize Pool: ${game.prize_pool} ETB`)
    console.log(`📊 Commission (${commissionRate}%): ${commissionAmount} ETB`)
    console.log(`🎁 Net Prize: ${netPrize} ETB`)

    // Update game with winner and commission info
    const { error: updateError } = await supabase
      .from('games')
      .update({
        status: 'finished',
        winner_id: userId,
        ended_at: new Date().toISOString(),
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        net_prize: netPrize
      })
      .eq('id', gameId)
      .eq('status', 'active') // Only update if still active (race condition protection)
      .is('winner_id', null) // Only update if no winner yet

    if (updateError) {
      console.error('Error updating game:', updateError)
      return NextResponse.json(
        { error: 'Failed to claim bingo - another player may have won' },
        { status: 500 }
      )
    }

    // Add NET winnings to user balance (after commission)
    const { error: balanceError } = await supabase.rpc('add_balance', {
      user_id: userId,
      amount: netPrize
    })

    if (balanceError) {
      console.error('Error adding balance:', balanceError)
    }

    // Create transaction record with commission details
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

    // Update user stats with NET winnings
    await supabase.rpc('update_user_stats', {
      user_id: userId,
      won: true,
      winnings: netPrize
    })

    console.log(`🎉 User ${userId} won game ${gameId}`)
    console.log(`💵 Gross Prize: ${game.prize_pool} ETB`)
    console.log(`💰 Net Prize (after ${commissionRate}% commission): ${netPrize} ETB`)

    return NextResponse.json({
      success: true,
      message: 'Bingo claimed successfully!',
      prize: netPrize,
      gross_prize: game.prize_pool,
      commission_rate: commissionRate,
      commission_amount: commissionAmount
    })
  } catch (error) {
    console.error('Error claiming bingo:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
