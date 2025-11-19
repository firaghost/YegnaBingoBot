import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const supabase = supabaseAdmin

function verifyPassword(password: string, hashHex: string, saltHex: string, iterations: number = 100000) {
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const computed = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex')
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hashHex, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) throw new Error('username and password required')

    const lower = String(username).toLowerCase()
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username, role, permissions, password_hash, password_salt, password_iterations')
      .eq('username', lower)
      .maybeSingle()

    if (error) throw error
    if (!admin) throw new Error('Invalid username or password')

    const ok = verifyPassword(
      password,
      admin.password_hash || '',
      admin.password_salt || '',
      Number(admin.password_iterations || 100000)
    )
    if (!ok) throw new Error('Invalid username or password')

    const { password_hash, password_salt, password_iterations, ...safe } = admin

    return NextResponse.json({ data: safe })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Login failed' }, { status: 400 })
  }
}
