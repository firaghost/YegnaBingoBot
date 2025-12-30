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
    const paused = Boolean(body?.paused)

    if (!gameId) {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 })
    }

    const patch: any = { is_paused: paused }
    patch.paused_at = paused ? new Date().toISOString() : null

    const { error } = await supabase.from('games').update(patch).eq('id', gameId)
    if (error) throw error

    await auditLog(request, admin.id, paused ? 'game_pause' : 'game_resume', { game_id: gameId })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update pause state' }, { status: 500 })
  }
}
