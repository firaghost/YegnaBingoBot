import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { handleGameStart, StakeSource } from '@/lib/server/wallet-service'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { gameId, userId, stakeSource } = await request.json()

    if (!gameId || !userId || !stakeSource) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, userId, stakeSource' },
        { status: 400 }
      )
    }

    if (stakeSource !== 'real' && stakeSource !== 'bonus') {
      return NextResponse.json(
        { error: 'Invalid stakeSource. Must be "real" or "bonus".' },
        { status: 400 }
      )
    }

    // Fetch game to validate membership and get stake amount
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, room_id, stake, players, status')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    if (!Array.isArray(game.players) || !game.players.includes(userId)) {
      return NextResponse.json(
        { error: 'User is not a player in this game' },
        { status: 403 }
      )
    }

    // Only allow staking while game is not yet finished
    if (!['waiting', 'waiting_for_players', 'countdown', 'active'].includes(game.status)) {
      return NextResponse.json(
        { error: 'Game is not in a state that allows staking', status: game.status },
        { status: 400 }
      )
    }

    const stakeAmount = Number(game.stake || 0)
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing stake amount on game' },
        { status: 500 }
      )
    }

    // Idempotency: if a stake transaction already exists for this user/game,
    // treat this as already staked (e.g., page refresh) and do not deduct again
    const { data: existingStake, error: stakeCheckError } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .eq('type', 'stake')
      .limit(1)
      .maybeSingle()

    if (!stakeCheckError && existingStake) {
      return NextResponse.json({ success: true, alreadyStaked: true })
    }

    const result = await handleGameStart(userId, gameId, stakeSource as StakeSource, stakeAmount)

    if (!result.success) {
      let status = 400
      if (result.error === 'USER_NOT_FOUND') status = 404
      if (result.error === 'WALLET_ERROR') status = 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in confirm-join:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
