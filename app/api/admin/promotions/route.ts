import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission, auditLog } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

type PromoSort = 'newest' | 'highest_value' | 'expiring_soon'

type PromoTab = 'all' | 'active' | 'scheduled' | 'expired'

function computeStatus(p: any, now: Date): 'active' | 'scheduled' | 'expired' | 'disabled' {
  if (!p.is_enabled) return 'disabled'
  const startAt = p.start_at ? new Date(p.start_at) : null
  const endAt = p.end_at ? new Date(p.end_at) : null
  if (startAt && startAt.getTime() > now.getTime()) return 'scheduled'
  if (endAt && endAt.getTime() <= now.getTime()) return 'expired'
  return 'active'
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'broadcast_manage')

    const sp = req.nextUrl.searchParams
    const search = (sp.get('search') || '').trim().toLowerCase()
    const tab = (sp.get('tab') || 'all') as PromoTab
    const sort = (sp.get('sort') || 'newest') as PromoSort
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 50)))

    const { data, error } = await supabase
      .from('promotions')
      .select(
        'id, code, name, description, promo_type, amount, currency, is_non_withdrawable, wagering_multiplier, min_deposit, min_bet, vip_tier_min, game_code, spin_count, spin_value, start_at, end_at, image_url, tags, is_enabled, disabled_at, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const now = new Date()

    let rows = (data || []) as any[]

    if (search) {
      rows = rows.filter((p) => {
        const hay = `${p.name || ''} ${p.code || ''} ${(p.tags || []).join(' ')} ${p.promo_type || ''}`.toLowerCase()
        return hay.includes(search)
      })
    }

    if (tab !== 'all') {
      rows = rows.filter((p) => {
        const status = computeStatus(p, now)
        if (tab === 'expired') return status === 'expired' || status === 'disabled'
        return status === tab
      })
    }

    if (sort === 'highest_value') {
      rows = rows.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    } else if (sort === 'expiring_soon') {
      rows = rows.sort((a, b) => {
        const aEnd = a.end_at ? new Date(a.end_at).getTime() : Number.POSITIVE_INFINITY
        const bEnd = b.end_at ? new Date(b.end_at).getTime() : Number.POSITIVE_INFINITY
        return aEnd - bEnd
      })
    } else {
      rows = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return NextResponse.json({ promotions: rows })
  } catch (e: any) {
    console.error('Error in GET /api/admin/promotions:', e)
    return NextResponse.json({ error: e?.message || 'Failed to load promotions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, 'broadcast_manage')

    const body = await req.json().catch(() => ({}))

    const code = String(body?.code || '').trim()
    const name = String(body?.name || '').trim()

    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const insert = {
      code,
      name,
      description: typeof body?.description === 'string' ? body.description : null,
      promo_type: body?.promo_type,
      amount: Number(body?.amount || 0),
      currency: typeof body?.currency === 'string' ? body.currency : 'ETB',
      is_non_withdrawable: Boolean(body?.is_non_withdrawable ?? true),
      wagering_multiplier: Number(body?.wagering_multiplier || 0),
      min_deposit: Number(body?.min_deposit || 0),
      min_bet: Number(body?.min_bet || 0),
      vip_tier_min: body?.vip_tier_min == null ? null : Number(body.vip_tier_min),
      game_code: typeof body?.game_code === 'string' ? body.game_code : null,
      spin_count: body?.spin_count == null ? null : Number(body.spin_count),
      spin_value: body?.spin_value == null ? null : Number(body.spin_value),
      start_at: body?.start_at || null,
      end_at: body?.end_at || null,
      image_url: typeof body?.image_url === 'string' ? body.image_url : null,
      tags: Array.isArray(body?.tags) ? body.tags : [],
      is_enabled: typeof body?.is_enabled === 'boolean' ? body.is_enabled : true,
      created_by: admin.id,
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert(insert)
      .select(
        'id, code, name, description, promo_type, amount, currency, is_non_withdrawable, wagering_multiplier, min_deposit, min_bet, vip_tier_min, game_code, spin_count, spin_value, start_at, end_at, image_url, tags, is_enabled, disabled_at, created_at, updated_at'
      )
      .single()

    if (error || !data) throw error || new Error('Failed to create promotion')

    await auditLog(req, admin.id, 'promotion_create', { id: data.id, code: data.code })

    return NextResponse.json({ promotion: data })
  } catch (e: any) {
    console.error('Error in POST /api/admin/promotions:', e)
    return NextResponse.json({ error: e?.message || 'Failed to create promotion' }, { status: 500 })
  }
}
