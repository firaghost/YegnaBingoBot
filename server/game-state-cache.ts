/**
 * In-Memory Game State Cache
 * Professional-grade game state management with minimal database load
 */

interface CachedGameState {
  id: string
  room_id: string
  status: 'waiting' | 'waiting_for_players' | 'countdown' | 'active' | 'finished'
  players: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  last_number_called: number | null
  last_called_at: string | null
  prize_pool: number
  stake: number
  winner_id: string | null
  countdown_time: number
  started_at: string | null
  ended_at: string | null
  created_at: string
  // Performance tracking
  _cache_updated_at: number
  _needs_db_sync: boolean
}

interface BroadcastOptions {
  immediate?: boolean // Force immediate broadcast
  skipCache?: boolean // Skip cache update
  priority?: 'high' | 'normal' | 'low'
}

class GameStateCache {
  private cache: Map<string, CachedGameState> = new Map()
  private pendingUpdates: Map<string, Partial<CachedGameState>> = new Map()
  private lastDbSync: Map<string, number> = new Map()
  private readonly SYNC_INTERVAL = 30000 // 30 seconds
  private readonly CACHE_TTL = 300000 // 5 minutes
  private syncTimer: NodeJS.Timeout | null = null
  
  constructor() {
    this.startPeriodicSync()
  }

  /**
   * Get game state from cache (instant)
   */
  get(gameId: string): CachedGameState | null {
    const state = this.cache.get(gameId)
    if (!state) return null
    
    // Check if cache is stale
    const age = Date.now() - state._cache_updated_at
    if (age > this.CACHE_TTL) {
      console.warn(`⚠️ Cache stale for game ${gameId} (${Math.round(age / 1000)}s old)`)
      return null
    }
    
    return state
  }

  /**
   * Set game state in cache
   */
  set(gameId: string, state: Partial<CachedGameState>, options: BroadcastOptions = {}): void {
    const existing = this.cache.get(gameId)
    const now = Date.now()
    
    const newState: CachedGameState = {
      ...(existing || {} as CachedGameState),
      ...state,
      id: gameId,
      _cache_updated_at: now,
      _needs_db_sync: true
    } as CachedGameState
    
    this.cache.set(gameId, newState)
    
    // Track pending updates for batch sync
    if (!options.skipCache) {
      const pending = this.pendingUpdates.get(gameId) || {}
      this.pendingUpdates.set(gameId, { ...pending, ...state })
    }
    
    // Immediate broadcast if requested
    if (options.immediate || options.priority === 'high') {
      this.broadcastUpdate(gameId, newState)
    }
  }

  /**
   * Update specific fields without full state replacement
   */
  update(gameId: string, updates: Partial<CachedGameState>, options: BroadcastOptions = {}): boolean {
    const existing = this.get(gameId)
    if (!existing) {
      console.warn(`⚠️ Cannot update non-existent game ${gameId}`)
      return false
    }
    
    this.set(gameId, updates, options)
    return true
  }

  /**
   * Broadcast update to all players via Socket.IO
   */
  private broadcastUpdate(gameId: string, state: CachedGameState): void {
    try {
      if (global.io) {
        // Broadcast to game room (try both formats for compatibility)
        global.io.to(`game-${gameId}`).to(gameId).emit('game_state_update', {
          gameId: state.id,
          status: state.status,
          called_numbers: state.called_numbers,
          latest_number: state.latest_number,
          countdown_time: state.countdown_time,
          prize_pool: state.prize_pool,
          winner_id: state.winner_id,
          players_count: state.players.length,
          timestamp: Date.now()
        })
        
        // Also emit specific events for better handling
        if (state.latest_number) {
          global.io.to(`game-${gameId}`).to(gameId).emit('number-called', {
            gameId,
            number: state.latest_number.number,
            letter: state.latest_number.letter,
            display: `${state.latest_number.letter}${state.latest_number.number}`,
            totalCalled: state.called_numbers.length,
            timestamp: new Date().toISOString()
          })
        }
      }
    } catch (error) {
      console.error(`❌ Broadcast error for game ${gameId}:`, error)
    }
  }

  /**
   * Load game state from database into cache
   */
  async loadFromDatabase(gameId: string): Promise<CachedGameState | null> {
    try {
      const { supabaseAdmin } = await import('../lib/supabase.js')
      const { data: game, error } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()
      
      if (error || !game) {
        console.error(`❌ Failed to load game ${gameId} from DB:`, error?.message)
        return null
      }
      
      const cachedState: CachedGameState = {
        ...game,
        _cache_updated_at: Date.now(),
        _needs_db_sync: false
      }
      
      this.cache.set(gameId, cachedState)
      this.lastDbSync.set(gameId, Date.now())
      
      console.log(`✅ Loaded game ${gameId} into cache`)
      return cachedState
    } catch (error) {
      console.error(`❌ Error loading game ${gameId}:`, error)
      return null
    }
  }

  /**
   * Sync pending updates to database (batch operation)
   */
  private async syncToDatabase(): Promise<void> {
    if (this.pendingUpdates.size === 0) return
    
    const updates = Array.from(this.pendingUpdates.entries())
    this.pendingUpdates.clear()
    
    console.log(`📦 Syncing ${updates.length} game(s) to database...`)
    
    try {
      const { supabaseAdmin } = await import('../lib/supabase.js')
      
      // Batch update all games
      for (const [gameId, changes] of updates) {
        const lastSync = this.lastDbSync.get(gameId) || 0
        const timeSinceSync = Date.now() - lastSync
        
        // Only sync if enough time has passed or it's critical
        if (timeSinceSync < this.SYNC_INTERVAL && !changes.winner_id && changes.status !== 'finished') {
          // Skip this sync, will catch it next time
          this.pendingUpdates.set(gameId, changes) // Re-add to pending
          continue
        }
        
        // Remove updated_at from changes as it may not exist in schema
        const { updated_at, _cache_updated_at, _needs_db_sync, ...dbChanges } = changes as any
        
        const { error } = await supabaseAdmin
          .from('games')
          .update(dbChanges)
          .eq('id', gameId)
        
        if (error) {
          console.error(`❌ Failed to sync game ${gameId}:`, error.message)
          // Re-add to pending for retry
          this.pendingUpdates.set(gameId, changes)
        } else {
          this.lastDbSync.set(gameId, Date.now())
          
          // Update cache to mark as synced
          const cached = this.cache.get(gameId)
          if (cached) {
            cached._needs_db_sync = false
          }
        }
      }
      
      console.log(`✅ Database sync completed`)
    } catch (error) {
      console.error(`❌ Database sync error:`, error)
    }
  }

  /**
   * Start periodic database sync
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    
    // Sync every 30 seconds
    this.syncTimer = setInterval(() => {
      this.syncToDatabase()
    }, this.SYNC_INTERVAL)
    
    console.log(`✅ Periodic database sync started (every ${this.SYNC_INTERVAL / 1000}s)`)
  }

  /**
   * Force immediate sync for critical updates
   */
  async forceSyncToDatabase(gameId: string): Promise<boolean> {
    const pending = this.pendingUpdates.get(gameId)
    if (!pending) return true
    
    try {
      const { supabaseAdmin } = await import('../lib/supabase.js')
      
      // Remove internal cache fields
      const { updated_at, _cache_updated_at, _needs_db_sync, ...dbChanges } = pending as any
      
      const { error } = await supabaseAdmin
        .from('games')
        .update(dbChanges)
        .eq('id', gameId)
      
      if (error) {
        console.error(`❌ Force sync failed for game ${gameId}:`, error.message)
        return false
      }
      
      this.pendingUpdates.delete(gameId)
      this.lastDbSync.set(gameId, Date.now())
      
      const cached = this.cache.get(gameId)
      if (cached) {
        cached._needs_db_sync = false
      }
      
      console.log(`✅ Force synced game ${gameId} to database`)
      return true
    } catch (error) {
      console.error(`❌ Force sync error:`, error)
      return false
    }
  }

  /**
   * Remove game from cache
   */
  remove(gameId: string): void {
    this.cache.delete(gameId)
    this.pendingUpdates.delete(gameId)
    this.lastDbSync.delete(gameId)
    console.log(`🗑️ Removed game ${gameId} from cache`)
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cached_games: number
    pending_updates: number
    memory_usage: string
    oldest_cache: number
  } {
    let oldestCache = Date.now()
    
    this.cache.forEach((state) => {
      if (state._cache_updated_at < oldestCache) {
        oldestCache = state._cache_updated_at
      }
    })
    
    const memoryUsage = (JSON.stringify(Array.from(this.cache.values())).length / 1024).toFixed(2)
    
    return {
      cached_games: this.cache.size,
      pending_updates: this.pendingUpdates.size,
      memory_usage: `${memoryUsage} KB`,
      oldest_cache: Date.now() - oldestCache
    }
  }

  /**
   * Cleanup stale cache entries
   */
  cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    this.cache.forEach((state, gameId) => {
      const age = now - state._cache_updated_at
      
      // Remove if stale or finished
      if (age > this.CACHE_TTL || state.status === 'finished') {
        this.remove(gameId)
        cleaned++
      }
    })
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale cache entries`)
    }
  }

  /**
   * Shutdown - sync all pending updates
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down game state cache...')
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
    
    // Force sync all pending updates
    await this.syncToDatabase()
    
    console.log('✅ Game state cache shutdown complete')
  }
}

// Export singleton instance
export const gameStateCache = new GameStateCache()

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await gameStateCache.shutdown()
})

process.on('SIGINT', async () => {
  await gameStateCache.shutdown()
})
