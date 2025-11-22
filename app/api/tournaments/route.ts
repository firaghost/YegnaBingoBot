import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getLeaderboard } from '@/lib/server/tournament-service'

const supabase = supabaseAdmin

export async function GET(_req: NextRequest) {
  try {
    const nowIso = new Date().toISOString()

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_enabled', true)
      .in('status', ['live', 'upcoming'])
      .lte('start_at', nowIso)
      .order('status', { ascending: false })
      .order('start_at', { ascending: true })

    if (error) {
      console.error('Error loading tournaments:', error)
      return NextResponse.json({ tournaments: [] })
    }

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ tournaments: [] })
    }

    const enriched: any[] = []

    for (const t of tournaments as any[]) {
      const id = t.id as string

      let totalDeposits = 0
      let participants = 0

      try {
        const { data: metrics, error: metricsErr } = await supabase
          .from('tournament_metrics')
          .select('user_id, deposited_total, plays_count')
          .eq('tournament_id', id)

        if (!metricsErr && metrics) {
          participants = metrics.length
          totalDeposits = metrics.reduce(
            (sum: number, m: any) => sum + Number(m.deposited_total || 0),
            0,
          )
        }
      } catch (metricsError) {
        console.warn('Error loading tournament_metrics for', id, metricsError)
      }

      const settings = t.settings || {}

      // Build prize summary, preferring admin-provided copy
      let prize_summary: string = settings.prize_label || settings.prize_summary || ''
      const prizeConfig = t.prize_config || {}

      if (!prize_summary) {
        if (t.prize_mode === 'fixed') {
          const depTop = prizeConfig.deposits?.positions?.[0]?.amount
          const playsTop = prizeConfig.plays?.positions?.[0]?.amount
          const pieces: string[] = []
          if (depTop) pieces.push(`Top depositor: ${Number(depTop).toLocaleString()} ETB`)
          if (playsTop) pieces.push(`Most played: ${Number(playsTop).toLocaleString()} ETB`)
          prize_summary = pieces.join(' • ')
        } else if (t.prize_mode === 'percentage') {
          const poolShare = Number(prizeConfig.pool_share || 0)
          if (poolShare > 0 && totalDeposits > 0) {
            const pool = Math.round(totalDeposits * poolShare * 100) / 100
            prize_summary = `Prize pool: ${pool.toLocaleString()} ETB`
          }
        }
      }

      if (!prize_summary && totalDeposits > 0) {
        prize_summary = `Total deposits: ${totalDeposits.toLocaleString()} ETB`
      }

      // Build eligibility summary, preferring admin-provided copy
      let eligibility_summary: string = settings.eligibility_label || settings.eligibility_summary || ''
      const eg = t.eligibility || {}
      const bits: string[] = []

      if (!eligibility_summary) {
        if (eg.min_deposit_total) bits.push(`Min deposit ${Number(eg.min_deposit_total).toLocaleString()} ETB`)
        if (eg.min_plays) bits.push(`Min ${Number(eg.min_plays)} plays`)
        if (bits.length) eligibility_summary = bits.join(', ')
      }

      // Leaderboards (top 10 per metric)
      const [topDeposits, topPlays] = await Promise.all([
        getLeaderboard(id, 'deposits', 10),
        getLeaderboard(id, 'plays', 10),
      ])

      const userIds = Array.from(
        new Set([
          ...topDeposits.map((r) => r.user_id),
          ...topPlays.map((r) => r.user_id),
        ]),
      )

      let usernameMap = new Map<string, string>()
      if (userIds.length > 0) {
        try {
          const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id, username')
            .in('id', userIds)

          if (!usersErr && users) {
            usernameMap = new Map(
              (users as any[]).map((u) => [u.id as string, (u.username as string) || 'player']),
            )
          }
        } catch (userErr) {
          console.warn('Error loading usernames for tournament leaderboard', id, userErr)
        }
      }

      const topDepositors = topDeposits.map((row) => ({
        username: usernameMap.get(row.user_id) || 'player',
        valueLabel: `${row.value.toLocaleString()} ETB`,
      }))

      const topPlayers = topPlays.map((row) => ({
        username: usernameMap.get(row.user_id) || 'player',
        valueLabel: `${row.value.toLocaleString()} plays`,
      }))

      enriched.push({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        start_at: t.start_at,
        end_at: t.end_at,
        settings: t.settings || {},
        prize_mode: t.prize_mode,
        prize_config: t.prize_config,
        prize_summary,
        eligibility_summary,
        metrics_summary: {
          total_deposits: totalDeposits,
          participants,
        },
        topDepositors,
        topPlayers,
      })
    }

    return NextResponse.json({ tournaments: enriched })
  } catch (error) {
    console.error('Error in GET /api/tournaments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
