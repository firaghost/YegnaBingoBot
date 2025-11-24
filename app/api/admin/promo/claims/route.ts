import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'broadcast_manage')

    const body = await req.json().catch(() => ({}))
    const broadcastId: string | null = body?.broadcastId || null

    if (!broadcastId) {
      return NextResponse.json({ claims: [] })
    }

    const { data, error } = await supabase
      .from('tournament_promos')
      .select('id, code, amount, status, used_at, user_id, broadcast_id, users:users(id, username, telegram_id, phone)')
      .eq('broadcast_id', broadcastId)
      .eq('status', 'used')
      .order('used_at', { ascending: false })

    if (error || !data) {
      console.error('Error loading promo claims:', error)
      return NextResponse.json({ claims: [] })
    }

    const claims = (data as any[]).map((row) => ({
      id: row.id as string,
      code: row.code as string,
      amount: Number(row.amount || 0),
      used_at: row.used_at as string | null,
      user_id: row.user_id as string,
      username: row.users?.username || null,
      telegram_id: row.users?.telegram_id || null,
      phone: row.users?.phone || null,
    }))

    return NextResponse.json({ claims })
  } catch (e: any) {
    console.error('Error in POST /api/admin/promo/claims:', e)
    return NextResponse.json({ error: e.message || 'Failed to load claims' }, { status: 500 })
  }
}
