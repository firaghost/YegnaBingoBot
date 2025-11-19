import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export type AdminRecord = {
  id: string
  username: string
  role: 'super_admin' | 'admin' | 'moderator'
  permissions?: Record<string, boolean>
}

export async function getAdminFromRequest(req: NextRequest): Promise<AdminRecord> {
  const adminId = req.headers.get('x-admin-id') || ''
  if (!adminId) throw new Error('Missing x-admin-id')
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, role, permissions')
    .eq('id', adminId)
    .single()
  if (error || !data) throw new Error('Unauthorized')
  return data as AdminRecord
}

export async function requireAnyPermission(req: NextRequest, perms: string[]): Promise<AdminRecord> {
  const admin = await getAdminFromRequest(req)
  if (admin.role === 'super_admin') return admin
  const p = admin.permissions || {}
  const ok = perms.some(k => Boolean((p as any)[k]))
  if (!ok) throw new Error('Forbidden')
  return admin
}

export async function requirePermission(req: NextRequest, perm: string): Promise<AdminRecord> {
  return requireAnyPermission(req, [perm])
}

export async function auditLog(req: NextRequest, actorId: string, action: string, details: any = {}) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    const path = req.nextUrl?.pathname || ''
    await supabase.from('admin_audit_logs').insert({ admin_id: actorId, action, details, path, ip })
  } catch {}
}
