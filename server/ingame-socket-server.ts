import { Server as SocketServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import { gameStateManager, GameState, BingoClaim } from '../lib/game-state-manager'
import { supabaseAdmin } from '../lib/supabase'

// Socket event types for in-game functionality
interface InGameServerToClientEvents {
  // Game state events
  game_started: (data: { roomId: string; gameLevel: string; players: any[]; callInterval: number }) => void
  number_called: (data: { number: number; remaining: number; letter: string }) => void
  game_snapshot: (data: any) => void
  
  // Player events
  player_reconnected: (data: { username: string }) => void
  player_left: (data: { username: string; reason: string }) => void
  spectator_joined: (data: { username: string; spectatorCount: number }) => void
  
  // Bingo events
  bingo_claimed: (data: { username: string; pattern: string }) => void
  bingo_winner: (data: { username: string; pattern: string; winningCells: number[] }) => void
  invalid_claim: (data: { reason: string; details: any }) => void
  
  // Game end events
  game_over: (data: { winner: string | null; reason: string; finalNumbers: number[]; duration: number }) => void
  
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

  constructor(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    })

    this.setupEventHandlers()
    console.log('🎮 In-Game Socket Server initialized')
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected to game server: ${socket.id}`)

      // Handle joining active game
      socket.on('join_game', async (data) => {
        try {
          await this.handleJoinGame(socket, data)
        } catch (error) {
          console.error('Error handling join_game:', error)
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

      // Initialize game state
      const gameState = await gameStateManager.initializeGame(roomId, gameLevel, players)

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
    const player = await gameStateManager.handlePlayerReconnect(roomId, username, socket.id)
    
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
   * Handle bingo claim
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

    const gameState = gameStateManager.getGameState(roomId)
    if (!gameState || gameState.status !== 'in_progress') {
      socket.emit('game_error', { message: 'Game not in progress' })
      return
    }

    const claim: BingoClaim = {
      username,
      claimed_cells: claimedCells,
      bingo_pattern: bingoPattern as any,
      board
    }

    // Validate claim
    const validation = await gameStateManager.validateBingoClaim(roomId, claim)

    if (validation.isValid) {
      // Valid bingo claim - end game
      await gameStateManager.endGame(roomId, username, 'bingo_claimed')

      // Notify all players
      this.io.to(roomId).emit('bingo_winner', {
        username,
        pattern: bingoPattern,
        winningCells: claimedCells
      })

      const gameSnapshot = gameStateManager.getGameSnapshot(roomId)
      const duration = gameSnapshot ? Date.now() - new Date(gameSnapshot.startedAt).getTime() : 0

      this.io.to(roomId).emit('game_over', {
        winner: username,
        reason: 'bingo_claimed',
        finalNumbers: gameState.numbers_called,
        duration: Math.floor(duration / 1000)
      })

      console.log(`🏆 BINGO! ${username} won in room ${roomId} with ${bingoPattern}`)

      // Schedule cleanup
      setTimeout(() => {
        this.cleanupGameRoom(roomId)
      }, 30000) // 30 seconds to view results

    } else {
      // Invalid claim
      socket.emit('invalid_claim', {
        reason: 'Invalid bingo claim',
        details: validation.details
      })

      console.log(`❌ Invalid bingo claim from ${username} in room ${roomId}:`, validation.details)
    }
  }

  /**
   * Handle get game state
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
