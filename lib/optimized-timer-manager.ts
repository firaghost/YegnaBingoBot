/**
 * Optimized Timer Manager for Free Tier Resource Management
 * Consolidates multiple game timers into a single master timer
 */

interface GameTimerConfig {
  gameId: string
  interval: number // milliseconds between number calls
  nextCallTime: number
  lastCallTime: number
  isActive: boolean
  callCount: number
}

interface GameCallbacks {
  onNumberCall: (gameId: string, callCount: number) => Promise<void>
  onGameEnd: (gameId: string, reason: string) => Promise<void>
}

export class OptimizedTimerManager {
  private masterTimer: NodeJS.Timeout | null = null
  private games = new Map<string, GameTimerConfig>()
  private callbacks: GameCallbacks
  private readonly MASTER_INTERVAL = 100 // 100ms precision
  private readonly MAX_CONCURRENT_GAMES = 5 // Free tier limit
  
  // Resource monitoring
  private lastMemoryCheck = 0
  private readonly MEMORY_CHECK_INTERVAL = 30000 // 30 seconds
  private readonly MAX_MEMORY_MB = 100 // Free tier memory limit

  constructor(callbacks: GameCallbacks) {
    this.callbacks = callbacks
    this.startMasterTimer()
    this.startResourceMonitoring()
  }

  /**
   * Add a game to the timer system
   */
  addGame(gameId: string, level: 'easy' | 'medium' | 'hard'): boolean {
    // Check if we can add more games (free tier limit)
    if (this.games.size >= this.MAX_CONCURRENT_GAMES) {
      console.warn(`🚫 Cannot add game ${gameId}: Max concurrent games (${this.MAX_CONCURRENT_GAMES}) reached`)
      return false
    }

    // Check memory pressure
    if (this.isMemoryConstrained()) {
      console.warn(`🚫 Cannot add game ${gameId}: Memory constrained`)
      return false
    }

    const interval = this.getIntervalForLevel(level)
    const now = Date.now()

    const config: GameTimerConfig = {
      gameId,
      interval,
      nextCallTime: now + interval,
      lastCallTime: now,
      isActive: true,
      callCount: 0
    }

    this.games.set(gameId, config)
    console.log(`✅ Added game ${gameId} to timer system (${level}: ${interval}ms interval)`)
    
    return true
  }

  /**
   * Remove a game from the timer system
   */
  removeGame(gameId: string): void {
    if (this.games.delete(gameId)) {
      console.log(`🗑️ Removed game ${gameId} from timer system`)
    }

    // Auto-cleanup if no games active
    if (this.games.size === 0) {
      this.pauseMasterTimer()
    }
  }

  /**
   * Pause a specific game's timer
   */
  pauseGame(gameId: string): void {
    const config = this.games.get(gameId)
    if (config) {
      config.isActive = false
      console.log(`⏸️ Paused timer for game ${gameId}`)
    }
  }

  /**
   * Resume a specific game's timer
   */
  resumeGame(gameId: string): void {
    const config = this.games.get(gameId)
    if (config) {
      config.isActive = true
      config.nextCallTime = Date.now() + config.interval
      console.log(`▶️ Resumed timer for game ${gameId}`)
      
      // Ensure master timer is running
      if (!this.masterTimer) {
        this.startMasterTimer()
      }
    }
  }

  /**
   * Single master timer that manages all games
   */
  private startMasterTimer(): void {
    if (this.masterTimer) return

    console.log(`🎯 Starting master timer (${this.MASTER_INTERVAL}ms precision)`)
    
    this.masterTimer = setInterval(() => {
      const now = Date.now()
      
      // Process all active games
      for (const [gameId, config] of this.games) {
        if (!config.isActive) continue

        // Check if it's time to call a number
        if (now >= config.nextCallTime) {
          this.processGameTick(gameId, config, now)
        }
      }

      // Periodic resource monitoring
      this.checkResourceUsage(now)
      
    }, this.MASTER_INTERVAL)
  }

  /**
   * Process a single game tick
   */
  private async processGameTick(gameId: string, config: GameTimerConfig, now: number): Promise<void> {
    try {
      config.callCount++
      config.lastCallTime = now
      config.nextCallTime = now + config.interval

      // Call the game's number calling logic
      await this.callbacks.onNumberCall(gameId, config.callCount)

      // Check if game should end (75 numbers called)
      if (config.callCount >= 75) {
        console.log(`🏁 Game ${gameId} completed all numbers`)
        await this.callbacks.onGameEnd(gameId, 'numbers_exhausted')
        this.removeGame(gameId)
      }

    } catch (error) {
      console.error(`❌ Error processing game tick for ${gameId}:`, error)
      
      // Remove problematic games to prevent resource leaks
      this.removeGame(gameId)
      await this.callbacks.onGameEnd(gameId, 'error')
    }
  }

  /**
   * Pause master timer when no games are active
   */
  private pauseMasterTimer(): void {
    if (this.masterTimer) {
      clearInterval(this.masterTimer)
      this.masterTimer = null
      console.log(`⏸️ Master timer paused (no active games)`)
    }
  }

  /**
   * Resource monitoring and auto-scaling
   */
  private checkResourceUsage(now: number): void {
    // Only check every 30 seconds to avoid overhead
    if (now - this.lastMemoryCheck < this.MEMORY_CHECK_INTERVAL) return
    
    this.lastMemoryCheck = now
    
    const usage = process.memoryUsage()
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024)
    
    console.log(`📊 Resource usage: ${heapUsedMB}MB heap, ${this.games.size} active games`)
    
    // Auto-scale if memory constrained
    if (heapUsedMB > this.MAX_MEMORY_MB) {
      console.warn(`⚠️ Memory pressure detected (${heapUsedMB}MB > ${this.MAX_MEMORY_MB}MB)`)
      this.emergencyCleanup()
    }
  }

  /**
   * Emergency cleanup when resources are constrained
   */
  private emergencyCleanup(): void {
    console.log(`🚨 Emergency cleanup initiated`)
    
    // Find oldest/least active games to remove
    const gamesByActivity = Array.from(this.games.entries())
      .sort(([, a], [, b]) => a.lastCallTime - b.lastCallTime)
    
    // Remove oldest 50% of games
    const gamesToRemove = gamesByActivity.slice(0, Math.ceil(gamesByActivity.length / 2))
    
    for (const [gameId] of gamesToRemove) {
      console.log(`🧹 Emergency cleanup: Removing game ${gameId}`)
      this.callbacks.onGameEnd(gameId, 'resource_cleanup')
      this.removeGame(gameId)
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
      console.log(`🗑️ Forced garbage collection`)
    }
  }

  /**
   * Check if system is memory constrained
   */
  private isMemoryConstrained(): boolean {
    const usage = process.memoryUsage()
    const heapUsedMB = usage.heapUsed / 1024 / 1024
    return heapUsedMB > (this.MAX_MEMORY_MB * 0.8) // 80% threshold
  }

  /**
   * Get interval based on game level
   */
  private getIntervalForLevel(level: 'easy' | 'medium' | 'hard'): number {
    switch (level) {
      case 'easy': return 3000   // 3 seconds
      case 'medium': return 2000 // 2 seconds  
      case 'hard': return 1000   // 1 second
      default: return 2000
    }
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    // Monitor every 5 minutes
    setInterval(() => {
      const stats = this.getStats()
      console.log(`📈 Timer Manager Stats:`, stats)
      
      // Log to external monitoring if needed
      this.logToMonitoring(stats)
    }, 5 * 60 * 1000)
  }

  /**
   * Get system statistics
   */
  getStats() {
    const usage = process.memoryUsage()
    
    return {
      activeGames: this.games.size,
      maxConcurrentGames: this.MAX_CONCURRENT_GAMES,
      masterTimerActive: !!this.masterTimer,
      memoryUsageMB: Math.round(usage.heapUsed / 1024 / 1024),
      maxMemoryMB: this.MAX_MEMORY_MB,
      memoryPressure: this.isMemoryConstrained(),
      gameDetails: Array.from(this.games.entries()).map(([gameId, config]) => ({
        gameId,
        callCount: config.callCount,
        isActive: config.isActive,
        interval: config.interval
      }))
    }
  }

  /**
   * Log to external monitoring service (optional)
   */
  private logToMonitoring(stats: any): void {
    // Could integrate with services like:
    // - Sentry for error tracking
    // - LogRocket for performance monitoring  
    // - Custom webhook for alerts
    
    if (stats.memoryPressure) {
      console.warn(`🚨 Memory pressure alert:`, stats)
      // Send alert to monitoring service
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    console.log(`🛑 Shutting down timer manager`)
    
    if (this.masterTimer) {
      clearInterval(this.masterTimer)
      this.masterTimer = null
    }
    
    // Notify all games of shutdown
    for (const [gameId] of this.games) {
      this.callbacks.onGameEnd(gameId, 'server_shutdown')
    }
    
    this.games.clear()
    console.log(`✅ Timer manager shutdown complete`)
  }
}

// Export singleton instance
export const optimizedTimerManager = new OptimizedTimerManager({
  onNumberCall: async (gameId: string, callCount: number) => {
    // This will be implemented in the main server file
    console.log(`📢 Game ${gameId}: Call number ${callCount}`)
  },
  onGameEnd: async (gameId: string, reason: string) => {
    // This will be implemented in the main server file  
    console.log(`🏁 Game ${gameId} ended: ${reason}`)
  }
})
