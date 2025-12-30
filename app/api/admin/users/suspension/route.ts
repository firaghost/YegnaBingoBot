import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminFromRequest, auditLog } from '@/lib/server/admin-permissions'
import { getConfig } from '@/lib/admin-config'

export const dynamic = 'force-dynamic'

const supabase = supabaseAdmin

function hasPermission(admin: any, key: string) {
  if (admin?.role === 'super_admin') return true
  const p = admin?.permissions || {}
  return Boolean((p as any)[key])
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)

    // Admins with users_manage can suspend; moderators only if config allows
    const canManageUsers = hasPermission(admin, 'users_manage')
    if (!canManageUsers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (admin.role === 'moderator') {
      const allowMods = Boolean(await getConfig('moderators_can_ban_users'))
      if (!allowMods) {
        return NextResponse.json({ error: 'Moderators are not allowed to suspend users' }, { status: 403 })
      }
    }

    const body = await request.json().catch(() => ({}))
    const userId = String(body?.userId || '').trim()
    const action = String(body?.action || '').trim() // 'suspend' | 'unsuspend'
    const reason = String(body?.reason || '').trim()

    if (!userId || (action !== 'suspend' && action !== 'unsuspend')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (action === 'suspend') {
      const nowIso = new Date().toISOString()
      const finalReason = reason || 'Manual suspension'

      const { error: updErr } = await supabase
        .from('users')
        .update({ status: 'inactive', suspension_reason: finalReason, suspended_at: nowIso })
        .eq('id', userId)

      if (updErr) throw updErr

      try {
        await supabase
          .from('user_suspensions')
          .insert({ user_id: userId, reason: finalReason, source: 'admin', context: { admin_id: admin.id } })
      } catch {
        // best-effort
      }

      await auditLog(request, admin.id, 'user_suspend', { target_user_id: userId, reason: finalReason })

      return NextResponse.json({ success: true })
    }

    // unsuspend
    const { error: updErr2 } = await supabase
      .from('users')
      .update({ status: 'active', suspension_reason: null })
      .eq('id', userId)

    if (updErr2) throw updErr2

    await auditLog(request, admin.id, 'user_unsuspend', { target_user_id: userId })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
