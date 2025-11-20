import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

const SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

const supabase = supabaseAdmin

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createAdminSession(
  res: NextResponse,
  adminId: string,
  req: NextRequest
) {
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  const userAgent = req.headers.get('user-agent') || ''

  try {
    await supabase.from('admin_sessions').insert({
      admin_id: adminId,
      token_hash: tokenHash,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ip,
      user_agent: userAgent,
    })
  } catch (e) {
    console.error('Failed to create admin session:', e)
  }

  const isSecure = req.nextUrl.protocol === 'https:'
  res.cookies.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })

  return res
}

export async function destroyAdminSession(res: NextResponse, req: NextRequest) {
  try {
    const cookie = req.cookies.get(SESSION_COOKIE)?.value
    if (cookie) {
      const tokenHash = hashToken(cookie)
      await supabase.from('admin_sessions').delete().eq('token_hash', tokenHash)
    }
  } catch (e) {
    console.error('Failed to destroy admin session:', e)
  }

  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return res
}

export async function getAdminFromSession(req: NextRequest): Promise<any> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (!cookie) throw new Error('Unauthorized')

  const tokenHash = hashToken(cookie)
  const nowIso = new Date().toISOString()

  const { data: session, error } = await supabase
    .from('admin_sessions')
    .select('admin_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !session) throw new Error('Unauthorized')
  if (session.expires_at <= nowIso) throw new Error('Session expired')

  // Touch last_seen_at but do not block on errors
  supabase
    .from('admin_sessions')
    .update({ last_seen_at: nowIso })
    .eq('token_hash', tokenHash)
    .then(() => {})
    .catch(() => {})

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('id, username, role, permissions')
    .eq('id', session.admin_id)
    .single()

  if (adminError || !admin) throw new Error('Unauthorized')
  return admin
}
