import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminFromRequest, auditLog } from '@/lib/server/admin-permissions'

export const dynamic = 'force-dynamic'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const gameId = String(body?.gameId || '').trim()

    if (!gameId) {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 })
    }

    const { error: err1 } = await supabase
      .from('games')
      .update({
        status: 'finished',
        ended_at: new Date().toISOString(),
        countdown_time: 0,
        is_paused: false,
        paused_at: null,
        players: [],
        bots: [],
        game_status: 'finished_no_winner',
        end_reason: 'admin_live_monitor_force_end'
      } as any)
      .eq('id', gameId)

    if (err1) {
      const { error: err2 } = await supabase
        .from('games')
        .update({
          status: 'finished',
          ended_at: new Date().toISOString(),
          countdown_time: 0,
          is_paused: false,
          paused_at: null,
          players: [],
          bots: [],
        } as any)
        .eq('id', gameId)
      if (err2) throw err2
    }

    await auditLog(request, admin.id, 'game_force_end', { game_id: gameId })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to force end game' }, { status: 500 })
  }
}
