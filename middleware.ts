import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Paths that should be accessible during maintenance
const maintenanceAllowedPaths = [
  '/mgmt-portal-x7k9p2', // Admin panel
  '/api/admin', // Admin APIs
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

  try {
    // Check if maintenance mode is enabled
    const { data: maintenanceConfig } = await supabaseAdmin
      .from('admin_config')
      .select('config_value')
      .eq('config_key', 'maintenance_mode')
      .eq('is_active', true)
      .single()

    const isMaintenanceMode = maintenanceConfig?.config_value === 'true' || maintenanceConfig?.config_value === true

    if (isMaintenanceMode && pathname !== '/maintenance') {
      // Redirect to maintenance page
      return NextResponse.redirect(new URL('/maintenance', request.url))
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
        .single()

      const isRegistrationEnabled = registrationConfig?.config_value !== 'false'

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
