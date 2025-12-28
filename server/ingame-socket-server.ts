import { Server as SocketServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import { gameStateManager, GameState, BingoClaim } from '../lib/game-state-manager.js'
import { supabaseAdmin } from '../lib/supabase.js'
import { roomLifecycleManager } from '../lib/room-lifecycle-manager.js'

// Socket event types for in-game functionality
interface InGameServerToClientEvents {
  // Game state events
  game_started: (data: { roomId: string; gameLevel: string; players: any[]; callInterval: number }) => void
  number_called: (data: { number: number; remaining: number; letter: string }) => void
  all_numbers_called: (data: { message: string; timestamp: string }) => void
  game_snapshot: (data: any) => void
  
  // Player events
  player_reconnected: (data: { username: string }) => void
  player_left: (data: { username: string; reason: string }) => void
  spectator_joined: (data: { username: string; spectatorCount: number }) => void
  
  // Bingo events
  bingo_claimed: (data: { username: string; pattern: string }) => void
  bingo_winner: (data: { username: string; pattern: string; winningCells: number[]; timestamp?: string }) => void
  invalid_claim: (data: { reason: string; details: any; timestamp?: string }) => void
  late_claim: (data: { message: string; winner: string; timestamp: string }) => void
  valid_but_late: (data: { message: string; details: any; timestamp: string }) => void
  
  // Game end events
  game_over: (data: { winner: string | null; reason: string; finalNumbers: number[]; duration: number; timestamp?: string }) => void
  no_winner: (data: { message: string; reason: string; finalNumbers: number[]; duration: number; timestamp: string }) => void
  
  // Error events
  game_error: (data: { message: string }) => void
}

interface InGameClientToServerEvents {
  // Game joining
  join_game: (data: { username: string; roomId: string }) => void
  join_spectator: (data: { username: string; roomId: string }) => void
  reconnect_request: (data: { username: string; roomId: string }) => void
  
  // Game actions
  bingo_claim: (data: { username: string; claimedCells: number[]; bingoPattern: string; board: number[][] }) => void
  
  // Utility
  get_game_state: (data: { roomId: string }) => void
}

interface InGameInterServerEvents {
  // Events between server instances
}

interface InGameSocketData {
  username?: string
  roomId?: string
  userId?: string
  isSpectator?: boolean
}

export class InGameSocketServer {
  private io: SocketServer<InGameClientToServerEvents, InGameServerToClientEvents, InGameInterServerEvents, InGameSocketData>
  private gameRooms = new Map<string, Set<string>>() // roomId -> Set<socketId>
  private socketToRoom = new Map<string, string>() // socketId -> roomId

  constructor(io: SocketServer<InGameClientToServerEvents, InGameServerToClientEvents, InGameInterServerEvents, InGameSocketData>) {
    this.io = io

    this.setupEventHandlers()
    console.log('🎮 In-Game Socket Server initialized')
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected to game server: ${socket.id}`)

      // Handle joining active game (both formats for compatibility)
      socket.on('join_game', async (data) => {
        try {
          await this.handleJoinGame(socket, data)
        } catch (error) {
          console.error('Error handling join_game:', error)
          socket.emit('game_error', { message: 'Failed to join game' })
        }
      })
      
      // @ts-ignore - Handle hyphenated format for compatibility
      socket.on('join-game', async (data: any) => {
        try {
          // Convert hyphenated format to underscore format
          await this.handleJoinGame(socket, { 
            roomId: data.gameId, 
            username: data.userId
          })
        } catch (error) {
          console.error('Error handling join-game:', error)
          socket.emit('game_error', { message: 'Failed to join game' })
        }
      })

      // Handle joining as spectator
      socket.on('join_spectator', async (data) => {
        try {
          await this.handleJoinSpectator(socket, data)
        } catch (error) {
          console.error('Error handling join_spectator:', error)
          socket.emit('game_error', { message: 'Failed to join as spectator' })
        }
      })

      // Handle reconnect request
      socket.on('reconnect_request', async (data) => {
        try {
          await this.handleReconnectRequest(socket, data)
        } catch (error) {
          console.error('Error handling reconnect_request:', error)
          socket.emit('game_error', { message: 'Failed to reconnect' })
        }
      })

      // Handle bingo claim
      socket.on('bingo_claim', async (data) => {
        try {
          await this.handleBingoClaim(socket, data)
        } catch (error) {
          console.error('Error handling bingo_claim:', error)
          socket.emit('game_error', { message: 'Failed to process bingo claim' })
        }
      })

      // Handle get game state
      socket.on('get_game_state', async (data) => {
        try {
          await this.handleGetGameState(socket, data)
        } catch (error) {
          console.error('Error handling get_game_state:', error)
          socket.emit('game_error', { message: 'Failed to get game state' })
        }
      })

      // Handle disconnect
      socket.on('disconnect', async (reason) => {
        console.log(`🔌 Client disconnected from game server: ${socket.id}, reason: ${reason}`)
        try {
          await this.handlePlayerDisconnect(socket, reason)
        } catch (error) {
          console.error('Error handling disconnect:', error)
        }
      })
    })
  }

  /**
   * Start a new game (called from waiting room server)
   */
  async startGame(
    roomId: string, 
    gameLevel: 'easy' | 'medium' | 'hard',
    players: Array<{ username: string; socket_id: string; user_id?: string }>
  ): Promise<void> {
    try {
      console.log(`🎮 Starting game for room ${roomId} with ${players.length} players`)

      // Initialize game state (creates game_sessions row)
      const gameState = await gameStateManager.initializeGame(roomId, gameLevel, players)

      // Deduct stakes for all active players in this room using wallet_v2 and
      // record stake metadata on room_players via room_start_game_with_stakes.
      try {
        const { data: stakeResult, error: stakeError } = await supabaseAdmin.rpc('room_start_game_with_stakes', {
          p_room_id: roomId,
          p_session_id: gameState.id
        })

        if (stakeError) {
          console.error('Error running room_start_game_with_stakes:', stakeError)
        } else {
          const chargedCount = typeof stakeResult === 'number' ? stakeResult : 0
          console.log(`💰 room_start_game_with_stakes charged ${chargedCount} players for room ${roomId} (session ${gameState.id})`)
          
          // If no one could be charged, log a warning but allow the game to proceed.
          // This preserves gameplay while we finish wiring user_id mapping for
          // room_players. Wallet safety is still enforced by the existing
          // /api/game/confirm-join flow for the legacy games pipeline.
          if (chargedCount === 0) {
            console.warn(`⚠️ room_start_game_with_stakes did not charge any players for room ${roomId} (session ${gameState.id}). Proceeding without server-side room-based stake deduction.`)
          }
        }
      } catch (stakeException) {
        console.error('Unhandled exception in room_start_game_with_stakes:', stakeException)
      }

      // Record activity for this room in the lifecycle manager
      await roomLifecycleManager.markInGameActivity(roomId)

      // Track room sockets
      const roomSockets = new Set<string>()
      for (const player of players) {
        roomSockets.add(player.socket_id)
        this.socketToRoom.set(player.socket_id, roomId)
      }
      this.gameRooms.set(roomId, roomSockets)

      // Notify all players that game has started
      this.io.to(roomId).emit('game_started', {
        roomId,
        gameLevel,
        players: players.map(p => ({ username: p.username })),
        callInterval: gameState.call_interval
      })

      // Start number calling
      gameStateManager.startNumberCalling(roomId, (number, remaining) => {
        this.handleNumberCalled(roomId, number, remaining)
      })

      console.log(`✅ Game started for room ${roomId}`)

    } catch (error) {
      console.error('Error starting game:', error)
      this.io.to(roomId).emit('game_error', { message: 'Failed to start game' })
    }
  }

  /**
   * Handle number called
   */
  private handleNumberCalled(roomId: string, number: number, remaining: number): void {
    const letter = this.getNumberLetter(number)
    
    this.io.to(roomId).emit('number_called', {
      number,
      remaining,
      letter
    })

    console.log(`📢 Room ${roomId}: Called ${letter}${number} (${remaining} remaining)`)

    // If all numbers called (remaining = 0), emit all_numbers_called event
    if (remaining === 0) {
      console.log(`📢 Room ${roomId}: All 75 numbers called, waiting for bingo claims...`)
      this.io.to(roomId).emit('all_numbers_called', {
        message: 'All 75 numbers have been called. Waiting for bingo claims...',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Handle player joining active game
   */
  private async handleJoinGame(socket: any, data: { username: string; roomId: string }): Promise<void> {
    const { username, roomId } = data

    const gameState = gameStateManager.getGameState(roomId)
    if (!gameState) {
      socket.emit('game_error', { message: 'Game not found' })
      return
    }

    if (gameState.status !== 'in_progress') {
      socket.emit('game_error', { message: 'Game is not in progress' })
      return
    }

    // Check if player is already in the game
    const player = gameState.players.get(username)
    if (!player) {
      socket.emit('game_error', { message: 'Player not found in this game' })
      return
    }

    // Update socket data
    socket.data.username = username
    socket.data.roomId = roomId
    socket.data.isSpectator = false

    // Join socket room
    socket.join(roomId)

    // Track socket
    const roomSockets = this.gameRooms.get(roomId) || new Set()
    roomSockets.add(socket.id)
    this.gameRooms.set(roomId, roomSockets)
    this.socketToRoom.set(socket.id, roomId)

    // Send game snapshot
    const snapshot = gameStateManager.getGameSnapshot(roomId)
    socket.emit('game_snapshot', {
      ...snapshot,
      playerBoard: player.board,
      playerStatus: player.status
    })

    console.log(`🎮 Player ${username} joined active game in room ${roomId}`)
  }

  /**
   * Handle joining as spectator
   */
  private async handleJoinSpectator(socket: any, data: { username: string; roomId: string }): Promise<void> {
    const { username, roomId } = data

    const gameState = gameStateManager.getGameState(roomId)
    if (!gameState) {
      socket.emit('game_error', { message: 'Game not found' })
      return
    }

    if (gameState.status !== 'in_progress') {
      socket.emit('game_error', { message: 'Game is not in progress' })
      return
    }

    // Add as spectator
    const spectator = await gameStateManager.addSpectator(roomId, username, socket.id)
    if (!spectator) {
      socket.emit('game_error', { message: 'Failed to join as spectator' })
      return
    }

    // Update socket data
    socket.data.username = username
    socket.data.roomId = roomId
    socket.data.isSpectator = true

    // Join socket room
    socket.join(roomId)

    // Track socket
    const roomSockets = this.gameRooms.get(roomId) || new Set()
    roomSockets.add(socket.id)
    this.gameRooms.set(roomId, roomSockets)
    this.socketToRoom.set(socket.id, roomId)

    // Send game snapshot (without player board)
    const snapshot = gameStateManager.getGameSnapshot(roomId)
    socket.emit('game_snapshot', {
      ...snapshot,
      isSpectator: true
    })

    // Notify others
    this.io.to(roomId).emit('spectator_joined', {
      username,
      spectatorCount: gameState.spectators.size
    })

    console.log(`👁️ Spectator ${username} joined room ${roomId}`)
  }

  /**
   * Handle reconnect request
   */
  private async handleReconnectRequest(socket: any, data: { username: string; roomId: string }): Promise<void> {
    const { username, roomId } = data

    const gameState = gameStateManager.getGameState(roomId)
    if (!gameState) {
      socket.emit('game_error', { message: 'Game not found' })
      return
    }

    // Try to reconnect player
    const player = gameStateManager.handlePlayerReconnect(roomId, username, socket.id)
    
    if (player) {
      // Successful reconnect
      socket.data.username = username
      socket.data.roomId = roomId
      socket.data.isSpectator = false

      // Join socket room
      socket.join(roomId)

      // Track socket
      const roomSockets = this.gameRooms.get(roomId) || new Set()
      roomSockets.add(socket.id)
      this.gameRooms.set(roomId, roomSockets)
      this.socketToRoom.set(socket.id, roomId)

      // Send game snapshot
      const snapshot = gameStateManager.getGameSnapshot(roomId)
      socket.emit('game_snapshot', {
        ...snapshot,
        playerBoard: player.board,
        playerStatus: player.status,
        reconnected: true
      })

      // Notify others
      this.io.to(roomId).emit('player_reconnected', { username })

      // Resume number calling if needed
      gameStateManager.resumeNumberCalling(roomId, (number, remaining) => {
        this.handleNumberCalled(roomId, number, remaining)
      })

      console.log(`🔄 Player ${username} reconnected to room ${roomId}`)
    } else {
      // Reconnect failed, offer spectator mode
      socket.emit('game_error', { 
        message: 'Reconnect failed - grace period expired. You can join as spectator.',
        canSpectate: true
      })
    }
  }

  /**
   * Handle bingo claim with atomic winner validation
   */
  private async handleBingoClaim(socket: any, data: { 
    username: string; 
    claimedCells: number[]; 
    bingoPattern: string; 
    board: number[][]
  }): Promise<void> {
    const { username, claimedCells, bingoPattern, board } = data
    const roomId = socket.data.roomId

    if (!roomId || socket.data.isSpectator) {
      socket.emit('game_error', { message: 'Cannot claim bingo as spectator' })
      return
    }

    // Mark activity for this room when a bingo claim is made
    await roomLifecycleManager.markInGameActivity(roomId)

    console.log(`🎯 Bingo claim from ${username} in room ${roomId}: ${bingoPattern}`)

    const claim: BingoClaim = {
      username,
      claimed_cells: claimedCells,
      bingo_pattern: bingoPattern as any,
      board
    }

    // Validate the claim with atomic winner logic
    const validation = await gameStateManager.validateBingoClaim(roomId, claim)

    if (validation.isLateClaim) {
      // Late claim - winner already determined
      socket.emit('late_claim', {
        message: 'Winner already determined',
        winner: validation.details.winner,
        timestamp: new Date().toISOString()
      })
      console.log(`⏰ Late bingo claim from ${username} in room ${roomId} - winner already determined`)
      return
    }

    if (validation.isValid && validation.isWinner) {
      // ATOMIC WINNER - First valid claim wins
      await gameStateManager.endGame(roomId, username, 'bingo_claimed')

      // Notify all players of the winner
      this.io.to(roomId).emit('bingo_winner', {
        username,
        pattern: bingoPattern,
        winningCells: claimedCells,
        timestamp: new Date().toISOString()
      })

      const gameState = gameStateManager.getGameState(roomId)
      const duration = gameState ? Date.now() - gameState.started_at.getTime() : 0

      this.io.to(roomId).emit('game_over', {
        winner: username,
        reason: 'bingo_claimed',
        finalNumbers: gameState?.numbers_called || [],
        duration: Math.floor(duration / 1000),
        timestamp: new Date().toISOString()
      })

      console.log(`🏆 ATOMIC WINNER! ${username} won in room ${roomId} with ${bingoPattern}`)

      // Schedule cleanup
      setTimeout(() => {
        this.cleanupGameRoom(roomId)
      }, 5000)

    } else if (validation.isValid && !validation.isWinner) {
      // Valid claim but someone else already won
      socket.emit('valid_but_late', {
        message: 'Your bingo was valid, but someone else claimed victory first',
        details: validation.details,
        timestamp: new Date().toISOString()
      })
      console.log(`✅❌ Valid but late bingo claim from ${username} in room ${roomId}`)

    } else {
      // Invalid claim
      socket.emit('invalid_claim', {
        reason: 'Invalid bingo claim',
        details: validation.details,
        timestamp: new Date().toISOString()
      })
      console.log(`❌ Invalid bingo claim from ${username} in room ${roomId}:`, validation.details)
    }
  }

  /**
   */
  private async handleGetGameState(socket: any, data: { roomId: string }): Promise<void> {
    const { roomId } = data

    const snapshot = gameStateManager.getGameSnapshot(roomId)
    if (snapshot) {
      socket.emit('game_snapshot', snapshot)
    } else {
      socket.emit('game_error', { message: 'Game not found' })
    }
  }

  /**
   * Handle player disconnect
   */
  private async handlePlayerDisconnect(socket: any, reason: string): Promise<void> {
    const roomId = socket.data.roomId
    const username = socket.data.username
    const isSpectator = socket.data.isSpectator

    if (!roomId || !username) return

    // Remove from tracking
    this.socketToRoom.delete(socket.id)
    const roomSockets = this.gameRooms.get(roomId)
    if (roomSockets) {
      roomSockets.delete(socket.id)
      if (roomSockets.size === 0) {
        this.gameRooms.delete(roomId)
      }
    }

    if (isSpectator) {
      // Remove spectator
      const gameState = gameStateManager.getGameState(roomId)
      if (gameState) {
        gameState.spectators.delete(username)
        
        // Update database
        await supabaseAdmin
          .from('game_players')
          .delete()
          .eq('session_id', gameState.id)
          .eq('username', username)
          .eq('status', 'spectator')
      }

      console.log(`👁️ Spectator ${username} left room ${roomId}`)
    } else {
      // Handle player disconnect with grace period
      await gameStateManager.handlePlayerDisconnect(roomId, username)

      // Notify others
      this.io.to(roomId).emit('player_left', {
        username,
        reason: 'disconnected'
      })

      console.log(`🔌 Player ${username} disconnected from room ${roomId}`)
    }
  }

  /**
   * Clean up game room
   */
  private cleanupGameRoom(roomId: string): void {
    // Disconnect all sockets in the room
    const roomSockets = this.gameRooms.get(roomId)
    if (roomSockets) {
      roomSockets.forEach((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId)
        if (socket) {
          socket.leave(roomId)
          socket.emit('game_over', {
            winner: null,
            reason: 'cleanup',
            finalNumbers: [],
            duration: 0
          })
        }
        this.socketToRoom.delete(socketId)
      })
      this.gameRooms.delete(roomId)
    }

    console.log(`🧹 Cleaned up game room ${roomId}`)
  }

  /**
   * Get number letter (B, I, N, G, O)
   */
  private getNumberLetter(number: number): string {
    if (number >= 1 && number <= 15) return 'B'
    if (number >= 16 && number <= 30) return 'I'
    if (number >= 31 && number <= 45) return 'N'
    if (number >= 46 && number <= 60) return 'G'
    if (number >= 61 && number <= 75) return 'O'
    return '?'
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedSockets: this.io.sockets.sockets.size,
      activeGameRooms: this.gameRooms.size,
      activeGames: gameStateManager.getActiveGames().size,
      socketToRoomMappings: this.socketToRoom.size
    }
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketServer<InGameClientToServerEvents, InGameServerToClientEvents, InGameInterServerEvents, InGameSocketData> {
    return this.io
  }

  /**
   * Emit no winner announcement when all numbers called
   */
  announceNoWinner(roomId: string, finalNumbers: number[], duration: number): void {
    const gameState = gameStateManager.getGameState(roomId)
    
    this.io.to(roomId).emit('no_winner', {
      message: 'All 75 numbers have been called. No player claimed bingo.',
      reason: 'all_numbers_called_no_claim',
      finalNumbers,
      duration,
      timestamp: new Date().toISOString()
    })

    console.log(`📢 Room ${roomId}: No winner announcement sent (all numbers called, no claim)`)

    // Schedule cleanup
    setTimeout(() => {
      this.cleanupGameRoom(roomId)
    }, 5000)
  }

  /**
   * Force end game (admin function)
   */
  async forceEndGame(roomId: string, reason: string = 'admin_ended'): Promise<void> {
    await gameStateManager.endGame(roomId, null, reason)
    
    this.io.to(roomId).emit('game_over', {
      winner: null,
      reason,
      finalNumbers: [],
      duration: 0
    })

    setTimeout(() => {
      this.cleanupGameRoom(roomId)
    }, 5000)
  }

  /**
   * Cleanup all games (for shutdown)
   */
  cleanup(): void {
    gameStateManager.cleanupAllGames()
    
    this.gameRooms.forEach((_, roomId) => {
      this.cleanupGameRoom(roomId)
    })
  }
}

export default InGameSocketServer
