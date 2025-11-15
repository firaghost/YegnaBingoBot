import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import cors from 'cors'
import WaitingRoomSocketServer from './waiting-room-server'
import InGameSocketServer from './ingame-socket-server'
import { waitingRoomManager } from '../lib/waiting-room-manager'
import { gameStateManager } from '../lib/game-state-manager'

const app = express()
const httpServer = createServer(app)

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}))
app.use(express.json())

// Create a single Socket.IO instance
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Initialize both socket servers with the shared Socket.IO instance
const waitingRoomSocketServer = new WaitingRoomSocketServer(io as any)
const inGameSocketServer = new InGameSocketServer(io as any)

// Connect waiting room to in-game transition
class GameTransitionManager {
  constructor() {
    this.setupTransitionHandlers()
  }

  private setupTransitionHandlers(): void {
    // Override the waiting room's game start to transition to in-game
    const originalStartGame = (waitingRoomSocketServer as any).startGame.bind(waitingRoomSocketServer)
    
    ;(waitingRoomSocketServer as any).startGame = async (roomId: string, room: any) => {
      try {
        console.log(`🔄 Transitioning room ${roomId} from waiting to in-game`)

        // Refresh room to get latest players including bots
        const refreshedRoom = await waitingRoomManager.getRoom(roomId)
        
        // Get all players from waiting room (including bots)
        const players = refreshedRoom.players.map((p: any) => ({
          username: p.username,
          socket_id: p.socket_id,
          user_id: p.telegram_id // Map telegram_id to user_id
        }))

        console.log(`📋 Room ${roomId} has ${players.length} total players (humans + bots)`)

        // Start the actual game
        await inGameSocketServer.startGame(roomId, room.game_level, players)

        // Notify waiting room clients to transition
        waitingRoomSocketServer.getIO().to(roomId).emit('transition_to_game', {
          roomId,
          gameLevel: room.game_level,
          message: 'Game starting! Transitioning to game mode...'
        })

        console.log(`✅ Successfully transitioned room ${roomId} to in-game mode with ${players.length} players`)

      } catch (error) {
        console.error(`❌ Failed to transition room ${roomId} to in-game:`, error)
        
        // Fallback to original behavior
        waitingRoomSocketServer.getIO().to(roomId).emit('start_game', {
          roomId: room.id,
          gameLevel: room.game_level,
          players: room.players
        })
      }
    }
  }
}

// Initialize transition manager
new GameTransitionManager()

// Health check endpoint
app.get('/health', (req, res) => {
  const waitingRoomStats = waitingRoomSocketServer.getStats()
  const inGameStats = inGameSocketServer.getStats()
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      waitingRoom: waitingRoomStats,
      inGame: inGameStats
    },
    totalConnections: waitingRoomStats.connectedSockets + inGameStats.connectedSockets
  })
})

// Get active waiting rooms
app.get('/api/rooms/waiting', async (req, res) => {
  try {
    const activeRooms = Array.from(waitingRoomManager.getActiveRooms().values())
    res.json({
      success: true,
      rooms: activeRooms,
      count: activeRooms.length
    })
  } catch (error) {
    console.error('Error getting waiting rooms:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get waiting rooms'
    })
  }
})

// Get active games
app.get('/api/games/active', async (req, res) => {
  try {
    const activeGames = Array.from(gameStateManager.getActiveGames().entries()).map(([roomId, game]) => ({
      roomId,
      status: game.status,
      gameLevel: game.game_level,
      playerCount: game.players.size,
      spectatorCount: game.spectators.size,
      numbersCalled: game.numbers_called.length,
      startedAt: game.started_at,
      lastActivity: game.last_activity
    }))

    res.json({
      success: true,
      games: activeGames,
      count: activeGames.length
    })
  } catch (error) {
    console.error('Error getting active games:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get active games'
    })
  }
})

// Get specific game details
app.get('/api/games/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    const gameSnapshot = gameStateManager.getGameSnapshot(roomId)
    
    if (gameSnapshot) {
      res.json({
        success: true,
        game: gameSnapshot
      })
    } else {
      res.status(404).json({
        success: false,
        error: 'Game not found'
      })
    }
  } catch (error) {
    console.error('Error getting game details:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get game details'
    })
  }
})

// Admin endpoint to force end game
app.post('/api/admin/games/:roomId/end', async (req, res) => {
  try {
    const { roomId } = req.params
    const { reason = 'admin_ended' } = req.body

    await inGameSocketServer.forceEndGame(roomId, reason)
    
    res.json({
      success: true,
      message: `Game ${roomId} ended by admin`
    })
  } catch (error) {
    console.error('Error ending game:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to end game'
    })
  }
})

// Admin endpoint to cleanup rooms
app.post('/api/admin/cleanup', async (req, res) => {
  try {
    await waitingRoomManager.runCleanup()
    res.json({
      success: true,
      message: 'Cleanup completed'
    })
  } catch (error) {
    console.error('Error running cleanup:', error)
    res.status(500).json({
      success: false,
      error: 'Cleanup failed'
    })
  }
})

// Admin endpoint to broadcast message
app.post('/api/admin/broadcast', (req, res) => {
  try {
    const { message, target = 'all' } = req.body
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      })
    }

    if (target === 'waiting' || target === 'all') {
      waitingRoomSocketServer.broadcastMessage(message)
    }
    
    if (target === 'game' || target === 'all') {
      inGameSocketServer.getIO().emit('game_error', { message })
    }

    res.json({
      success: true,
      message: 'Message broadcasted',
      target
    })
  } catch (error) {
    console.error('Error broadcasting message:', error)
    res.status(500).json({
      success: false,
      error: 'Broadcast failed'
    })
  }
})

// Admin endpoint to get comprehensive stats
app.get('/api/admin/stats', (req, res) => {
  try {
    const waitingRoomStats = waitingRoomSocketServer.getStats()
    const inGameStats = inGameSocketServer.getStats()
    const activeRooms = waitingRoomManager.getActiveRooms()
    const activeGames = gameStateManager.getActiveGames()
    
    res.json({
      success: true,
      stats: {
        connections: {
          waitingRoom: waitingRoomStats.connectedSockets,
          inGame: inGameStats.connectedSockets,
          total: waitingRoomStats.connectedSockets + inGameStats.connectedSockets
        },
        rooms: {
          waiting: waitingRoomStats.activeRooms,
          inGame: inGameStats.activeGameRooms,
          total: waitingRoomStats.activeRooms + inGameStats.activeGameRooms
        },
        games: {
          waiting: activeRooms.size,
          active: activeGames.size,
          total: activeRooms.size + activeGames.size
        },
        details: {
          waitingRooms: Array.from(activeRooms.entries()).map(([roomId, room]) => ({
            roomId,
            gameLevel: room.game_level,
            playerCount: room.active_player_count,
            maxPlayers: room.max_players,
            status: room.status,
            createdAt: room.created_at
          })),
          activeGames: Array.from(activeGames.entries()).map(([roomId, game]) => ({
            roomId,
            status: game.status,
            gameLevel: game.game_level,
            playerCount: game.players.size,
            spectatorCount: game.spectators.size,
            numbersCalled: game.numbers_called.length,
            startedAt: game.started_at,
            lastActivity: game.last_activity
          }))
        }
      }
    })
  } catch (error) {
    console.error('Error getting comprehensive stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get stats'
    })
  }
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  })
})

const PORT = process.env.PORT || 3001

// Start server
httpServer.listen(PORT, () => {
  console.log('')
  console.log('🎮 ========================================')
  console.log('🎮 BINGOX INTEGRATED GAME SERVER STARTED!')
  console.log('🎮 ========================================')
  console.log('')
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Health check: http://localhost:${PORT}/health`)
  console.log(`📊 Admin stats: http://localhost:${PORT}/api/admin/stats`)
  console.log(`🏠 Waiting rooms: http://localhost:${PORT}/api/rooms/waiting`)
  console.log(`🎯 Active games: http://localhost:${PORT}/api/games/active`)
  console.log('')
  console.log('🔌 Socket.IO Namespaces:')
  console.log('   🏠 Waiting Room Events:')
  console.log('      📥 join_waiting_room, leave_waiting_room')
  console.log('      📤 room_update, game_starting_in, start_game')
  console.log('')
  console.log('   🎮 In-Game Events:')
  console.log('      📥 join_game, join_spectator, bingo_claim')
  console.log('      📤 number_called, bingo_winner, game_over')
  console.log('')
  console.log('✅ Ready for multiplayer BingoX games!')
  console.log('')
})

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('🛑 Shutting down gracefully...')
  
  // Cleanup game states
  inGameSocketServer.cleanup()
  
  // Close server
  httpServer.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

export { app, httpServer, waitingRoomSocketServer, inGameSocketServer }
