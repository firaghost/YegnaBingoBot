import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAdminSession } from '@/lib/server/admin-session'
import { checkLoginRateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { telegramId, username } = await request.json()
    if (!telegramId || !username) {
      throw new Error('telegramId and username are required')
    }

    const rl = await checkLoginRateLimit(request, username)
    if (!rl.ok) {
      const headers: Record<string, string> = {}
      if (rl.retryAfterMs != null) {
        headers['Retry-After'] = Math.ceil(rl.retryAfterMs / 1000).toString()
      }
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers }
      )
    }

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, telegram_id, username, role, permissions')
      .eq('telegram_id', telegramId)
      .maybeSingle()

    if (error) throw error
    if (!admin) {
      throw new Error('Unauthorized: You are not an admin')
    }

    const res = await createAdminSession(NextResponse.json({ data: admin }), admin.id, request)
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Login failed' }, { status: 400 })
  }
}
