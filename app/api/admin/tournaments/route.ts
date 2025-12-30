import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAnyPermission, auditLog } from '@/lib/server/admin-permissions'
import { finalizeTournament, manualOverrideAward } from '@/lib/server/tournament-service'

const supabase = supabaseAdmin

export async function GET(req: NextRequest) {
  try {
    await requireAnyPermission(req, ['tournaments_view', 'tournaments_manage'])

    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const enriched: any[] = []

    for (const t of tournaments as any[]) {
      const id = t.id as string

      let totalDeposits = 0
      let participants = 0
      let totalPlays = 0

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
          totalPlays = metrics.reduce(
            (sum: number, m: any) => sum + Number(m.plays_count || 0),
            0,
          )
        }
      } catch (metricsError) {
        console.warn('Error loading tournament_metrics for', id, metricsError)
      }

      let winners: any[] = []
      try {
        const { data: winnersData } = await supabase
          .from('tournament_winners')
          .select('user_id, rank, metric, prize_amount, paid, paid_at, metric_value')
          .eq('tournament_id', id)
          .order('metric', { ascending: true })
          .order('rank', { ascending: true })

        winners = winnersData || []
      } catch (wErr) {
        console.warn('Error loading tournament_winners for', id, wErr)
      }

      enriched.push({
        ...t,
        metrics_summary: {
          total_deposits: totalDeposits,
          total_plays: totalPlays,
          participants,
        },
        winners,
      })
    }

    return NextResponse.json({ success: true, data: enriched })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tournaments:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load tournaments' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAnyPermission(req, ['tournaments_manage'])
    const body = await req.json()
    const { action } = body || {}

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    if (action === 'create' || action === 'update') {
      const t = body.tournament || {}
      const base = {
        name: String(t.name || '').trim(),
        type: t.type || 'weekly',
        status: t.status || 'upcoming',
        is_enabled: Boolean(t.is_enabled ?? true),
        start_at: t.start_at,
        end_at: t.end_at,
        prize_mode: t.prize_mode || 'fixed',
        prize_config: t.prize_config || {},
        eligibility: t.eligibility || {},
        settings: t.settings || {},
      }

      if (!base.name || !base.start_at || !base.end_at) {
        return NextResponse.json(
          { error: 'Missing required fields: name, start_at, end_at' },
          { status: 400 },
        )
      }

      if (action === 'create') {
        const { data, error } = await supabase
          .from('tournaments')
          .insert({ ...base, created_by: null })
          .select()
          .maybeSingle()

        if (error || !data) throw error || new Error('Failed to create tournament')

        await auditLog(req, admin.id, 'tournament_create', { id: data.id })
        return NextResponse.json({ success: true, data })
      } else {
        const id = body.id || t.id
        if (!id) {
          return NextResponse.json({ error: 'Missing id for update' }, { status: 400 })
        }

        const { data, error } = await supabase
          .from('tournaments')
          .update(base)
          .eq('id', id)
          .select()
          .maybeSingle()

        if (error || !data) throw error || new Error('Failed to update tournament')

        await auditLog(req, admin.id, 'tournament_update', { id })
        return NextResponse.json({ success: true, data })
      }
    }

    if (action === 'toggle') {
      const { id, is_enabled, status } = body || {}
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      const update: any = {}
      if (typeof is_enabled === 'boolean') update.is_enabled = is_enabled
      if (status) update.status = status

      const { data, error } = await supabase
        .from('tournaments')
        .update(update)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error || !data) throw error || new Error('Failed to toggle tournament')

      await auditLog(req, admin.id, 'tournament_toggle', { id, update })
      return NextResponse.json({ success: true, data })
    }

    if (action === 'delete') {
      const { id } = body || {}
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id)

      if (error) throw error

      await auditLog(req, admin.id, 'tournament_delete', { id })
      return NextResponse.json({ success: true })
    }

    if (action === 'preview_finalize') {
      const { id } = body || {}
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const result = await finalizeTournament(id, { previewOnly: true, force: true })
      return NextResponse.json({ success: true, preview: result.winners })
    }

    if (action === 'finalize') {
      const { id } = body || {}
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const result = await finalizeTournament(id, { force: true, actorId: admin.id })
      await auditLog(req, admin.id, 'tournament_finalize', { id, winners: result.winners })
      return NextResponse.json({ success: true, winners: result.winners })
    }

    if (action === 'random_promo') {
      const { id, metric, amount } = body || {}
      if (!id || !metric || !amount) {
        return NextResponse.json(
          { error: 'Missing required fields: id, metric, amount' },
          { status: 400 },
        )
      }

      if (metric !== 'deposits' && metric !== 'plays') {
        return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
      }

      const { data: winners, error: winnersErr } = await supabase
        .from('tournament_winners')
        .select('user_id, rank, metric')
        .eq('tournament_id', id)
        .eq('metric', metric)
        .lte('rank', 3)

      if (winnersErr) throw winnersErr
      if (!winners || winners.length === 0) {
        return NextResponse.json({ error: 'No winners in top 3 for this metric' }, { status: 400 })
      }

      const idx = Math.floor(Math.random() * winners.length)
      const chosen = winners[idx]

      const codeBase = Math.random().toString(36).substring(2, 8).toUpperCase()
      const code = `TPR-${codeBase}`

      const expires = new Date()
      expires.setDate(expires.getDate() + 7)

      const { data: promo, error: promoErr } = await supabase
        .from('tournament_promos')
        .insert({
          tournament_id: id,
          user_id: chosen.user_id,
          code,
          amount: Number(amount),
          metric: chosen.metric,
          rank: chosen.rank,
          expires_at: expires.toISOString(),
          meta: { random_extra: true },
        })
        .select()
        .maybeSingle()

      if (promoErr || !promo) throw promoErr || new Error('Failed to create promo')

      // Notify user via Telegram
      try {
        const { data: user } = await supabase
          .from('users')
          .select('telegram_id, username')
          .eq('id', chosen.user_id)
          .maybeSingle()

        const chatId = user?.telegram_id
        const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
        if (chatId && botToken) {
          const amountText = Number(amount).toFixed(2)
          const message =
            `🎁 *Random Tournament Bonus*\n\n` +
            `You were randomly selected from the top 3 (${metric === 'deposits' ? 'Top Depositor' : 'Most Played'})!\n` +
            `Extra prize: *${amountText} ETB*\n\n` +
            `Your promo code is:\n\`${code}\`\n\n` +
            `Redeem it in the bot using: /promo ${code}`

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown',
            }),
          })
        }
      } catch (notifyErr) {
        console.warn('Failed to send promo notification:', notifyErr)
      }

      await auditLog(req, admin.id, 'tournament_random_promo', {
        tournament_id: id,
        metric,
        amount,
        promo_code: code,
        user_id: chosen.user_id,
      })

      return NextResponse.json({ success: true, promo: { code, user_id: chosen.user_id, amount } })
    }

    if (action === 'manual_award') {
      const { tournamentId, userId, amount, metric, rank, reason } = body || {}
      if (!tournamentId || !userId || !amount || !metric || !rank) {
        return NextResponse.json(
          { error: 'Missing required fields for manual_award' },
          { status: 400 },
        )
      }

      await manualOverrideAward(
        tournamentId,
        userId,
        Number(amount),
        metric,
        Number(rank),
        admin.id,
        reason || 'manual_award',
      )

      await auditLog(req, admin.id, 'tournament_manual_award', {
        tournamentId,
        userId,
        amount,
        metric,
        rank,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/tournaments:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process tournament action' },
      { status: 500 },
    )
  }
}
