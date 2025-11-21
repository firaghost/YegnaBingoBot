import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

export type StakeSource = 'real' | 'bonus'

export interface WalletSnapshot {
  real_balance: number
  bonus_balance: number
  bonus_locked_balance: number
  total_balance: number
  has_made_deposit: boolean
}

export interface PayoutResult {
  grossPrize: number
  commissionRate: number // decimal (e.g. 0.1 for 10%)
  commissionAmount: number
  netPrize: number
}

/**
 * Fetch the logical wallet snapshot for a user from the user_wallets view.
 */
export async function getUserWallet(userId: string): Promise<WalletSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('getUserWallet error:', error)
    return null
  }

  if (!data) return null

  return {
    real_balance: Number(data.real_balance ?? 0),
    bonus_balance: Number(data.bonus_balance ?? 0),
    bonus_locked_balance: Number(data.bonus_locked_balance ?? 0),
    total_balance: Number(data.total_balance ?? 0),
    has_made_deposit: !!data.has_made_deposit,
  }
}

/**
 * Resolve stake source for a given user and game by looking at the latest
 * stake transaction metadata. New wallet functions write `stake_source`
 * directly ('real' | 'bonus'). Legacy records may only have `source`
 * ('main' | 'bonus' | 'mixed'), where any real stake implies real credit.
 */
export async function getStakeSourceForUserInGame(
  userId: string,
  gameId: string
): Promise<StakeSource> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .eq('type', 'stake')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('getStakeSourceForUserInGame error, defaulting to real:', error)
    return 'real'
  }

  const meta: any = data?.metadata || {}

  const direct = meta.stake_source
  if (direct === 'real' || direct === 'bonus') {
    return direct
  }

  const legacy = meta.source
  if (legacy === 'bonus') return 'bonus'

  // For 'main', 'mixed', or anything unknown, treat as real. This matches the
  // existing behaviour where any real stake makes the entire win withdrawable.
  return 'real'
}

/**
 * Atomically deduct stake from the selected wallet (real or bonus) at game start.
 * Enforces: stake must come from exactly ONE source, never mixed.
 */
export async function handleGameStart(
  userId: string,
  gameId: string,
  stakeSource: StakeSource,
  stakeAmount: number
): Promise<{ success: true } | { success: false; error: string }> {
  if (!userId || !gameId) {
    return { success: false, error: 'INVALID_INPUT' }
  }
  if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
    return { success: false, error: 'INVALID_STAKE_AMOUNT' }
  }

  const rpcName = stakeSource === 'real' ? 'wallet_game_start_real' : 'wallet_game_start_bonus'

  const { error } = await supabaseAdmin.rpc(rpcName, {
    p_user_id: userId,
    p_game_id: gameId,
    p_stake: stakeAmount,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('INSUFFICIENT_REAL_BALANCE')) {
      return { success: false, error: 'INSUFFICIENT_REAL_BALANCE' }
    }
    if (msg.includes('INSUFFICIENT_BONUS_BALANCE')) {
      return { success: false, error: 'INSUFFICIENT_BONUS_BALANCE' }
    }
    if (msg.includes('User not found')) {
      return { success: false, error: 'USER_NOT_FOUND' }
    }
    if (msg.includes('Stake must be positive')) {
      return { success: false, error: 'INVALID_STAKE_AMOUNT' }
    }

    console.error('handleGameStart wallet error:', error)
    return { success: false, error: 'WALLET_ERROR' }
  }

  return { success: true }
}

/**
 * Compute payout for a game using the configured commission rate and secure
 * prize pool functions. This is deterministic per gameId.
 */
export async function computePayout(gameId: string): Promise<PayoutResult> {
  if (!gameId) {
    throw new Error('computePayout requires a gameId')
  }

  let commissionRate = Number(await getConfig('game_commission_rate'))
  if (!Number.isFinite(commissionRate)) commissionRate = 0.1 // default 10%

  let realPrizePool = 0
  let bonusPrizePool = 0

  try {
    const { data, error } = await supabaseAdmin.rpc('compute_real_prize_pool', {
      p_game_id: gameId,
    })
    if (!error && typeof data === 'number') {
      realPrizePool = Number(data)
    }
  } catch (e) {
    console.warn('compute_real_prize_pool failed, falling back:', e)
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('compute_bonus_prize_pool', {
      p_game_id: gameId,
    })
    if (!error && typeof data === 'number') {
      bonusPrizePool = Number(data)
    }
  } catch (e) {
    // If function missing or fails, treat bonus pool as zero (legacy safety)
    console.warn('compute_bonus_prize_pool failed, treating as 0:', e)
  }

  let grossPrize = realPrizePool + bonusPrizePool

  // Fallback: if both RPCs yielded 0, try games.prize_pool as last resort
  if (!grossPrize) {
    try {
      const { data: gameRow } = await supabaseAdmin
        .from('games')
        .select('prize_pool')
        .eq('id', gameId)
        .maybeSingle()
      if (gameRow && typeof gameRow.prize_pool === 'number') {
        grossPrize = Number(gameRow.prize_pool)
      }
    } catch (e) {
      console.warn('computePayout prize_pool fallback failed:', e)
    }
  }

  const commissionAmount = Math.round((grossPrize * commissionRate) * 100) / 100
  const netPrize = Math.round((grossPrize - commissionAmount) * 100) / 100

  return {
    grossPrize,
    commissionRate,
    commissionAmount,
    netPrize,
  }
}

export async function settleRealGame(
  winnerId: string,
  gameId: string,
  prizeAmount: number
): Promise<void> {
  if (!winnerId || !gameId) throw new Error('settleRealGame requires winnerId and gameId')
  if (!Number.isFinite(prizeAmount) || prizeAmount <= 0) return

  const { error } = await supabaseAdmin.rpc('wallet_settle_real_game', {
    p_winner_id: winnerId,
    p_game_id: gameId,
    p_prize: prizeAmount,
  })

  if (error) {
    console.error('settleRealGame error:', error)
    throw error
  }
}

export async function settleBonusGame(
  winnerId: string,
  gameId: string,
  prizeAmount: number
): Promise<void> {
  if (!winnerId || !gameId) throw new Error('settleBonusGame requires winnerId and gameId')
  if (!Number.isFinite(prizeAmount) || prizeAmount <= 0) return

  const { error } = await supabaseAdmin.rpc('wallet_settle_bonus_game', {
    p_winner_id: winnerId,
    p_game_id: gameId,
    p_prize: prizeAmount,
  })

  if (error) {
    console.error('settleBonusGame error:', error)
    throw error
  }
}

/**
 * High-level win handler: routes prize to the correct wallet based on stake source.
 */
export async function handleRoundWin(
  winnerId: string,
  gameId: string,
  prizeAmount: number,
  stakeSource: StakeSource
): Promise<void> {
  if (stakeSource === 'real') {
    await settleRealGame(winnerId, gameId, prizeAmount)
  } else {
    await settleBonusGame(winnerId, gameId, prizeAmount)
  }
}

/**
 * Loss handler is a no-op for wallet (stake was already deducted at start).
 * Kept for symmetry and future analytics logging.
 */
export async function handleRoundLoss(
  _playerId: string,
  _gameId: string,
  _stakeSource: StakeSource,
  _stakeAmount: number
): Promise<void> {
  // Intentionally no wallet changes on loss
}

/**
 * Apply first deposit unlock: credit deposit to real balance and, if this is the
 * first deposit and user has locked bonus winnings, move ALL locked bonus into
 * real balance. Always logs a deposit transaction, and an unlock_bonus_full
 * transaction when applicable.
 */
export async function applyFirstDepositUnlock(
  userId: string,
  depositAmount: number,
  depositMeta: Record<string, any>
): Promise<void> {
  if (!userId) throw new Error('applyFirstDepositUnlock requires userId')
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    throw new Error('Deposit amount must be positive')
  }

  const { error } = await supabaseAdmin.rpc('wallet_apply_first_deposit_unlock', {
    p_user_id: userId,
    p_amount: depositAmount,
    p_meta: depositMeta || {},
  })

  if (error) {
    console.error('applyFirstDepositUnlock error:', error)
    throw error
  }
}
