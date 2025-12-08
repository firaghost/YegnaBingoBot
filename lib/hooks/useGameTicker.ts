import { useEffect, useRef, useState } from 'react'

/**
 * Hook to manage game progression via tick API
 * This replaces the server-side game loop to avoid Vercel timeout issues
 * Only ONE player (the first player in the list) should run the ticker
 * 
 * FALLBACK MECHANISM: If the game master disconnects and countdown gets stuck,
 * any player can take over after 5 seconds of inactivity
 */
export function useGameTicker(
  gameId: string | null,
  gameStatus: string | null,
  userId: string | null,
  players: string[],
  countdownTime?: number
) {
  const tickerRef = useRef<NodeJS.Timeout | null>(null)
  const isTickingRef = useRef(false)
  const lastCountdownValueRef = useRef<number | null>(null)
  const lastCountdownChangeRef = useRef<number>(Date.now())
  const [isFallbackMaster, setIsFallbackMaster] = useState(false)

  useEffect(() => {
    if (!gameId || !userId) return
    if (!gameStatus) return

    // Only tick for waiting_for_players, countdown, and active games
    // CRITICAL: waiting_for_players also needs ticking for the 30s countdown
    if (!['waiting_for_players', 'countdown', 'active'].includes(gameStatus || '')) {
      if (tickerRef.current) {
        clearInterval(tickerRef.current)
        tickerRef.current = null
        isTickingRef.current = false
        setIsFallbackMaster(false)
      }
      return
    }

    // CRITICAL: Only the first player in the list should run the ticker
    // This prevents duplicate number calls
    const isGameMaster = players.length > 0 && players[0] === userId

    // FALLBACK: If not game master, check if we should take over
    // This happens if countdown/waiting is stuck (no progress for 5+ seconds)
    let shouldTick = isGameMaster

    // Check for stuck state during waiting_for_players or countdown
    if (!isGameMaster && ['waiting_for_players', 'countdown'].includes(gameStatus || '') && countdownTime !== undefined) {
      // Check if countdown value has changed
      const currentTime = Date.now()

      if (lastCountdownValueRef.current !== countdownTime) {
        // Countdown changed, reset timer
        lastCountdownValueRef.current = countdownTime
        lastCountdownChangeRef.current = currentTime
      } else {
        // Countdown hasn't changed
        const stuckDuration = currentTime - lastCountdownChangeRef.current

        // If stuck for more than 5 seconds, take over as fallback master
        if (stuckDuration > 5000 && !isFallbackMaster) {
          console.warn(`⚠️ Game stuck at ${countdownTime}s (${gameStatus}) for ${Math.round(stuckDuration / 1000)}s, taking over as fallback game master`)
          setIsFallbackMaster(true)
          shouldTick = true
        } else if (isFallbackMaster) {
          // Continue as fallback master
          shouldTick = true
        }
      }
    } else {
      // Reset stuck tracking if we're game master or not in countdown/waiting
      lastCountdownValueRef.current = countdownTime ?? null
      lastCountdownChangeRef.current = Date.now()
      if (isFallbackMaster && isGameMaster) {
        setIsFallbackMaster(false)
      }
    }

    if (!shouldTick) {
      console.log('🎮 Not game master, skipping ticker')
      return
    }

    // Prevent multiple tickers - CRITICAL: Check and stop existing ticker first
    if (isTickingRef.current && tickerRef.current) {
      console.log('⚠️ Ticker already running, skipping duplicate')
      return
    }

    // Clear any existing ticker before starting new one
    if (tickerRef.current) {
      clearInterval(tickerRef.current)
      tickerRef.current = null
    }

    isTickingRef.current = true

    if (isFallbackMaster) {
      console.log('🔄 Fallback game master - taking over ticker')
    } else {
      console.log('👑 Game master - starting ticker for game:', gameId)
    }

    const tick = async () => {
      try {
        console.log(`🔄 Ticking game ${gameId} (status: ${gameStatus})...`)
        const response = await fetch('/api/game/tick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })

        if (!response.ok) {
          console.error('❌ Tick API error:', response.status, response.statusText)
          return
        }

        const result = await response.json()
        console.log('✅ Tick result:', result)

        // Reset stuck timer on successful tick
        lastCountdownChangeRef.current = Date.now()

        if (result.action === 'end' || result.action === 'none') {
          // Game ended, stop ticking
          console.log('🛑 Stopping ticker - game ended')
          if (tickerRef.current) {
            clearInterval(tickerRef.current)
            tickerRef.current = null
            isTickingRef.current = false
            setIsFallbackMaster(false)
          }
        }
      } catch (error) {
        console.error('❌ Error ticking game:', error)
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
  }, [gameId, gameStatus, userId, players, countdownTime])
}
