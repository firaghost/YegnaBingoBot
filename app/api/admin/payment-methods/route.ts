import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAnyPermission, requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, ['settings_view','deposits_manage'])
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch payment methods' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'settings_manage')
    const body = await request.json()
    const payload = Array.isArray(body) ? body : [body]

    const upserts = payload.map((pm: any) => ({
      id: pm.id || undefined,
      name: pm.name,
      enabled: Boolean(pm.enabled),
      instructions: pm.instructions ?? null,
      min_amount: pm.min_amount != null ? Number(pm.min_amount) : null,
      max_amount: pm.max_amount != null ? Number(pm.max_amount) : null,
      fee_rate: pm.fee_rate != null ? Number(pm.fee_rate) : null,
      bonus_percent: pm.bonus_percent != null ? Number(pm.bonus_percent) : null,
      last_updated: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('payment_methods')
      .upsert(upserts, { onConflict: 'name' })
      .select('*')

    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save payment methods' }, { status: 500 })
  }
}
