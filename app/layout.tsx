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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <script dangerouslySetInnerHTML={{ __html: `try{if(window.Telegram&&Telegram.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand();document.documentElement.classList.add('tg-webapp');}}catch(e){}` }} />
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
        <div className="safe-area min-h-[100dvh] flex flex-col">
          {/* Top spacer to avoid Telegram overlays cropping the header */}
          <div className="tg-top-spacer" />
          <Suspense fallback={null}>
            <DeepLinkRouter />
          </Suspense>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </div>
      </body>
    </html>
  )
}
