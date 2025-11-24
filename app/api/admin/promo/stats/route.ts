import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'broadcast_manage')
    const body = await req.json().catch(() => ({}))
    const broadcastIds: string[] = body?.broadcastIds || []

    if (!Array.isArray(broadcastIds) || broadcastIds.length === 0) {
      return NextResponse.json({ stats: {} })
    }

    const { data, error } = await supabase
      .from('tournament_promos')
      .select('broadcast_id, status, expires_at')
      .in('broadcast_id', broadcastIds)

    if (error || !data) {
      console.error('Error loading promo stats:', error)
      return NextResponse.json({ stats: {} })
    }

    const now = new Date()
    const stats: Record<string, { total: number; used: number; expired: number; active: number }> = {}

    for (const row of data as any[]) {
      const bId = row.broadcast_id as string | null
      if (!bId) continue
      if (!stats[bId]) {
        stats[bId] = { total: 0, used: 0, expired: 0, active: 0 }
      }
      const s = stats[bId]
      s.total += 1

      const status = String(row.status || '').toLowerCase()
      const isUsed = status === 'used'
      const expiredByStatus = status === 'expired'

      let expiredByTime = false
      if (row.expires_at && status === 'unused') {
        const expiresAtDate = new Date(row.expires_at as string)
        if (!Number.isNaN(expiresAtDate.getTime())) {
          expiredByTime = expiresAtDate.getTime() <= now.getTime()
        }
      }

      if (isUsed) {
        s.used += 1
      } else if (expiredByStatus || expiredByTime) {
        s.expired += 1
      }
    }

    // compute active as total - used - expired
    for (const id of Object.keys(stats)) {
      const s = stats[id]
      s.active = Math.max(0, s.total - s.used - s.expired)
    }

    return NextResponse.json({ stats })
  } catch (e: any) {
    console.error('Error in POST /api/admin/promo/stats:', e)
    return NextResponse.json({ error: e.message || 'Failed to load stats' }, { status: 500 })
  }
}
