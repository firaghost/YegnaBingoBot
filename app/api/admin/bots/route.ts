import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

export async function GET(req: NextRequest) {
  await requirePermission(req, 'admin_manage')
  const { data, error } = await supabaseAdmin
    .from('bots')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bots: data })
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'admin_manage')
    const body = await req.json()

    if (Array.isArray(body?.seed_names)) {
      const names: string[] = body.seed_names
      const payload = names.map((name) => ({ name, difficulty: 'medium', behavior_profile: { mark_delay_ms: [500, 2000], error_rate: 0.1, check_bingo_interval_ms: [300, 800], chat_enabled: false, chat_messages: [], aggressiveness: 0.5 }, win_probability: 0.5 }))
      const { error } = await supabaseAdmin.from('bots').insert(payload).select('id')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const insert = {
      name: body.name,
      avatar: body.avatar ?? null,
      active: body.active ?? true,
      difficulty: body.difficulty ?? 'medium',
      behavior_profile: body.behavior_profile ?? { mark_delay_ms: [500, 2000], error_rate: 0.1, check_bingo_interval_ms: [300, 800], chat_enabled: false, chat_messages: [], aggressiveness: 0.5 },
      win_probability: typeof body.win_probability === 'number' ? Math.max(0, Math.min(1, body.win_probability)) : 0.5,
      waiting_mode: body.waiting_mode ?? 'always_waiting'
    }

    const { data, error } = await supabaseAdmin.from('bots').insert(insert).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bot: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}
