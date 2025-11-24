import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

type PublicPromoStatus = 'all' | 'active' | 'expired' | 'fully_claimed'

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'broadcast_manage')

    const body = await req.json().catch(() => ({}))
    const status: PublicPromoStatus = body?.status || 'all'
    const limit: number = body?.limit && Number(body.limit) > 0 ? Number(body.limit) : 20

    let query = supabase
      .from('public_promos')
      .select('id, code, amount, max_uses, used_count, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    const nowIso = new Date().toISOString()

    if (status === 'active') {
      query = query
        .lt('used_count', supabase.rpc as any) // placeholder, will not be used; we'll filter client-side
    }

    const { data, error } = await supabase
      .from('public_promos')
      .select('id, code, amount, max_uses, used_count, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) {
      console.error('Error loading public promos:', error)
      return NextResponse.json({ promos: [] })
    }

    // Filter in memory for now (dataset is tiny and admin-only)
    const now = new Date()
    const filtered = (data as any[]).filter((p) => {
      const expiresAt = p.expires_at ? new Date(p.expires_at as string) : null
      const isExpired = expiresAt ? expiresAt.getTime() <= now.getTime() : false
      const fullyClaimed = (p.used_count || 0) >= (p.max_uses || 0)

      if (status === 'active') {
        return !isExpired && !fullyClaimed
      }
      if (status === 'expired') {
        return isExpired
      }
      if (status === 'fully_claimed') {
        return fullyClaimed
      }
      return true
    })

    return NextResponse.json({ promos: filtered })
  } catch (e: any) {
    console.error('Error in POST /api/admin/promo/public-list:', e)
    return NextResponse.json({ error: e.message || 'Failed to load public promos' }, { status: 500 })
  }
}
