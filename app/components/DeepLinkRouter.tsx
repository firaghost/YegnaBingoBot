"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Routes users to /game/[roomId] when opened via Telegram Mini App deep-link
// Supports:
// - Telegram WebApp: Telegram.WebApp.initDataUnsafe.start_param
// - Query param injected by Telegram: tgWebAppStartParam
// - Fallback: startapp or start_param in URL (useful in testing)
export default function DeepLinkRouter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    try {
      // 1) From Telegram WebApp object
      const startFromTG = (typeof window !== 'undefined' && (window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param) as string | undefined

      // 2) From URL query (Telegram appends tgWebAppStartParam)
      const startFromQuery = searchParams?.get('tgWebAppStartParam') || searchParams?.get('startapp') || searchParams?.get('start_param') || undefined

      const raw = (startFromTG || startFromQuery || '').toString()
      if (!raw) return

      // Expecting "room_<roomId>"
      const match = raw.match(/^room_(.+)$/)
      if (!match) return

      const roomId = match[1]
      const target = `/game/${roomId}`

      // Avoid redirect loops
      if (pathname === target) return

      // Replace to avoid back-navigation to landing URL with tg params
      router.replace(target)
    } catch (e) {
      console.warn('DeepLinkRouter failed:', e)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
