import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission, auditLog } from '@/lib/server/admin-permissions'

const supabase = supabaseAdmin

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, 'broadcast_manage')

    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))

    const patch: any = {}

    if (typeof body?.code === 'string') patch.code = body.code.trim()
    if (typeof body?.name === 'string') patch.name = body.name.trim()
    if (typeof body?.description === 'string' || body?.description === null) patch.description = body.description

    if (typeof body?.promo_type === 'string') patch.promo_type = body.promo_type
    if (body?.amount != null) patch.amount = Number(body.amount)
    if (typeof body?.currency === 'string') patch.currency = body.currency
    if (typeof body?.is_non_withdrawable === 'boolean') patch.is_non_withdrawable = body.is_non_withdrawable

    if (body?.wagering_multiplier != null) patch.wagering_multiplier = Number(body.wagering_multiplier)
    if (body?.min_deposit != null) patch.min_deposit = Number(body.min_deposit)
    if (body?.min_bet != null) patch.min_bet = Number(body.min_bet)

    if (body?.vip_tier_min === null || body?.vip_tier_min === undefined) patch.vip_tier_min = body.vip_tier_min
    else if (body?.vip_tier_min != null) patch.vip_tier_min = Number(body.vip_tier_min)

    if (typeof body?.game_code === 'string' || body?.game_code === null) patch.game_code = body.game_code
    if (body?.spin_count === null || body?.spin_count === undefined) patch.spin_count = body.spin_count
    else if (body?.spin_count != null) patch.spin_count = Number(body.spin_count)

    if (body?.spin_value === null || body?.spin_value === undefined) patch.spin_value = body.spin_value
    else if (body?.spin_value != null) patch.spin_value = Number(body.spin_value)

    if (typeof body?.start_at === 'string' || body?.start_at === null) patch.start_at = body.start_at
    if (typeof body?.end_at === 'string' || body?.end_at === null) patch.end_at = body.end_at

    if (typeof body?.image_url === 'string' || body?.image_url === null) patch.image_url = body.image_url
    if (Array.isArray(body?.tags)) patch.tags = body.tags

    if (typeof body?.is_enabled === 'boolean') {
      patch.is_enabled = body.is_enabled
      patch.disabled_at = body.is_enabled ? null : new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('promotions')
      .update(patch)
      .eq('id', id)
      .select(
        'id, code, name, description, promo_type, amount, currency, is_non_withdrawable, wagering_multiplier, min_deposit, min_bet, vip_tier_min, game_code, spin_count, spin_value, start_at, end_at, image_url, tags, is_enabled, disabled_at, created_at, updated_at'
      )
      .single()

    if (error || !data) throw error || new Error('Failed to update promotion')

    await auditLog(req, admin.id, 'promotion_update', { id, patch })

    return NextResponse.json({ promotion: data })
  } catch (e: any) {
    console.error('Error in PUT /api/admin/promotions/[id]:', e)
    return NextResponse.json({ error: e?.message || 'Failed to update promotion' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, 'broadcast_manage')

    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (error) throw error

    await auditLog(req, admin.id, 'promotion_delete', { id })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Error in DELETE /api/admin/promotions/[id]:', e)
    return NextResponse.json({ error: e?.message || 'Failed to delete promotion' }, { status: 500 })
  }
}
