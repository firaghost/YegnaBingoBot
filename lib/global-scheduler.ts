import { OptimizedTimerManager } from './optimized-timer-manager'

// [ADDED FOR CAPACITY FIX]
// A thin wrapper around OptimizedTimerManager that allows registering per-game tick callbacks
// without coupling the timer manager to game logic. This ensures a single master timer drives
// all games, avoiding per-game setInterval overload.

type TickFn = () => Promise<void> | void

class GlobalScheduler {
  private manager: OptimizedTimerManager
  private callbacks = new Map<string, TickFn>() // gameId -> tick fn

  constructor() {
    this.manager = new OptimizedTimerManager({
      onNumberCall: async (gameId: string) => {
        const fn = this.callbacks.get(gameId)
        if (fn) {
          try { await fn() } catch (e) { /* swallow errors per tick */ }
        }
      },
      onGameEnd: async (gameId: string) => {
        this.callbacks.delete(gameId)
      }
    })
  }

  registerGame(gameId: string, intervalMs: number, tick: TickFn) {
    this.callbacks.set(gameId, tick)
    this.manager.addGame(gameId, (intervalMs as any) || 2000)
  }

  unregisterGame(gameId: string) {
    this.callbacks.delete(gameId)
    this.manager.removeGame(gameId)
  }

  stats() {
    return this.manager.getStats()
  }

  shutdown() {
    this.callbacks.clear()
    this.manager.shutdown()
  }
}

// Singleton
export const globalScheduler = new GlobalScheduler()
