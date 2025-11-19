import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminFromRequest } from '@/lib/server/admin-permissions'

export const dynamic = 'force-dynamic'

const supabase = supabaseAdmin

async function requireSuperAdmin(request: NextRequest) {
  const adminId = request.headers.get('x-admin-id') || ''
  if (!adminId) throw new Error('Missing x-admin-id')
  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', adminId)
    .single()
  if (error || !admin) throw new Error('Unauthorized')
  if (admin.role !== 'super_admin') throw new Error('Forbidden')
  return admin
}

export async function GET(request: NextRequest) {
  try {
    const me = await getAdminFromRequest(request)
    if (me.role !== 'super_admin') throw new Error('Forbidden')
    const { searchParams } = new URL(request.url)
    const admin_id = searchParams.get('admin_id') || undefined
    const action = searchParams.get('action') || undefined
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500)
    const offset = Math.max(0, Number(searchParams.get('offset') || 0))

    let query = supabase
      .from('admin_audit_logs')
      .select('id, admin_id, action, details, path, ip, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (admin_id) query = query.eq('admin_id', admin_id)
    if (action) query = query.ilike('action', `%${action}%`)

    // Apply offset/limit using range
    const { data, error } = await (query as any).range(offset, Math.max(offset, offset + limit - 1))
    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 })
  }
}
