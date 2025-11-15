import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BingoX - BingoX Bingo',
  description: 'Welcome to BingoX!',
  icons: {
    icon: '/favicon.ico',
  },
}

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
      <body className="antialiased">{children}</body>
    </html>
  )
}
