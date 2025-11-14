/**
 * Memory-Efficient Game Manager for Free Tier Deployment
 * Uses object pooling and compact data structures
 */

// Compact game state representation
interface CompactGameState {
  id: string
  roomId: string
  status: number // 0=waiting, 1=countdown, 2=active, 3=finished
  players: string[] // Only store user IDs
  calledNumbers: Uint8Array // More memory efficient than number[]
  callCount: number
  startTime: number // Unix timestamp
  prizePool: number
}

// Object pool for game states
class GameStatePool {
  private pool: CompactGameState[] = []
  private readonly maxPoolSize = 10 // Limit for free tier
  
  acquire(gameId: string, roomId: string): CompactGameState {
    const state = this.pool.pop()
    
    if (state) {
      // Reset existing state
      this.resetState(state, gameId, roomId)
      return state
    }
    
    // Create new state if pool is empty
    return this.createNewState(gameId, roomId)
  }
  
  release(state: CompactGameState): void {
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(state)
    }
    // If pool is full, let GC handle it
  }
  
  private resetState(state: CompactGameState, gameId: string, roomId: string): void {
    state.id = gameId
    state.roomId = roomId
    state.status = 0 // waiting
    state.players.length = 0 // Clear array without reallocating
    state.calledNumbers.fill(0) // Reset to zeros
    state.callCount = 0
    state.startTime = Date.now()
    state.prizePool = 0
  }
  
  private createNewState(gameId: string, roomId: string): CompactGameState {
    return {
      id: gameId,
      roomId: roomId,
      status: 0,
      players: [],
      calledNumbers: new Uint8Array(75), // Pre-allocate for all possible numbers
      callCount: 0,
      startTime: Date.now(),
      prizePool: 0
    }
  }
  
  getStats() {
    return {
      poolSize: this.pool.length,
      maxPoolSize: this.maxPoolSize,
      memoryEstimateMB: this.estimateMemoryUsage()
    }
  }
  
  private estimateMemoryUsage(): number {
    // Rough estimate: each state ~1KB
    const stateSize = 1024 // bytes
    return (this.pool.length * stateSize) / (1024 * 1024) // MB
  }
}

// Efficient player tracking
interface CompactPlayer {
  id: string
  socketId: string
  joinTime: number
  lastSeen: number
  isActive: boolean
}

class PlayerPool {
  private pool: CompactPlayer[] = []
  private readonly maxPoolSize = 50
  
  acquire(id: string, socketId: string): CompactPlayer {
    const player = this.pool.pop()
    
    if (player) {
      player.id = id
      player.socketId = socketId
      player.joinTime = Date.now()
      player.lastSeen = Date.now()
      player.isActive = true
      return player
    }
    
    return {
      id,
      socketId,
      joinTime: Date.now(),
      lastSeen: Date.now(),
      isActive: true
    }
  }
  
  release(player: CompactPlayer): void {
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(player)
    }
  }
}

// Main memory-efficient game manager
export class MemoryEfficientGameManager {
  private games = new Map<string, CompactGameState>()
  private players = new Map<string, Map<string, CompactPlayer>>() // gameId -> playerId -> player
  private gameStatePool = new GameStatePool()
  private playerPool = new PlayerPool()
  
  // Resource limits for free tier
  private readonly MAX_GAMES = 5
  private readonly MAX_PLAYERS_PER_GAME = 20 // Reduced from 500
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000 // 2 minutes
  
  constructor() {
    this.startPeriodicCleanup()
  }

  /**
   * Create a new game with memory efficiency
   */
  createGame(gameId: string, roomId: string, stake: number): boolean {
    // Check limits
    if (this.games.size >= this.MAX_GAMES) {
      console.warn(`🚫 Cannot create game ${gameId}: Max games limit (${this.MAX_GAMES})`)
      return false
    }
    
    // Check memory pressure
    if (this.isMemoryConstrained()) {
      console.warn(`🚫 Cannot create game ${gameId}: Memory constrained`)
      this.emergencyCleanup()
      return false
    }
    
    // Acquire game state from pool
    const gameState = this.gameStatePool.acquire(gameId, roomId)
    gameState.prizePool = stake
    
    this.games.set(gameId, gameState)
    this.players.set(gameId, new Map())
    
    console.log(`✅ Created game ${gameId} (${this.games.size}/${this.MAX_GAMES})`)
    return true
  }

  /**
   * Add player to game
   */
  addPlayer(gameId: string, playerId: string, socketId: string): boolean {
    const gameState = this.games.get(gameId)
    if (!gameState) return false
    
    const gamePlayers = this.players.get(gameId)
    if (!gamePlayers) return false
    
    // Check player limit
    if (gamePlayers.size >= this.MAX_PLAYERS_PER_GAME) {
      console.warn(`🚫 Cannot add player to game ${gameId}: Max players limit`)
      return false
    }
    
    // Acquire player from pool
    const player = this.playerPool.acquire(playerId, socketId)
    gamePlayers.set(playerId, player)
    gameState.players.push(playerId)
    
    console.log(`👤 Added player ${playerId} to game ${gameId} (${gamePlayers.size}/${this.MAX_PLAYERS_PER_GAME})`)
    return true
  }

  /**
   * Remove player from game
   */
  removePlayer(gameId: string, playerId: string): void {
    const gamePlayers = this.players.get(gameId)
    if (!gamePlayers) return
    
    const player = gamePlayers.get(playerId)
    if (player) {
      gamePlayers.delete(playerId)
      this.playerPool.release(player) // Return to pool
      
      // Remove from game state players array
      const gameState = this.games.get(gameId)
      if (gameState) {
        const index = gameState.players.indexOf(playerId)
        if (index > -1) {
          gameState.players.splice(index, 1)
        }
      }
      
      console.log(`👋 Removed player ${playerId} from game ${gameId}`)
    }
  }

  /**
   * Call a number for a game
   */
  callNumber(gameId: string, number: number): boolean {
    const gameState = this.games.get(gameId)
    if (!gameState || gameState.status !== 2) return false // Not active
    
    // Check if number already called
    if (gameState.calledNumbers[number - 1] === 1) {
      console.warn(`⚠️ Number ${number} already called for game ${gameId}`)
      return false
    }
    
    // Mark number as called
    gameState.calledNumbers[number - 1] = 1
    gameState.callCount++
    
    console.log(`📢 Game ${gameId}: Called number ${number} (${gameState.callCount}/75)`)
    return true
  }

  /**
   * End a game and clean up resources
   */
  endGame(gameId: string, winnerId?: string): void {
    const gameState = this.games.get(gameId)
    if (!gameState) return
    
    gameState.status = 3 // finished
    
    // Clean up players
    const gamePlayers = this.players.get(gameId)
    if (gamePlayers) {
      for (const player of gamePlayers.values()) {
        this.playerPool.release(player)
      }
      this.players.delete(gameId)
    }
    
    // Return game state to pool
    this.games.delete(gameId)
    this.gameStatePool.release(gameState)
    
    console.log(`🏁 Game ${gameId} ended and cleaned up`)
  }

  /**
   * Get game state (read-only)
   */
  getGameState(gameId: string): Readonly<CompactGameState> | null {
    return this.games.get(gameId) || null
  }

  /**
   * Get called numbers as regular array
   */
  getCalledNumbers(gameId: string): number[] {
    const gameState = this.games.get(gameId)
    if (!gameState) return []
    
    const numbers: number[] = []
    for (let i = 0; i < gameState.calledNumbers.length; i++) {
      if (gameState.calledNumbers[i] === 1) {
        numbers.push(i + 1)
      }
    }
    return numbers
  }

  /**
   * Get players for a game
   */
  getPlayers(gameId: string): CompactPlayer[] {
    const gamePlayers = this.players.get(gameId)
    return gamePlayers ? Array.from(gamePlayers.values()) : []
  }

  /**
   * Update player activity
   */
  updatePlayerActivity(gameId: string, playerId: string): void {
    const gamePlayers = this.players.get(gameId)
    const player = gamePlayers?.get(playerId)
    if (player) {
      player.lastSeen = Date.now()
    }
  }

  /**
   * Check if memory is constrained
   */
  private isMemoryConstrained(): boolean {
    const usage = process.memoryUsage()
    const heapUsedMB = usage.heapUsed / 1024 / 1024
    return heapUsedMB > 80 // 80MB threshold for free tier
  }

  /**
   * Emergency cleanup when memory is constrained
   */
  private emergencyCleanup(): void {
    console.log(`🚨 Emergency cleanup initiated`)
    
    // Find games with no recent activity
    const now = Date.now()
    const inactiveGames: string[] = []
    
    for (const [gameId, gameState] of this.games) {
      const timeSinceStart = now - gameState.startTime
      if (timeSinceStart > 5 * 60 * 1000) { // 5 minutes old
        inactiveGames.push(gameId)
      }
    }
    
    // Remove oldest games first
    inactiveGames.sort((a, b) => {
      const gameA = this.games.get(a)!
      const gameB = this.games.get(b)!
      return gameA.startTime - gameB.startTime
    })
    
    // Remove up to 50% of games
    const toRemove = Math.min(inactiveGames.length, Math.ceil(this.games.size / 2))
    for (let i = 0; i < toRemove; i++) {
      this.endGame(inactiveGames[i])
    }
    
    console.log(`🧹 Emergency cleanup: Removed ${toRemove} inactive games`)
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Periodic cleanup of inactive players and games
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupInactivePlayers()
      this.logResourceUsage()
    }, this.CLEANUP_INTERVAL)
  }

  /**
   * Clean up inactive players
   */
  private cleanupInactivePlayers(): void {
    const now = Date.now()
    const INACTIVE_THRESHOLD = 5 * 60 * 1000 // 5 minutes
    
    let cleanedPlayers = 0
    
    for (const [gameId, gamePlayers] of this.players) {
      const toRemove: string[] = []
      
      for (const [playerId, player] of gamePlayers) {
        if (now - player.lastSeen > INACTIVE_THRESHOLD) {
          toRemove.push(playerId)
        }
      }
      
      for (const playerId of toRemove) {
        this.removePlayer(gameId, playerId)
        cleanedPlayers++
      }
    }
    
    if (cleanedPlayers > 0) {
      console.log(`🧹 Cleaned up ${cleanedPlayers} inactive players`)
    }
  }

  /**
   * Log resource usage
   */
  private logResourceUsage(): void {
    const usage = process.memoryUsage()
    const gamePoolStats = this.gameStatePool.getStats()
    
    console.log(`📊 Resource Usage:`, {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      activeGames: this.games.size,
      totalPlayers: Array.from(this.players.values()).reduce((sum, players) => sum + players.size, 0),
      gamePoolStats,
      memoryConstrained: this.isMemoryConstrained()
    })
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const usage = process.memoryUsage()
    
    return {
      memory: {
        heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
        constrained: this.isMemoryConstrained()
      },
      games: {
        active: this.games.size,
        maxAllowed: this.MAX_GAMES
      },
      players: {
        total: Array.from(this.players.values()).reduce((sum, players) => sum + players.size, 0),
        maxPerGame: this.MAX_PLAYERS_PER_GAME
      },
      pools: {
        gameStates: this.gameStatePool.getStats(),
        players: {
          poolSize: this.playerPool['pool']?.length || 0,
          maxPoolSize: this.playerPool['maxPoolSize'] || 0
        }
      }
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    console.log(`🛑 Shutting down memory-efficient game manager`)
    
    // End all active games
    for (const gameId of this.games.keys()) {
      this.endGame(gameId)
    }
    
    console.log(`✅ Game manager shutdown complete`)
  }
}

// Export singleton instance
export const memoryEfficientGameManager = new MemoryEfficientGameManager()
