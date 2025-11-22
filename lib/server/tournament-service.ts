import { supabaseAdmin } from '@/lib/supabase'
import type { StakeSource } from '@/lib/server/wallet-service'

export type TournamentMetric = 'deposits' | 'plays'

export interface LeaderboardRow {
  user_id: string
  value: number
  rank: number
}

interface TournamentRow {
  id: string
  name: string
  type: string
  status: string
  is_enabled: boolean
  start_at: string
  end_at: string
  prize_mode: string
  prize_config: any
  eligibility: any
}

interface TournamentMetricsRow {
  id: string
  tournament_id: string
  user_id: string
  deposited_total: number
  plays_count: number
  last_deposit_at: string | null
  last_play_at: string | null
}

interface EligibilityConfig {
  min_deposit_total?: number
  min_plays?: number
  require_deposit?: boolean
  exclude_suspended?: boolean
}

interface FinalizeOptions {
  force?: boolean
  actorId?: string
  previewOnly?: boolean
}

interface WinnerComputationInput {
  tournament: TournamentRow
  metrics: TournamentMetricsRow[]
}

interface WinnerPayloadItem {
  metric: TournamentMetric
  user_id: string
  rank: number
  metricValue: number
  prize: number
  meta?: Record<string, any>
}

async function getActiveTournaments(at: Date = new Date()): Promise<TournamentRow[]> {
  const iso = at.toISOString()

  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('is_enabled', true)
    .in('status', ['upcoming', 'live'])
    .lte('start_at', iso)
    .gte('end_at', iso)

  if (error) {
    console.error('getActiveTournaments error:', error)
    return []
  }

  return (data || []) as TournamentRow[]
}

export async function recordDeposit(
  userId: string,
  amount: number,
  occurredAt: Date = new Date(),
): Promise<void> {
  if (!userId) return
  if (!Number.isFinite(amount) || amount <= 0) return

  const tournaments = await getActiveTournaments(occurredAt)
  if (!tournaments.length) return

  const ts = occurredAt.toISOString()

  for (const t of tournaments) {
    const { error } = await supabaseAdmin
      .from('tournament_metrics')
      .upsert(
        {
          tournament_id: t.id,
          user_id: userId,
          deposited_total: amount,
          last_deposit_at: ts,
        },
        { onConflict: 'tournament_id,user_id' },
      )

    if (error) {
      console.error('recordDeposit upsert error:', error)
      continue
    }

    await supabaseAdmin.from('tournament_audit_logs').insert({
      tournament_id: t.id,
      action: 'metrics_update',
      actor: null,
      details: {
        type: 'deposit',
        user_id: userId,
        amount,
        at: ts,
      },
    })
  }
}

export async function recordPlay(
  userId: string,
  gameId: string,
  stakeSource: StakeSource | null,
  occurredAt: Date = new Date(),
): Promise<void> {
  if (!userId || !gameId) return

  const tournaments = await getActiveTournaments(occurredAt)
  if (!tournaments.length) return

  const ts = occurredAt.toISOString()

  for (const t of tournaments) {
    const { error } = await supabaseAdmin
      .from('tournament_metrics')
      .upsert(
        {
          tournament_id: t.id,
          user_id: userId,
          plays_count: 1,
          last_play_at: ts,
        },
        { onConflict: 'tournament_id,user_id' },
      )

    if (error) {
      console.error('recordPlay upsert error:', error)
      continue
    }

    await supabaseAdmin.from('tournament_audit_logs').insert({
      tournament_id: t.id,
      action: 'metrics_update',
      actor: null,
      details: {
        type: 'play',
        user_id: userId,
        game_id: gameId,
        stake_source: stakeSource,
        at: ts,
      },
    })
  }
}

export async function getLeaderboard(
  tournamentId: string,
  metric: TournamentMetric,
  limit = 10,
): Promise<LeaderboardRow[]> {
  if (!tournamentId) return []

  const column = metric === 'deposits' ? 'deposited_total' : 'plays_count'

  const { data, error } = await supabaseAdmin
    .from('tournament_metrics')
    .select('user_id, deposited_total, plays_count, last_deposit_at, last_play_at')
    .eq('tournament_id', tournamentId)
    .order(column, { ascending: false })
    .limit(limit)

  if (error || !data) {
    if (error) console.error('getLeaderboard error:', error)
    return []
  }

  return data.map((row: any, index: number) => ({
    user_id: row.user_id,
    value: metric === 'deposits' ? Number(row.deposited_total || 0) : Number(row.plays_count || 0),
    rank: index + 1,
  }))
}

async function filterEligibleUsers(
  tournament: TournamentRow,
  metrics: TournamentMetricsRow[],
): Promise<TournamentMetricsRow[]> {
  if (!metrics.length) return []

  const eligibility: EligibilityConfig = tournament.eligibility || {}

  const minDeposit = Number(eligibility.min_deposit_total || 0)
  const minPlays = Number(eligibility.min_plays || 0)
  const requireDeposit = Boolean(eligibility.require_deposit)
  const excludeSuspended = Boolean(eligibility.exclude_suspended)

  const userIds = Array.from(new Set(metrics.map((m) => m.user_id)))

  const [walletRes, usersRes] = await Promise.all([
    supabaseAdmin
      .from('user_wallets')
      .select('user_id, has_made_deposit')
      .in('user_id', userIds),
    supabaseAdmin
      .from('users')
      .select('id, status')
      .in('id', userIds),
  ])

  const walletMap = new Map<string, boolean>()
  if (!walletRes.error && walletRes.data) {
    for (const row of walletRes.data as any[]) {
      walletMap.set(row.user_id, !!row.has_made_deposit)
    }
  }

  const statusMap = new Map<string, string | null>()
  if (!usersRes.error && usersRes.data) {
    for (const row of usersRes.data as any[]) {
      statusMap.set(row.id, row.status ?? null)
    }
  }

  return metrics.filter((m) => {
    const depositOk = minDeposit <= 0 || Number(m.deposited_total || 0) >= minDeposit
    const playsOk = minPlays <= 0 || Number(m.plays_count || 0) >= minPlays

    if (!depositOk || !playsOk) return false

    if (requireDeposit) {
      const hasDeposit = walletMap.get(m.user_id) || false
      if (!hasDeposit) return false
    }

    if (excludeSuspended) {
      const status = statusMap.get(m.user_id)
      if (status && status !== 'active') return false
    }

    return true
  })
}

function computeWinners(input: WinnerComputationInput): WinnerPayloadItem[] {
  const { tournament, metrics } = input
  const prizeConfig = tournament.prize_config || {}

  const winners: WinnerPayloadItem[] = []

  const depositsSorted = [...metrics]
    .filter((m) => Number(m.deposited_total || 0) > 0)
    .sort((a, b) => {
      const av = Number(a.deposited_total || 0)
      const bv = Number(b.deposited_total || 0)
      if (bv !== av) return bv - av
      const at = a.last_deposit_at || ''
      const bt = b.last_deposit_at || ''
      return at.localeCompare(bt)
    })

  const playsSorted = [...metrics]
    .filter((m) => Number(m.plays_count || 0) > 0)
    .sort((a, b) => {
      const av = Number(a.plays_count || 0)
      const bv = Number(b.plays_count || 0)
      if (bv !== av) return bv - av
      const at = a.last_play_at || ''
      const bt = b.last_play_at || ''
      return at.localeCompare(bt)
    })

  const totalDeposits = metrics.reduce((sum, m) => sum + Number(m.deposited_total || 0), 0)

  const maxPayout = Number(prizeConfig.max_payout || 0) || undefined

  if (tournament.prize_mode === 'fixed') {
    const fixedDeposits = prizeConfig.deposits?.positions || []
    const fixedPlays = prizeConfig.plays?.positions || []

    for (const pos of fixedDeposits) {
      const target = depositsSorted[pos.rank - 1]
      if (!target) continue
      const prize = Number(pos.amount || 0)
      if (prize <= 0) continue
      winners.push({
        metric: 'deposits',
        user_id: target.user_id,
        rank: pos.rank,
        metricValue: Number(target.deposited_total || 0),
        prize,
        meta: { mode: 'fixed' },
      })
    }

    for (const pos of fixedPlays) {
      const target = playsSorted[pos.rank - 1]
      if (!target) continue
      const prize = Number(pos.amount || 0)
      if (prize <= 0) continue
      winners.push({
        metric: 'plays',
        user_id: target.user_id,
        rank: pos.rank,
        metricValue: Number(target.plays_count || 0),
        prize,
        meta: { mode: 'fixed' },
      })
    }
  } else if (tournament.prize_mode === 'percentage') {
    const poolShare = Number(prizeConfig.pool_share || 0)
    const positions: number[] = Array.isArray(prizeConfig.positions) ? prizeConfig.positions : []

    const pool = Math.max(0, totalDeposits * poolShare)
    const rawPrizes = positions.map((p) => Math.max(0, pool * Number(p || 0)))

    let scale = 1
    if (maxPayout && maxPayout > 0) {
      const sum = rawPrizes.reduce((s, v) => s + v, 0)
      if (sum > maxPayout) {
        scale = maxPayout / sum
      }
    }

    const scaledPrizes = rawPrizes.map((p) => Math.round(p * scale * 100) / 100)

    scaledPrizes.forEach((prize, idx) => {
      if (prize <= 0) return
      const target = depositsSorted[idx]
      if (!target) return
      winners.push({
        metric: 'deposits',
        user_id: target.user_id,
        rank: idx + 1,
        metricValue: Number(target.deposited_total || 0),
        prize,
        meta: { mode: 'percentage', pool_share: poolShare },
      })
    })
  }

  if (maxPayout && maxPayout > 0) {
    const total = winners.reduce((s, w) => s + w.prize, 0)
    if (total > maxPayout) {
      const factor = maxPayout / total
      return winners.map((w) => ({
        ...w,
        prize: Math.round(w.prize * factor * 100) / 100,
      }))
    }
  }

  return winners
}

async function awardPrize(row: {
  id: string
  tournament_id: string
  user_id: string
  rank: number
  metric: string
  prize_amount: number
}): Promise<void> {
  if (!row.prize_amount || row.prize_amount <= 0) return

  const { error } = await supabaseAdmin.rpc('wallet_award_tournament_prize', {
    p_user_id: row.user_id,
    p_tournament_id: row.tournament_id,
    p_metric: row.metric,
    p_rank: row.rank,
    p_amount: row.prize_amount,
  })

  if (error) {
    console.error('awardPrize wallet_award_tournament_prize error:', error)
    throw error
  }

  const paidAt = new Date().toISOString()

  await supabaseAdmin
    .from('tournament_winners')
    .update({ paid: true, paid_at: paidAt })
    .eq('id', row.id)

  await supabaseAdmin.from('tournament_audit_logs').insert({
    tournament_id: row.tournament_id,
    action: 'prize_awarded',
    actor: null,
    details: {
      user_id: row.user_id,
      metric: row.metric,
      rank: row.rank,
      prize_amount: row.prize_amount,
      paid_at: paidAt,
    },
  })
}

export async function finalizeTournament(
  tournamentId: string,
  options: FinalizeOptions = {},
): Promise<{ alreadyFinalized?: boolean; winners: WinnerPayloadItem[] }> {
  if (!tournamentId) {
    throw new Error('finalizeTournament requires tournamentId')
  }

  const { data: t, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .maybeSingle()

  if (tErr || !t) {
    throw new Error('Tournament not found')
  }

  const tournament = t as TournamentRow

  const now = new Date()
  const endAt = new Date(tournament.end_at)

  if (!options.force && endAt > now) {
    throw new Error('Tournament has not ended yet')
  }

  const { data: existingWinners, error: winnersErr } = await supabaseAdmin
    .from('tournament_winners')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)

  if (!winnersErr && existingWinners && existingWinners.length > 0) {
    return { alreadyFinalized: true, winners: [] }
  }

  const { data: metrics, error: mErr } = await supabaseAdmin
    .from('tournament_metrics')
    .select('*')
    .eq('tournament_id', tournamentId)

  if (mErr) {
    throw mErr
  }

  const eligibleMetrics = await filterEligibleUsers(
    tournament,
    (metrics || []) as TournamentMetricsRow[],
  )

  const computedWinners = computeWinners({ tournament, metrics: eligibleMetrics })

  if (options.previewOnly) {
    return { winners: computedWinners }
  }

  const inserted: WinnerPayloadItem[] = []

  for (const w of computedWinners) {
    const { data: row, error: insErr } = await supabaseAdmin
      .from('tournament_winners')
      .insert({
        tournament_id: tournamentId,
        user_id: w.user_id,
        rank: w.rank,
        metric: w.metric,
        metric_value: w.metricValue,
        prize_amount: w.prize,
        meta: w.meta || {},
      })
      .select()
      .maybeSingle()

    if (insErr || !row) {
      console.error('finalizeTournament insert winner error:', insErr)
      continue
    }

    try {
      await awardPrize({
        id: row.id,
        tournament_id: row.tournament_id,
        user_id: row.user_id,
        rank: row.rank,
        metric: row.metric,
        prize_amount: row.prize_amount,
      })
      inserted.push(w)
    } catch (e) {
      console.error('finalizeTournament awardPrize error:', e)
    }
  }

  await supabaseAdmin
    .from('tournaments')
    .update({ status: 'ended', is_enabled: false })
    .eq('id', tournamentId)

  await supabaseAdmin.from('tournament_audit_logs').insert({
    tournament_id: tournamentId,
    action: 'finalized',
    actor: options.actorId || null,
    details: { winners_count: inserted.length },
  })

  return { winners: inserted }
}

export async function manualOverrideAward(
  tournamentId: string,
  userId: string,
  amount: number,
  metric: TournamentMetric,
  rank: number,
  actorId: string,
  reason: string,
): Promise<void> {
  if (!tournamentId || !userId) return
  if (!Number.isFinite(amount) || amount <= 0) return

  const { data: row, error } = await supabaseAdmin
    .from('tournament_winners')
    .insert({
      tournament_id: tournamentId,
      user_id: userId,
      rank,
      metric,
      metric_value: 0,
      prize_amount: amount,
      meta: { overridden: true, reason },
    })
    .select()
    .maybeSingle()

  if (error || !row) {
    console.error('manualOverrideAward insert error:', error)
    return
  }

  await awardPrize({
    id: row.id,
    tournament_id: row.tournament_id,
    user_id: row.user_id,
    rank: row.rank,
    metric: row.metric,
    prize_amount: row.prize_amount,
  })

  await supabaseAdmin.from('tournament_audit_logs').insert({
    tournament_id: tournamentId,
    action: 'override_award',
    actor: actorId,
    details: {
      user_id: userId,
      metric,
      rank,
      amount,
      reason,
    },
  })
}
