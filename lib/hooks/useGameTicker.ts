import { useEffect, useRef } from 'react'

/**
 * Hook to manage game progression via tick API
 * This replaces the server-side game loop to avoid Vercel timeout issues
 */
export function useGameTicker(gameId: string | null, gameStatus: string | null) {
  const tickerRef = useRef<NodeJS.Timeout | null>(null)
  const isTickingRef = useRef(false)

  useEffect(() => {
    if (!gameId) return
    if (!gameStatus) return
    
    // Only tick for countdown and active games
    if (gameStatus !== 'countdown' && gameStatus !== 'active') {
      if (tickerRef.current) {
        clearInterval(tickerRef.current)
        tickerRef.current = null
        isTickingRef.current = false
      }
      return
    }

    // Prevent multiple tickers
    if (isTickingRef.current) return
    isTickingRef.current = true

    const tick = async () => {
      try {
        const response = await fetch('/api/game/tick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })

        if (!response.ok) {
          console.error('Tick API error:', response.statusText)
          return
        }

        const result = await response.json()
        
        if (result.action === 'end' || result.action === 'none') {
          // Game ended, stop ticking
          if (tickerRef.current) {
            clearInterval(tickerRef.current)
            tickerRef.current = null
            isTickingRef.current = false
          }
        }
      } catch (error) {
        console.error('Error ticking game:', error)
      }
    }

    // Tick interval based on game status
    const interval = gameStatus === 'countdown' ? 1000 : 3000 // 1s for countdown, 3s for active
    
    // Initial tick
    tick()
    
    // Set up interval
    tickerRef.current = setInterval(tick, interval)

    return () => {
      if (tickerRef.current) {
        clearInterval(tickerRef.current)
        tickerRef.current = null
      }
      isTickingRef.current = false
    }
  }, [gameId, gameStatus])
}
