import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'broadcast_manage')

    const body = await req.json().catch(() => ({}))
    const term = String(body?.term || '').trim()
    const limit = Math.min(20, Math.max(1, Number(body?.limit || 15)))

    if (!term || term.length < 2) {
      return NextResponse.json({ users: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, telegram_id, phone, balance, games_played, updated_at, created_at')
      .or(`username.ilike.%${term}%,phone.ilike.%${term}%,telegram_id.ilike.%${term}%`)
      .limit(limit)

    if (error) throw error

    const filtered = (data || []).filter((u: any) => Boolean(u.telegram_id))

    return NextResponse.json({ users: filtered })
  } catch (e: any) {
    console.error('Error in POST /api/admin/user-search:', e)
    return NextResponse.json({ error: e?.message || 'Failed to search users' }, { status: 500 })
  }
}
