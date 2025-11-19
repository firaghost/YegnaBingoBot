import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdminFromRequest } from '@/lib/server/admin-permissions'
import crypto from 'crypto'

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

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16)
  const iterations = 100000
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  return {
    password_hash: hash.toString('hex'),
    password_salt: salt.toString('hex'),
    password_iterations: iterations,
  }
}

async function logAudit(actorId: string, action: string, details: any, request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const path = request.nextUrl?.pathname || '/api/admin/users'
    await supabase
      .from('admin_audit_logs')
      .insert({ admin_id: actorId, action, details, path, ip })
  } catch (e) {
    console.warn('audit log failed:', e)
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request)
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, username, role, telegram_id, permissions, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin(request)
    const body = await request.json()
    const { username, password, role = 'admin', telegram_id, permissions } = body || {}
    if (!username || !password) throw new Error('username and password required')
    if (!['super_admin','admin','moderator'].includes(role)) throw new Error('invalid role')

    const lower = String(username).toLowerCase()
    const creds = hashPassword(password)

    const { data, error } = await supabase
      .from('admin_users')
      .insert({ username: lower, role, telegram_id: telegram_id || null, permissions: permissions && typeof permissions === 'object' ? permissions : {}, ...creds })
      .select('id, username, role, telegram_id, permissions, created_at, updated_at')
      .single()
    if (error) throw error
    await logAudit(actor.id, 'admin_create', { created_admin: data }, request)
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Allow super admin to update any admin. Non-super can update ONLY self (username/password)
    const actor = await getAdminFromRequest(request)
    const body = await request.json()
    const { id, username, password, role, permissions, old_password, new_password, confirm_password } = body || {}
    if (!id) throw new Error('id required')

    const update: any = {}
    const isSelf = actor.id === id
    const isSuper = actor.role === 'super_admin'
    if (username) update.username = String(username).toLowerCase()

    // Normalize password fields
    const desiredNew = typeof new_password === 'string' ? new_password : (typeof password === 'string' ? password : undefined)
    const desiredConfirm = typeof confirm_password === 'string' ? confirm_password : undefined
    const providedOld = typeof old_password === 'string' ? old_password : undefined

    if (desiredNew) {
      if (desiredConfirm !== undefined && desiredNew !== desiredConfirm) {
        throw new Error('New password and confirm password do not match')
      }
      if (!isSuper) {
        if (!isSelf) throw new Error('Forbidden')
        if (!providedOld) throw new Error('Old password is required')
        // Verify old password
        const { data: target } = await supabase
          .from('admin_users')
          .select('password_hash, password_salt, password_iterations')
          .eq('id', id)
          .single()
        if (!target) throw new Error('Admin not found')
        const saltBuf = Buffer.from(target.password_salt, 'hex')
        const hashBuf = crypto.pbkdf2Sync(providedOld, saltBuf, Number(target.password_iterations || 100000), 32, 'sha256')
        const ok = hashBuf.toString('hex') === String(target.password_hash)
        if (!ok) throw new Error('Old password is incorrect')
      }
      Object.assign(update, hashPassword(desiredNew))
    }

    if (isSuper) {
      if (role) {
        if (!['super_admin','admin','moderator'].includes(role)) throw new Error('invalid role')
        update.role = role
      }
      if (permissions && typeof permissions === 'object') {
        update.permissions = permissions
      }
    } else {
      // Non-super cannot change role/permissions or update others
      if (!isSelf) throw new Error('Forbidden')
      if (role || permissions) throw new Error('Forbidden')
      if (!username && !desiredNew) throw new Error('No fields to update')
    }

    const { data, error } = await supabase
      .from('admin_users')
      .update(update)
      .eq('id', id)
      .select('id, username, role, telegram_id, permissions, created_at, updated_at')
      .single()
    if (error) throw error
    await logAudit(actor.id, 'admin_update', { target_admin_id: id, update_fields: Object.keys(update) }, request)
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 })
  }
}
