import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Paths that should be accessible during maintenance
const maintenanceAllowedPaths = [
  '/mgmt-portal-x7k9p2', // Admin panel
  '/api/admin', // Admin APIs
  '/api/maintenance', // Maintenance helper APIs (bypass)
  '/maintenance', // Maintenance page
  '/_next', // Next.js assets
  '/favicon.ico',
  '/api/auth' // Authentication APIs
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for allowed paths during maintenance
  const isAllowedPath = maintenanceAllowedPaths.some(path => 
    pathname.startsWith(path)
  )

  if (isAllowedPath) {
    return NextResponse.next()
  }

  // If this browser has an explicit maintenance bypass cookie, allow
  try {
    const bypass = request.cookies.get('maintenance_bypass')?.value
    if (bypass === '1') {
      return NextResponse.next()
    }
  } catch {}

  try {
    // Check if maintenance mode is enabled
    const { data: configs } = await supabaseAdmin
      .from('admin_config')
      .select('config_key, config_value')
      .in('config_key', ['maintenance_mode','maintenance_bypass_user_ids','maintenance_bypass_telegram_ids','maintenance_bypass_usernames'])
      .eq('is_active', true)

    const getVal = (key: string) => {
      const row = (configs || []).find((r: any) => r.config_key === key)
      return row?.config_value
    }

    const mmVal = getVal('maintenance_mode')
    const isMaintenanceMode = mmVal === 'true' || mmVal === true

    if (isMaintenanceMode && pathname !== '/maintenance') {
      // Check user whitelist from cookies
      const uid = request.cookies.get('uid')?.value || ''
      const tgid = request.cookies.get('tgid')?.value || ''
      const uname = request.cookies.get('uname')?.value || ''

      const parseArray = (v: any): string[] => {
        try {
          if (Array.isArray(v)) return v.map(String)
          if (typeof v === 'string') return JSON.parse(v)
        } catch {}
        return []
      }

      const wUserIds = parseArray(getVal('maintenance_bypass_user_ids'))
      const wTgIds = parseArray(getVal('maintenance_bypass_telegram_ids'))
      const wUsernames = parseArray(getVal('maintenance_bypass_usernames'))

      const isWhitelisted = (uid && wUserIds.includes(uid)) || (tgid && wTgIds.includes(tgid)) || (uname && wUsernames.includes(uname))

      if (!isWhitelisted) {
        // Redirect to maintenance page
        return NextResponse.redirect(new URL('/maintenance', request.url))
      }
    }

    // If maintenance mode is disabled and user is on maintenance page, redirect them
    if (!isMaintenanceMode && pathname === '/maintenance') {
      // Redirect to home page (they'll be redirected to lobby if logged in via client-side logic)
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Check if registration is enabled for signup/login pages
    if (pathname === '/login' || pathname === '/register') {
      const { data: registrationConfig } = await supabaseAdmin
        .from('admin_config')
        .select('config_value')
        .eq('config_key', 'registration_enabled')
        .eq('is_active', true)
        .maybeSingle()

      const isRegistrationEnabled = !registrationConfig || registrationConfig?.config_value !== 'false'

      if (!isRegistrationEnabled && pathname === '/register') {
        // Redirect to login if registration is disabled
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

  } catch (error) {
    console.error('Middleware error:', error)
    // Continue normally if there's an error checking config
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
