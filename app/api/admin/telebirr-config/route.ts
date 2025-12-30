import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAnyPermission, requirePermission } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

type TelebirrConfigResponse = {
  enabled: boolean
  apiKey: string
}

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, ['settings_view', 'deposits_manage'])

    const { data, error } = await supabase
      .from('admin_config')
      .select('config_key, config_value')
      .in('config_key', ['telebirr_enabled', 'telebirr_api_key'])
      .eq('is_active', true)

    if (error) throw error

    const map = new Map<string, any>()
    for (const row of data || []) {
      let v: any = row.config_value
      if (typeof v === 'string') {
        try {
          v = JSON.parse(v)
        } catch {
          // keep as string
        }
      }
      map.set(row.config_key, v)
    }

    const enabled = Boolean(map.get('telebirr_enabled'))
    const apiKeyRaw = map.get('telebirr_api_key')
    const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw : apiKeyRaw == null ? '' : String(apiKeyRaw)

    const resp: TelebirrConfigResponse = { enabled, apiKey }
    return NextResponse.json({ success: true, data: resp })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load Telebirr config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'settings_manage')

    const adminId = request.headers.get('x-admin-id') || null

    const body = await request.json().catch(() => ({}))
    const enabled = Boolean(body?.enabled)
    const apiKey = String(body?.apiKey || '').trim()

    const now = new Date().toISOString()

    const upserts = [
      {
        config_key: 'telebirr_enabled',
        config_value: JSON.stringify(enabled),
        is_active: true,
        updated_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        config_key: 'telebirr_api_key',
        config_value: JSON.stringify(apiKey),
        is_active: true,
        updated_by: adminId,
        created_at: now,
        updated_at: now,
      },
    ]

    const { error: upErr } = await supabase.from('admin_config').upsert(upserts as any, { onConflict: 'config_key' })
    if (upErr) throw upErr

    const { error: pmErr } = await supabase
      .from('payment_methods')
      .upsert(
        {
          name: 'Telebirr',
          enabled,
          last_updated: now,
        } as any,
        { onConflict: 'name' }
      )

    if (pmErr) throw pmErr

    return NextResponse.json({ success: true, data: { enabled, apiKey } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save Telebirr config' }, { status: 500 })
  }
}
