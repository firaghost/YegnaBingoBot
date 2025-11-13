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
  return (
    <html lang="en">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
