import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

const USER_SESSION_COOKIE = 'user_session'
const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const supabase = supabaseAdmin

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createUserSession(
  res: NextResponse,
  userId: string,
  req: NextRequest,
) {
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + USER_SESSION_TTL_MS)

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  const userAgent = req.headers.get('user-agent') || ''

  try {
    await supabase.from('user_sessions').insert({
      user_id: userId,
      token_hash: tokenHash,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ip,
      user_agent: userAgent,
    })
  } catch (e) {
    console.error('Failed to create user session:', e)
  }

  const isSecure = req.nextUrl.protocol === 'https:'
  res.cookies.set(USER_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(USER_SESSION_TTL_MS / 1000),
  })

  return res
}

export async function destroyUserSession(res: NextResponse, req: NextRequest) {
  try {
    const cookie = req.cookies.get(USER_SESSION_COOKIE)?.value
    if (cookie) {
      const tokenHash = hashToken(cookie)
      await supabase.from('user_sessions').delete().eq('token_hash', tokenHash)
    }
  } catch (e) {
    console.error('Failed to destroy user session:', e)
  }

  res.cookies.set(USER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return res
}

export async function getUserFromSession(req: NextRequest) {
  const cookie = req.cookies.get(USER_SESSION_COOKIE)?.value
  if (!cookie) throw new Error('Unauthorized')

  const tokenHash = hashToken(cookie)
  const nowIso = new Date().toISOString()

  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !session) throw new Error('Unauthorized')
  if (session.expires_at <= nowIso) throw new Error('Session expired')

  // Touch last_seen_at but do not block on errors
  supabase
    .from('user_sessions')
    .update({ last_seen_at: nowIso })
    .eq('token_hash', tokenHash)
    .then(() => {})
    .catch(() => {})

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .maybeSingle()

  if (userError || !user) throw new Error('Unauthorized')
  return user
}
