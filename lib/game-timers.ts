// Shared module to track active countdown timers across API routes
// This prevents duplicate timers when multiple players join

export const activeCountdownTimers = new Map<string, NodeJS.Timeout>()

export function clearGameTimer(gameId: string) {
  const timer = activeCountdownTimers.get(gameId)
  if (timer) {
    clearTimeout(timer)
    activeCountdownTimers.delete(gameId)
    console.log(`🧹 Cleared countdown timer for game ${gameId}`)
    return true
  }
  return false
}

export function hasActiveTimer(gameId: string): boolean {
  return activeCountdownTimers.has(gameId)
}

export function setGameTimer(gameId: string, timer: NodeJS.Timeout) {
  activeCountdownTimers.set(gameId, timer)
}
