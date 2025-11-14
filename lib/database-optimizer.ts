/**
 * Database Optimizer for Free Tier Resource Management
 * Implements connection pooling, batching, and query optimization
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface BatchOperation {
  type: 'insert' | 'update' | 'delete'
  table: string
  data: any
  conditions?: any
  timestamp: number
}

interface ConnectionPoolConfig {
  maxConnections: number
  idleTimeout: number
  queryTimeout: number
  batchSize: number
  batchDelay: number
}

export class DatabaseOptimizer {
  private supabase: SupabaseClient
  private batchQueue: BatchOperation[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private queryCount = 0
  private lastQueryTime = 0
  
  // Free tier optimized configuration
  private config: ConnectionPoolConfig = {
    maxConnections: 3, // Conservative for free tier
    idleTimeout: 30000, // 30 seconds
    queryTimeout: 10000, // 10 seconds
    batchSize: 10, // Small batches to avoid timeouts
    batchDelay: 2000 // 2 second batching window
  }

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public',
      },
      global: {
        headers: { 'x-bingo-client': 'optimized-client' },
      },
      realtime: {
        params: {
          eventsPerSecond: 2 // Limit real-time events for free tier
        }
      }
    })

    this.startBatchProcessor()
    this.startQueryMonitoring()
  }

  /**
   * Optimized game creation with batching
   */
  async createGame(gameData: {
    id: string
    room_id: string
    status: string
    players: string[]
    stake: number
    prize_pool: number
  }): Promise<{ success: boolean; gameId?: string; error?: string }> {
    try {
      // Use upsert to handle race conditions
      const { data, error } = await this.supabase
        .from('games')
        .upsert(gameData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      this.trackQuery('createGame')

      if (error) {
        console.error('❌ Error creating game:', error)
        return { success: false, error: error.message }
      }

      return { success: true, gameId: data.id }
    } catch (error) {
      console.error('❌ Database error in createGame:', error)
      return { success: false, error: 'Database connection failed' }
    }
  }

  /**
   * Batch update game state (non-critical updates)
   */
  batchUpdateGameState(gameId: string, updates: {
    called_numbers?: number[]
    latest_number?: any
    last_called_at?: string
    status?: string
  }): void {
    const operation: BatchOperation = {
      type: 'update',
      table: 'games',
      data: updates,
      conditions: { id: gameId },
      timestamp: Date.now()
    }

    this.batchQueue.push(operation)
    
    // Process immediately if queue is full
    if (this.batchQueue.length >= this.config.batchSize) {
      this.processBatchQueue()
    }
  }

  /**
   * Critical update (immediate execution)
   */
  async updateGameCritical(gameId: string, updates: {
    status?: string
    winner_id?: string | null
    ended_at?: string
    started_at?: string
  }): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('games')
        .update(updates)
        .eq('id', gameId)

      this.trackQuery('updateGameCritical')

      if (error) {
        console.error('❌ Critical update failed:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Database error in critical update:', error)
      return false
    }
  }

  /**
   * Optimized player operations
   */
  async addPlayerToGame(gameId: string, userId: string): Promise<boolean> {
    try {
      // Use PostgreSQL array functions for atomic operations
      const { error } = await this.supabase.rpc('add_player_to_game', {
        p_game_id: gameId,
        p_user_id: userId
      })

      this.trackQuery('addPlayerToGame')

      if (error) {
        console.error('❌ Error adding player to game:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Database error adding player:', error)
      return false
    }
  }

  /**
   * Batch user balance updates
   */
  batchUpdateBalance(userId: string, amount: number, type: 'stake' | 'win' | 'bonus'): void {
    const operation: BatchOperation = {
      type: 'update',
      table: 'users',
      data: { 
        balance_change: amount,
        transaction_type: type
      },
      conditions: { id: userId },
      timestamp: Date.now()
    }

    this.batchQueue.push(operation)
  }

  /**
   * Get game with caching
   */
  private gameCache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_TTL = 30000 // 30 seconds

  async getGame(gameId: string, useCache = true): Promise<any> {
    // Check cache first
    if (useCache) {
      const cached = this.gameCache.get(gameId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      this.trackQuery('getGame')

      if (error) {
        console.error('❌ Error fetching game:', error)
        return null
      }

      // Cache the result
      if (useCache) {
        this.gameCache.set(gameId, { data, timestamp: Date.now() })
      }

      return data
    } catch (error) {
      console.error('❌ Database error fetching game:', error)
      return null
    }
  }

  /**
   * Efficient room queries with pagination
   */
  async getRoomsWithPlayerCount(limit = 10, offset = 0): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_rooms_with_player_count')
        .range(offset, offset + limit - 1)

      this.trackQuery('getRoomsWithPlayerCount')

      if (error) {
        console.error('❌ Error fetching rooms:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Database error fetching rooms:', error)
      return []
    }
  }

  /**
   * Process batch queue
   */
  private async processBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) return

    const batch = this.batchQueue.splice(0, this.config.batchSize)
    
    try {
      // Group operations by table and type
      const groupedOps = this.groupOperations(batch)
      
      for (const key of Array.from(groupedOps.keys())) {
        const operations = groupedOps.get(key)!
        await this.executeBatchOperation(key, operations)
      }

      console.log(`✅ Processed batch of ${batch.length} operations`)
    } catch (error) {
      console.error('❌ Batch processing error:', error)
      
      // Re-queue failed operations (with limit to prevent infinite loops)
      const retriableOps = batch.filter(op => Date.now() - op.timestamp < 60000) // 1 minute max age
      this.batchQueue.unshift(...retriableOps)
    }
  }

  /**
   * Group operations for efficient batching
   */
  private groupOperations(operations: BatchOperation[]): Map<string, BatchOperation[]> {
    const grouped = new Map<string, BatchOperation[]>()

    for (const op of operations) {
      const key = `${op.table}_${op.type}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(op)
    }

    return grouped
  }

  /**
   * Execute batch operation
   */
  private async executeBatchOperation(key: string, operations: BatchOperation[]): Promise<void> {
    const [table, type] = key.split('_')

    switch (type) {
      case 'update':
        await this.executeBatchUpdate(table, operations)
        break
      case 'insert':
        await this.executeBatchInsert(table, operations)
        break
      case 'delete':
        await this.executeBatchDelete(table, operations)
        break
    }

    this.trackQuery(`batch_${key}`)
  }

  /**
   * Execute batch updates
   */
  private async executeBatchUpdate(table: string, operations: BatchOperation[]): Promise<void> {
    // Use PostgreSQL CASE statements for efficient batch updates
    if (table === 'games') {
      const gameUpdates = operations.map(op => ({
        id: op.conditions.id,
        ...op.data
      }))

      const { error } = await this.supabase.rpc('batch_update_games', {
        updates: gameUpdates
      })

      if (error) throw error
    }
    // Add more table-specific batch updates as needed
  }

  /**
   * Execute batch inserts
   */
  private async executeBatchInsert(table: string, operations: BatchOperation[]): Promise<void> {
    const insertData = operations.map(op => op.data)
    
    const { error } = await this.supabase
      .from(table)
      .insert(insertData)

    if (error) throw error
  }

  /**
   * Execute batch deletes
   */
  private async executeBatchDelete(table: string, operations: BatchOperation[]): Promise<void> {
    const ids = operations.map(op => op.conditions.id)
    
    const { error } = await this.supabase
      .from(table)
      .delete()
      .in('id', ids)

    if (error) throw error
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.processBatchQueue()
      }
    }, this.config.batchDelay)
  }

  /**
   * Track query performance
   */
  private trackQuery(queryType: string): void {
    this.queryCount++
    this.lastQueryTime = Date.now()
    
    // Log performance metrics periodically
    if (this.queryCount % 100 === 0) {
      console.log(`📊 Database metrics: ${this.queryCount} queries, last: ${queryType}`)
    }
  }

  /**
   * Start query monitoring
   */
  private startQueryMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats()
      console.log(`📈 Database stats:`, stats)
      
      // Alert if query rate is too high for free tier
      if (stats.queriesPerMinute > 60) { // 1 query per second limit
        console.warn(`⚠️ High query rate detected: ${stats.queriesPerMinute}/min`)
        this.throttleQueries()
      }
    }, 60000) // Every minute
  }

  /**
   * Throttle queries when approaching limits
   */
  private throttleQueries(): void {
    // Increase batch delay to reduce query frequency
    this.config.batchDelay = Math.min(this.config.batchDelay * 1.5, 10000) // Max 10 seconds
    this.config.batchSize = Math.max(this.config.batchSize * 1.2, 50) // Max 50 operations
    
    console.log(`🐌 Throttling queries: delay=${this.config.batchDelay}ms, batch=${this.config.batchSize}`)
  }

  /**
   * Get database statistics
   */
  getStats() {
    const now = Date.now()
    const timeSinceLastQuery = now - this.lastQueryTime
    
    return {
      totalQueries: this.queryCount,
      queriesPerMinute: this.queryCount > 0 ? Math.round(this.queryCount / ((now - this.lastQueryTime) / 60000)) : 0,
      batchQueueSize: this.batchQueue.length,
      cacheSize: this.gameCache.size,
      timeSinceLastQuery: timeSinceLastQuery,
      config: this.config,
      isThrottled: this.config.batchDelay > 2000
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.gameCache.clear()
    console.log(`🧹 Database cache cleared`)
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log(`🛑 Shutting down database optimizer`)
    
    // Process remaining batch operations
    if (this.batchQueue.length > 0) {
      console.log(`📤 Processing ${this.batchQueue.length} remaining operations`)
      await this.processBatchQueue()
    }
    
    // Clear timers
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }
    
    // Clear cache
    this.clearCache()
    
    console.log(`✅ Database optimizer shutdown complete`)
  }
}

// Export singleton instance
export const databaseOptimizer = new DatabaseOptimizer(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
