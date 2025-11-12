import { Server as SocketServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import { waitingRoomManager, WaitingRoom, Player } from '../lib/waiting-room-manager'
import { getGameConfig } from '../lib/admin-config'
import { supabaseAdmin } from '../lib/supabase'

// Socket event types
interface ServerToClientEvents {
  room_update: (data: {
    roomId: string
    players: Player[]
    maxPlayers: number
    minPlayers: number
    currentPlayers: number
    gameLevel: string
    status: string
  }) => void
  waiting_for_more_players: (data: { currentPlayers: number; minPlayers: number; waitingTime?: number }) => void
  game_starting_in: (data: { seconds: number; roomId: string }) => void
  start_game: (data: { roomId: string; gameLevel: string; players: Player[] }) => void
  player_joined: (data: { username: string; playerCount: number }) => void
  player_left: (data: { username: string; playerCount: number }) => void
  error: (data: { message: string }) => void
  room_assigned: (data: { roomId: string; gameLevel: string }) => void
  countdown_cancelled: (data: { roomId: string; reason: string }) => void
  transition_to_game: (data: { roomId: string; gameLevel: string; message: string }) => void
}

interface ClientToServerEvents {
  join_waiting_room: (data: { username: string; level?: 'easy' | 'medium' | 'hard'; telegram_id?: string }) => void
  leave_waiting_room: (data: { roomId?: string }) => void
  get_room_status: (data: { roomId: string }) => void
}

interface InterServerEvents {
  // Events between server instances (for scaling)
}

interface SocketData {
  username?: string
  roomId?: string
  userId?: string
  telegram_id?: string
}

export class WaitingRoomSocketServer {
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  private playerRooms = new Map<string, string>() // socketId -> roomId
  private roomSockets = new Map<string, Set<string>>() // roomId -> Set<socketId>

  constructor(io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    this.io = io

    this.setupEventHandlers()
    this.startPeriodicCleanup()
    
    console.log('🚀 Waiting Room Socket Server initialized')
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`)

      // Handle joining waiting room
      socket.on('join_waiting_room', async (data) => {
        try {
          await this.handleJoinWaitingRoom(socket, data)
        } catch (error) {
          console.error('Error handling join_waiting_room:', error)
          socket.emit('error', { message: 'Failed to join waiting room' })
        }
      })

      // Handle leaving waiting room
      socket.on('leave_waiting_room', async (data) => {
        try {
          await this.handleLeaveWaitingRoom(socket, data)
        } catch (error) {
          console.error('Error handling leave_waiting_room:', error)
          socket.emit('error', { message: 'Failed to leave waiting room' })
        }
      })

      // Handle getting room status
      socket.on('get_room_status', async (data) => {
        try {
          await this.handleGetRoomStatus(socket, data)
        } catch (error) {
          console.error('Error handling get_room_status:', error)
          socket.emit('error', { message: 'Failed to get room status' })
        }
      })

      // Handle disconnect
      socket.on('disconnect', async (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`)
        try {
          await this.handlePlayerDisconnect(socket)
        } catch (error) {
          console.error('Error handling disconnect:', error)
        }
      })
    })
  }

  /**
   * Handle player joining waiting room
   */
  private async handleJoinWaitingRoom(
    socket: any, 
    data: { username: string; level?: 'easy' | 'medium' | 'hard'; telegram_id?: string }
  ): Promise<void> {
    const { username, level = 'medium', telegram_id } = data

    if (!username || username.trim() === '') {
      socket.emit('error', { message: 'Username is required' })
      return
    }

    console.log(`👤 Player ${username} joining waiting room (${level})`)

    try {
      // Check if player is already in a room
      const existingRoomId = this.playerRooms.get(socket.id)
      if (existingRoomId) {
        console.log(`Player ${username} already in room ${existingRoomId}`)
        const room = await waitingRoomManager.getRoom(existingRoomId)
        this.emitRoomUpdate(existingRoomId, room)
        return
      }

      // Find or create a waiting room
      const room = await waitingRoomManager.findOrCreateRoom(level)

      // Add player to the room
      const updatedRoom = await waitingRoomManager.addPlayerToRoom(room.id, {
        username,
        telegram_id,
        socket_id: socket.id
      })

      // Update socket data
      socket.data.username = username
      socket.data.roomId = room.id
      socket.data.telegram_id = telegram_id

      // Track player-room relationship
      this.playerRooms.set(socket.id, room.id)
      
      // Track room-sockets relationship
      if (!this.roomSockets.has(room.id)) {
        this.roomSockets.set(room.id, new Set())
      }
      this.roomSockets.get(room.id)!.add(socket.id)

      // Join socket room for broadcasting
      socket.join(room.id)

      // Notify player of room assignment
      socket.emit('room_assigned', { 
        roomId: room.id, 
        gameLevel: room.game_level 
      })

      // Notify all players in room about new player
      this.io.to(room.id).emit('player_joined', {
        username,
        playerCount: updatedRoom.active_player_count
      })

      // Send room update to all players
      this.emitRoomUpdate(room.id, updatedRoom)

      // Check if we should start countdown or game
      await this.checkGameStart(room.id, updatedRoom)

      console.log(`✅ Player ${username} joined room ${room.id} (${updatedRoom.active_player_count}/${updatedRoom.max_players})`)

    } catch (error) {
      console.error('Error in handleJoinWaitingRoom:', error)
      socket.emit('error', { message: 'Failed to join waiting room' })
    }
  }

  /**
   * Handle player leaving waiting room
   */
  private async handleLeaveWaitingRoom(
    socket: any, 
    data: { roomId?: string }
  ): Promise<void> {
    const roomId = data.roomId || this.playerRooms.get(socket.id)
    
    if (!roomId) {
      console.log(`No room found for socket ${socket.id}`)
      return
    }

    const username = socket.data.username || 'Unknown Player'
    console.log(`👤 Player ${username} leaving room ${roomId}`)

    try {
      // Remove player from room
      const updatedRoom = await waitingRoomManager.removePlayerFromRoom(roomId, socket.id)

      // Clean up tracking
      this.playerRooms.delete(socket.id)
      const roomSocketSet = this.roomSockets.get(roomId)
      if (roomSocketSet) {
        roomSocketSet.delete(socket.id)
        if (roomSocketSet.size === 0) {
          this.roomSockets.delete(roomId)
        }
      }

      // Leave socket room
      socket.leave(roomId)

      if (updatedRoom) {
        // Notify remaining players
        this.io.to(roomId).emit('player_left', {
          username,
          playerCount: updatedRoom.active_player_count
        })

        // Send room update
        this.emitRoomUpdate(roomId, updatedRoom)

        // Check if countdown should be cancelled
        if (updatedRoom.active_player_count < updatedRoom.min_players) {
          if (waitingRoomManager.isCountdownActive(roomId)) {
            waitingRoomManager.clearCountdown(roomId)
            this.io.to(roomId).emit('countdown_cancelled', {
              roomId,
              reason: 'Not enough players'
            })
            this.io.to(roomId).emit('waiting_for_more_players', {
              currentPlayers: updatedRoom.active_player_count,
              minPlayers: updatedRoom.min_players
            })
          }
        }
      }

      console.log(`✅ Player ${username} left room ${roomId}`)

    } catch (error) {
      console.error('Error in handleLeaveWaitingRoom:', error)
    }
  }

  /**
   * Handle getting room status
   */
  private async handleGetRoomStatus(
    socket: any, 
    data: { roomId: string }
  ): Promise<void> {
    try {
      const room = await waitingRoomManager.getRoom(data.roomId)
      this.emitRoomUpdate(data.roomId, room)
    } catch (error) {
      console.error('Error getting room status:', error)
      socket.emit('error', { message: 'Room not found' })
    }
  }

  /**
   * Handle player disconnect
   */
  private async handlePlayerDisconnect(socket: any): Promise<void> {
    const roomId = this.playerRooms.get(socket.id)
    
    if (roomId) {
      await this.handleLeaveWaitingRoom(socket, { roomId })
    }
  }

  /**
   * Check if game should start based on player count
   */
  private async checkGameStart(roomId: string, room: WaitingRoom): Promise<void> {
    try {
      // Get dynamic configuration for this game level
      const config = await getGameConfig(room.game_level as 'easy' | 'medium' | 'hard')
      const MIN_PLAYERS_REQUIRED = config.minPlayers
      const WAITING_TIME = config.waitingTime * 1000 // Convert to milliseconds
      
      // If room is full, start game immediately
      if (room.active_player_count >= room.max_players) {
        console.log(`🎮 Room ${roomId} is full, starting game immediately`)
        await this.startGame(roomId, room)
        return
      }

      // If we have minimum required players (2+) and no countdown active
      if (room.active_player_count >= MIN_PLAYERS_REQUIRED && !waitingRoomManager.isCountdownActive(roomId)) {
        // Wait for more players before starting countdown
        console.log(`⏳ Room ${roomId} has ${room.active_player_count} players, waiting ${config.waitingTime}s for more players`)
        
        // Set a timer to start countdown after waiting period
        setTimeout(async () => {
          try {
            const currentRoom = await waitingRoomManager.getRoom(roomId)
            
            // Check if room still exists and has enough players
            if (currentRoom && currentRoom.active_player_count >= MIN_PLAYERS_REQUIRED) {
              // Only start countdown if not already active
              if (!waitingRoomManager.isCountdownActive(roomId)) {
                console.log(`⏰ Starting countdown for room ${roomId} after waiting period`)
                
                waitingRoomManager.startCountdown(
                  roomId,
                  (seconds) => {
                    // Emit countdown update
                    this.io.to(roomId).emit('game_starting_in', { seconds, roomId })
                  },
                  async () => {
                    // Countdown finished, start game
                    console.log(`🎮 Countdown finished for room ${roomId}, starting game`)
                    try {
                      const finalRoom = await waitingRoomManager.getRoom(roomId)
                      if (finalRoom && finalRoom.active_player_count >= MIN_PLAYERS_REQUIRED) {
                        await this.startGame(roomId, finalRoom)
                      } else {
                        console.log(`❌ Cannot start game for room ${roomId}: insufficient players`)
                      }
                    } catch (error) {
                      console.error('Error starting game after countdown:', error)
                    }
                  }
                )
              }
            }
          } catch (error) {
            console.error('Error in delayed countdown start:', error)
          }
        }, WAITING_TIME) // Wait configured time for more players
        
        // Emit waiting status
        this.io.to(roomId).emit('waiting_for_more_players', {
          currentPlayers: room.active_player_count,
          minPlayers: MIN_PLAYERS_REQUIRED,
          waitingTime: config.waitingTime
        })
      }

      // If below minimum players, ensure we're in waiting state
      if (room.active_player_count < MIN_PLAYERS_REQUIRED) {
        this.io.to(roomId).emit('waiting_for_more_players', {
          currentPlayers: room.active_player_count,
          minPlayers: MIN_PLAYERS_REQUIRED
        })
      }

    } catch (error) {
      console.error('Error checking game start:', error)
    }
  }

  /**
   * Start the game for a room
   */
  private async startGame(roomId: string, room: WaitingRoom): Promise<void> {
    try {
      console.log(`🎮 Starting game for room ${roomId}`)

      // Create game session
      const gameSession = await waitingRoomManager.startGame(roomId)

      // Notify all players that game is starting
      this.io.to(roomId).emit('start_game', {
        roomId,
        gameLevel: room.game_level,
        players: room.players
      })

      // Clean up room tracking
      this.roomSockets.delete(roomId)
      
      // Remove players from tracking (they'll be tracked in game session)
      room.players.forEach(player => {
        this.playerRooms.delete(player.socket_id)
      })

      console.log(`✅ Game started for room ${roomId} with ${room.active_player_count} players`)

    } catch (error) {
      console.error('Error starting game:', error)
      this.io.to(roomId).emit('error', { message: 'Failed to start game' })
    }
  }

  /**
   * Emit room update to all players in room
   */
  private emitRoomUpdate(roomId: string, room: WaitingRoom): void {
    this.io.to(roomId).emit('room_update', {
      roomId: room.id,
      players: room.players,
      maxPlayers: room.max_players,
      minPlayers: room.min_players,
      currentPlayers: room.active_player_count,
      gameLevel: room.game_level,
      status: room.status
    })
  }

  /**
   * Start periodic cleanup of expired rooms and disconnected players
   */
  private startPeriodicCleanup(): void {
    // Start room manager cleanup
    waitingRoomManager.startCleanupInterval()

    // Clean up socket tracking every 5 minutes
    setInterval(() => {
      this.cleanupSocketTracking()
    }, 5 * 60 * 1000)

    console.log('🧹 Started periodic socket cleanup (every 5 minutes)')
  }

  /**
   * Clean up socket tracking for disconnected sockets
   */
  private cleanupSocketTracking(): void {
    let cleanedSockets = 0
    let cleanedRooms = 0

    // Clean up player rooms for disconnected sockets
    for (const [socketId, roomId] of Array.from(this.playerRooms.entries())) {
      const socket = this.io.sockets.sockets.get(socketId)
      if (!socket) {
        this.playerRooms.delete(socketId)
        cleanedSockets++

        // Clean up from room sockets
        const roomSocketSet = this.roomSockets.get(roomId)
        if (roomSocketSet) {
          roomSocketSet.delete(socketId)
          if (roomSocketSet.size === 0) {
            this.roomSockets.delete(roomId)
            cleanedRooms++
          }
        }
      }
    }

    if (cleanedSockets > 0 || cleanedRooms > 0) {
      console.log(`🧹 Cleaned up ${cleanedSockets} disconnected sockets and ${cleanedRooms} empty room references`)
    }
  }

  /**
   * Get server statistics (for debugging/monitoring)
   */
  getStats() {
    return {
      connectedSockets: this.io.sockets.sockets.size,
      activeRooms: this.roomSockets.size,
      playerRoomMappings: this.playerRooms.size,
      cachedRooms: waitingRoomManager.getActiveRooms().size
    }
  }

  /**
   * Broadcast message to all connected clients (for admin use)
   */
  broadcastMessage(message: string): void {
    this.io.emit('error', { message })
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    return this.io
  }
}

export default WaitingRoomSocketServer
