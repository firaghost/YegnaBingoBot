import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/server/admin-permissions'

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    const { action } = await request.json()
    if (!['enable','disable'].includes(action)) throw new Error('Invalid action')

    const res = NextResponse.json({ ok: true, action })
    const isSecure = request.nextUrl.protocol === 'https:'
    if (action === 'enable') {
      res.cookies.set('maintenance_bypass', '1', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
    } else {
      res.cookies.set('maintenance_bypass', '0', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: 0
      })
    }
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 })
  }
}
