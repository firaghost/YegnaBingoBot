import './globals.css'
import type { Metadata } from 'next'
import DeepLinkRouter from './components/DeepLinkRouter'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'BingoX - BingoX Bingo',
  description: 'Welcome to BingoX!',
  icons: {
    icon: '/favicon.ico',
  },
}

// Ensure Node.js runtime for server components using Supabase and other Node APIs
export const runtime = 'nodejs'
// Avoid static prerender errors caused by hooks like useSearchParams across pages
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SOCKET = (process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app')
  return (
    <html lang="en">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        {SUPABASE && (
          <>
            <link rel="preconnect" href={SUPABASE} crossOrigin="" />
            <link rel="dns-prefetch" href={SUPABASE} />
          </>
        )}
        {SOCKET && (
          <>
            <link rel="preconnect" href={SOCKET} crossOrigin="" />
            <link rel="dns-prefetch" href={SOCKET} />
          </>
        )}
      </head>
      <body className="antialiased bg-slate-950 text-slate-50">
        <Suspense fallback={null}>
          <DeepLinkRouter />
        </Suspense>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </body>
    </html>
  )
}
