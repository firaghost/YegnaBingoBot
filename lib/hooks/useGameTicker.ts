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
    
    // Only tick for countdown and active games
    if (gameStatus !== 'countdown' && gameStatus !== 'active') {
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
    // This happens if countdown is stuck (no progress for 5+ seconds)
    let shouldTick = isGameMaster
    
    if (!isGameMaster && gameStatus === 'countdown' && countdownTime !== undefined) {
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
          console.warn(`⚠️ Countdown stuck at ${countdownTime} for ${Math.round(stuckDuration/1000)}s, taking over as fallback game master`)
          setIsFallbackMaster(true)
          shouldTick = true
        } else if (isFallbackMaster) {
          // Continue as fallback master
          shouldTick = true
        }
      }
    } else {
      // Reset stuck tracking if we're game master or not in countdown
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

    // Prevent multiple tickers
    if (isTickingRef.current) return
    isTickingRef.current = true
    
    if (isFallbackMaster) {
      console.log('🔄 Fallback game master - taking over ticker')
    } else {
      console.log('👑 Game master - starting ticker')
    }

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
        
        // Reset stuck timer on successful tick
        lastCountdownChangeRef.current = Date.now()
        
        if (result.action === 'end' || result.action === 'none') {
          // Game ended, stop ticking
          if (tickerRef.current) {
            clearInterval(tickerRef.current)
            tickerRef.current = null
            isTickingRef.current = false
            setIsFallbackMaster(false)
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
  }, [gameId, gameStatus, userId, players, isFallbackMaster, countdownTime])
}
