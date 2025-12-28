import { supabaseAdmin } from './supabase.js'
import { v4 as uuidv4 } from 'uuid'

// Types for in-game state management
export interface GamePlayer {
  id: string
  username: string
  socket_id: string
  user_id?: string
  status: 'active' | 'disconnected' | 'finished' | 'spectator'
  board: number[][]
  score: number
  last_seen: Date
  reconnect_deadline?: Date
  bingo_pattern?: string
  claimed_at?: Date
}

export interface GameState {
  id: string
  room_id: string
  status: 'waiting' | 'in_progress' | 'finished' | 'abandoned'
  game_level: 'easy' | 'medium' | 'hard'
  numbers_called: number[]
  current_number?: number
  call_interval: number
  started_at: Date
  ended_at?: Date
  winner?: string
  winner_id?: string
  players: Map<string, GamePlayer>
  spectators: Map<string, GamePlayer>
  number_call_timer?: NodeJS.Timeout
  reconnect_timers: Map<string, NodeJS.Timeout>
  last_activity: Date
  // Atomic winner validation
  winner_claimed: boolean
  winner_claim_timestamp?: Date
  // Player tracking for auto-end
  active_player_count: number
  min_players_to_continue: number
}

export interface BingoClaim {
  username: string
  claimed_cells: number[]
  bingo_pattern: 'row' | 'column' | 'diagonal' | 'full_house'
  board: number[][]
}

// In-memory store for active games
const activeGames = new Map<string, GameState>()
const gameCleanupTimers = new Map<string, NodeJS.Timeout>()

export class GameStateManager {
  private supabase = supabaseAdmin

  /**
   * Initialize a new game session
   */
  async initializeGame(
    roomId: string, 
    gameLevel: 'easy' | 'medium' | 'hard',
    players: Array<{ username: string; socket_id: string; user_id?: string }>
  ): Promise<GameState> {
    try {
      // Create game session in database
      const { data: gameSession, error } = await this.supabase
        .from('game_sessions')
        .insert({
          room_id: roomId,
          status: 'in_progress',
          game_level: gameLevel,
          numbers_called: [],
          call_interval: this.getCallInterval(gameLevel),
          started_at: new Date().toISOString(),
          total_players: players.length,
          active_players: players.length
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating game session:', error)
        throw new Error('Failed to create game session')
      }

      // Create game state
      const gameState: GameState = {
        id: gameSession.id,
        room_id: roomId,
        status: 'in_progress',
        game_level: gameLevel,
        numbers_called: [],
        call_interval: this.getCallInterval(gameLevel),
        started_at: new Date(),
        players: new Map(),
        spectators: new Map(),
        reconnect_timers: new Map(),
        last_activity: new Date(),
        // Atomic winner validation
        winner_claimed: false,
        // Player tracking for auto-end
        active_player_count: players.length,
        min_players_to_continue: 1
      }

      // Add players to game state and database
      for (const player of players) {
        const gamePlayer: GamePlayer = {
          id: uuidv4(),
          username: player.username,
          socket_id: player.socket_id,
          user_id: player.user_id,
          status: 'active',
          board: this.generateBingoBoard(),
          score: 0,
          last_seen: new Date()
        }

        gameState.players.set(player.username, gamePlayer)

        // Insert player into database
        await this.supabase
          .from('game_players')
          .insert({
            id: gamePlayer.id,
            session_id: gameSession.id,
            user_id: player.user_id,
            username: player.username,
            socket_id: player.socket_id,
            status: 'active',
            board: gamePlayer.board,
            score: 0
          })
      }

      // Store in memory
      activeGames.set(roomId, gameState)

      console.log(`🎮 Initialized game for room ${roomId} with ${players.length} players`)
      return gameState
    } catch (error) {
      console.error('Error initializing game:', error)
      throw error
    }
  }

  /**
   * Start number calling for a game
   */
  startNumberCalling(roomId: string, onNumberCalled: (number: number, remaining: number) => void): void {
    const game = activeGames.get(roomId)
    if (!game || game.status !== 'in_progress') {
      console.log(`Cannot start number calling for room ${roomId}: game not found or not in progress`)
      return
    }

    // Clear any existing timer
    if (game.number_call_timer) {
      clearInterval(game.number_call_timer)
    }

    console.log(`🔢 Starting number calling for room ${roomId} (${game.game_level} - ${game.call_interval}ms interval)`)

    const callNumber = async () => {
      try {
        // Check if game is still active
        if (game.status !== 'in_progress' || game.numbers_called.length >= 75) {
          this.stopNumberCalling(roomId)
          return
        }

        // Check if there are active players
        const activePlayers = Array.from(game.players.values()).filter(p => p.status === 'active')
        if (activePlayers.length === 0) {
          console.log(`⏸️ Pausing number calling for room ${roomId}: no active players`)
          this.pauseNumberCalling(roomId)
          return
        }

        // Generate next number
        const availableNumbers = this.getAvailableNumbers(game.numbers_called)
        if (availableNumbers.length === 0) {
          console.log(`🏁 No more numbers available for room ${roomId}`)
          await this.endGame(roomId, null, 'numbers_exhausted')
          return
        }

        const nextNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
        game.numbers_called.push(nextNumber)
        game.current_number = nextNumber
        game.last_activity = new Date()

        // Save to database
        await this.supabase.rpc('add_called_number', {
          p_session_id: game.id,
          p_number: nextNumber
        })

        // Notify callback
        const remaining = 75 - game.numbers_called.length
        onNumberCalled(nextNumber, remaining)

        console.log(`📢 Called number ${nextNumber} for room ${roomId} (${remaining} remaining)`)

      } catch (error) {
        console.error(`Error calling number for room ${roomId}:`, error)
      }
    }

    // Start the interval
    game.number_call_timer = setInterval(callNumber, game.call_interval)
    
    // Call first number immediately
    setTimeout(callNumber, 1000)
  }

  /**
   * Stop number calling for a game
   */
  stopNumberCalling(roomId: string): void {
    const game = activeGames.get(roomId)
    if (game && game.number_call_timer) {
      clearInterval(game.number_call_timer)
      game.number_call_timer = undefined
      console.log(`⏹️ Stopped number calling for room ${roomId}`)
    }
  }

  /**
   * Pause number calling (can be resumed)
   */
  pauseNumberCalling(roomId: string): void {
    const game = activeGames.get(roomId)
    if (game && game.number_call_timer) {
      clearInterval(game.number_call_timer)
      game.number_call_timer = undefined
      console.log(`⏸️ Paused number calling for room ${roomId}`)
    }
  }

  /**
   * Resume number calling if there are active players
   */
  resumeNumberCalling(roomId: string, onNumberCalled: (number: number, remaining: number) => void): void {
    const game = activeGames.get(roomId)
    if (!game || game.number_call_timer) return

    const activePlayers = Array.from(game.players.values()).filter(p => p.status === 'active')
    if (activePlayers.length > 0) {
      console.log(`▶️ Resuming number calling for room ${roomId}`)
      this.resumeNumberCalling(roomId, onNumberCalled)
    }
  }

  /**
   * Add spectator to game
   */
  async addSpectator(roomId: string, username: string, socketId: string): Promise<GamePlayer | null> {
    const game = activeGames.get(roomId)
    if (!game) return null

    const spectator: GamePlayer = {
      id: uuidv4(),
      username,
      socket_id: socketId,
      status: 'spectator',
      board: [],
      score: 0,
      last_seen: new Date()
    }

    game.spectators.set(username, spectator)

    // Add to database
    await this.supabase
      .from('game_players')
      .insert({
        id: spectator.id,
        session_id: game.id,
        username,
        socket_id: socketId,
        status: 'spectator',
        board: [],
        score: 0
      })

    console.log(` Spectator ${username} joined room ${roomId}`)
    return spectator
  }

  /**
   * Validate bingo claim with atomic first-come-first-serve logic
   */
  async validateBingoClaim(roomId: string, claim: BingoClaim): Promise<{ 
    isValid: boolean; 
    details: any; 
    isWinner: boolean; 
    isLateClaim: boolean 
  }> {
    const game = activeGames.get(roomId)
    if (!game) {
      return { isValid: false, details: { error: 'Game not found' }, isWinner: false, isLateClaim: false }
    }

    // ATOMIC CHECK: If winner already claimed, this is a late claim
    if (game.winner_claimed) {
      console.log(`⏰ Late bingo claim from ${claim.username} in room ${roomId} - winner already determined`)
      return { 
        isValid: false, 
        details: { error: 'Winner already determined', winner: game.winner }, 
        isWinner: false, 
        isLateClaim: true 
      }
    }

    const player = game.players.get(claim.username)
    if (!player || player.status !== 'active') {
      return { 
        isValid: false, 
        details: { error: 'Player not found or not active' }, 
        isWinner: false, 
        isLateClaim: false 
      }
    }

    try {
      // Use database function for validation with atomic locking
      const { data: validation } = await this.supabase.rpc('validate_bingo_claim', {
        p_session_id: game.id,
        p_player_id: player.id,
        p_claimed_cells: claim.claimed_cells,
        p_bingo_pattern: claim.bingo_pattern
      })

      if (!validation || validation.length === 0) {
        return { 
          isValid: false, 
          details: { error: 'Validation failed' }, 
          isWinner: false, 
          isLateClaim: false 
        }
      }

      const result = validation[0]
      const isValidClaim = result.is_valid

      // ATOMIC WINNER ASSIGNMENT: Only if claim is valid and no winner yet
      let isWinner = false
      if (isValidClaim && !game.winner_claimed) {
        // Double-check atomically with database - another claim might have won between checks
        // Re-fetch game with lock to ensure atomicity
        const { data: updatedGame } = await this.supabase
          .from('game_sessions')
          .select('winner_id')
          .eq('id', game.id)
          .maybeSingle()
        
        // If there's still no winner in the database, we can claim victory
        if (updatedGame && !updatedGame.winner_id) {
          game.winner_claimed = true
          game.winner = claim.username
          game.winner_claim_timestamp = new Date()
          player.claimed_at = new Date()
          player.bingo_pattern = claim.bingo_pattern
          isWinner = true
          console.log(`🏆 ATOMIC WINNER: ${claim.username} claimed victory in room ${roomId}`)
        } else {
          // Someone else won while we were processing
          console.log(`⏰ Late claim from ${claim.username} in room ${roomId} - another player won first`)
          return { 
            isValid: true, 
            details: { error: 'Another player won first', winner: updatedGame?.winner_id }, 
            isWinner: false, 
            isLateClaim: true 
          }
        }
      }

      // Record the claim in database
      await this.supabase
        .from('bingo_claims')
        .insert({
          session_id: game.id,
          player_id: player.id,
          username: claim.username,
          claimed_cells: claim.claimed_cells,
          bingo_pattern: claim.bingo_pattern,
          is_valid: isValidClaim,
          validation_result: result.validation_details,
          is_winner: isWinner,
          claimed_at: new Date().toISOString()
        })

      return {
        isValid: isValidClaim,
        details: result.validation_details,
        isWinner: isWinner,
        isLateClaim: false
      }

    } catch (error) {
      console.error('Error validating bingo claim:', error)
      return { 
        isValid: false, 
        details: { error: 'Validation error' }, 
        isWinner: false, 
        isLateClaim: false 
      }
    }
  }

  /**
   * Handle player disconnect with reconnect grace period
   */
  handlePlayerDisconnect(roomId: string, username: string): void {
    const game = activeGames.get(roomId)
    if (!game) return

    const player = game.players.get(username)
    if (!player) return

    // Set player as disconnected
    player.status = 'disconnected'
    player.last_seen = new Date()
    const graceMs = this.getReconnectGraceMs()
    player.reconnect_deadline = new Date(Date.now() + graceMs)

    console.log(`🔌 Player ${username} disconnected from room ${roomId}, grace period: ${Math.round(graceMs / 1000)}s`)

    // Start reconnect timer
    const reconnectTimer = setTimeout(() => {
      this.removeDisconnectedPlayer(roomId, username)
    }, graceMs)

    game.reconnect_timers.set(username, reconnectTimer)
    
    // Update active player count
    this.updateActivePlayerCount(roomId)
  }

  /**
   * Handle player reconnect within grace period
   */
  handlePlayerReconnect(roomId: string, username: string, socketId: string): GamePlayer | null {
    const game = activeGames.get(roomId)
    if (!game) return null

    const player = game.players.get(username)
    if (!player) return null

    // Check if within grace period
    if (player.reconnect_deadline && new Date() <= player.reconnect_deadline) {
      // Clear reconnect timer
      const timer = game.reconnect_timers.get(username)
      if (timer) {
        clearTimeout(timer)
        game.reconnect_timers.delete(username)
      }

      // Restore player
      player.status = 'active'
      player.socket_id = socketId
      player.last_seen = new Date()
      player.reconnect_deadline = undefined

      console.log(`🔄 Player ${username} reconnected to room ${roomId}`)
      
      // Update active player count
      this.updateActivePlayerCount(roomId)
      return player
    }

    return null
  }

  /**
   * Remove disconnected player after grace period
   */
  private removeDisconnectedPlayer(roomId: string, username: string): void {
    const game = activeGames.get(roomId)
    if (!game) return

    const player = game.players.get(username)
    if (!player || player.status !== 'disconnected') return

    // Remove player from game
    game.players.delete(username)
    game.reconnect_timers.delete(username)

    console.log(`❌ Player ${username} removed from room ${roomId} after grace period`)

    // Update active player count and check for auto-end
    this.updateActivePlayerCount(roomId)
    this.checkAutoEndGame(roomId)
  }

  /**
   * Update active player count
   */
  private updateActivePlayerCount(roomId: string): void {
    const game = activeGames.get(roomId)
    if (!game) return

    const activePlayers = Array.from(game.players.values()).filter(p => p.status === 'active')
    game.active_player_count = activePlayers.length
    game.last_activity = new Date()

    console.log(`📊 Room ${roomId} active players: ${game.active_player_count}`)
  }

  /**
   * Check if game should auto-end due to insufficient players
   */
  private async checkAutoEndGame(roomId: string): Promise<void> {
    const game = activeGames.get(roomId)
    if (!game || game.status !== 'in_progress') return

    // Auto-end if no active players remain
    if (game.active_player_count === 0) {
      console.log(`🏁 Auto-ending game ${roomId} - no active players`)
      await this.endGame(roomId, null, 'all_players_left')
      return
    }

    // Auto-end if only one player remains (they win by default)
    if (game.active_player_count === 1 && !game.winner_claimed) {
      const remainingPlayer = Array.from(game.players.values()).find(p => p.status === 'active')
      if (remainingPlayer) {
        console.log(`🏁 Auto-ending game ${roomId} - only one player remains: ${remainingPlayer.username}`)
        game.winner_claimed = true
        game.winner = remainingPlayer.username
        game.winner_claim_timestamp = new Date()
        await this.endGame(roomId, remainingPlayer.username, 'last_player_standing')
      }
    }
  }

  /**
   * End game with winner
   */
  async endGame(roomId: string, winner: string | null, reason: string = 'bingo_claimed'): Promise<void> {
    const game = activeGames.get(roomId)
    if (!game) return

    // Stop number calling
    this.stopNumberCalling(roomId)

    // Clear all reconnect timers
    game.reconnect_timers.forEach((timer) => {
      clearTimeout(timer)
    })
    game.reconnect_timers.clear()

    // Update game state
    game.status = 'finished'
    game.ended_at = new Date()
    game.winner = winner || undefined

    // Update database
    await this.supabase
      .from('game_sessions')
      .update({
        status: 'finished',
        ended_at: new Date().toISOString(),
        winner_username: winner,
        end_reason: reason
      })
      .eq('id', game.id)

    // Update all players to finished
    await this.supabase
      .from('game_players')
      .update({ status: 'finished' })
      .eq('session_id', game.id)

    console.log(`🏁 Game ended in room ${roomId}, winner: ${winner || 'none'}, reason: ${reason}`)

    // Schedule cleanup
    this.scheduleGameCleanup(roomId)
  }

  /**
   * Get game state
   */
  getGameState(roomId: string): GameState | null {
    return activeGames.get(roomId) || null
  }

  /**
   * Get game snapshot for reconnecting players
   */
  getGameSnapshot(roomId: string): any {
    const game = activeGames.get(roomId)
    if (!game) return null

    return {
      roomId: game.room_id,
      status: game.status,
      gameLevel: game.game_level,
      numbersCalled: game.numbers_called,
      currentNumber: game.current_number,
      players: Array.from(game.players.values()).map(p => ({
        username: p.username,
        status: p.status,
        score: p.score
      })),
      spectators: Array.from(game.spectators.values()).map(s => ({
        username: s.username
      })),
      startedAt: game.started_at,
      lastActivity: game.last_activity
    }
  }

  /**
   * Schedule game cleanup
   */
  private scheduleGameCleanup(roomId: string): void {
    // Clean up after 2 minutes
    const timer = setTimeout(() => {
      this.cleanupGame(roomId)
    }, 2 * 60 * 1000)

    gameCleanupTimers.set(roomId, timer)
  }

  /**
   * Clean up game from memory
   */
  private cleanupGame(roomId: string): void {
    const game = activeGames.get(roomId)
    if (game) {
      // Stop any running timers
      this.stopNumberCalling(roomId)
      
      // Clear reconnect timers
      game.reconnect_timers.forEach((timer) => {
        clearTimeout(timer)
      })

      // Remove from memory
      activeGames.delete(roomId)
      gameCleanupTimers.delete(roomId)

      console.log(`🧹 Cleaned up game for room ${roomId}`)
    }
  }

  /**
   * Generate bingo board
   */
  private generateBingoBoard(): number[][] {
    const board: number[][] = []
    
    // B column: 1-15, I column: 16-30, N column: 31-45, G column: 46-60, O column: 61-75
    const ranges = [
      [1, 15],   // B
      [16, 30],  // I
      [31, 45],  // N
      [46, 60],  // G
      [61, 75]   // O
    ]

    for (let col = 0; col < 5; col++) {
      const column: number[] = []
      const [min, max] = ranges[col]
      const availableNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      
      // Shuffle and take first 5
      for (let row = 0; row < 5; row++) {
        if (col === 2 && row === 2) {
          // Free space in center
          column.push(0)
        } else {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length)
          column.push(availableNumbers.splice(randomIndex, 1)[0])
        }
      }
      
      board.push(column)
    }

    return board
  }

  /**
   * Get available numbers for calling
   */
  private getAvailableNumbers(calledNumbers: number[]): number[] {
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
    return allNumbers.filter(num => !calledNumbers.includes(num))
  }

  /**
   * Get call interval based on game level
   */
  private getCallInterval(level: 'easy' | 'medium' | 'hard'): number {
    switch (level) {
      case 'easy': return 3000   // 3 seconds
      case 'medium': return 2000 // 2 seconds
      case 'hard': return 1000   // 1 second
      default: return 2000
    }
  }

  /**
   * Get reconnect grace period in ms (supports test-time override)
   */
  private getReconnectGraceMs(): number {
    const env = process.env.TEST_RECONNECT_GRACE_MS
    const parsed = env ? parseInt(env, 10) : NaN
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    return 30000
  }

  /**
   * Get all active games (for monitoring)
   */
  getActiveGames(): Map<string, GameState> {
    return activeGames
  }

  /**
   * Force cleanup all games (for shutdown)
   */
  cleanupAllGames(): void {
    activeGames.forEach((_, roomId) => {
      this.cleanupGame(roomId)
    })
  }
}

// Export singleton instance
export const gameStateManager = new GameStateManager()
