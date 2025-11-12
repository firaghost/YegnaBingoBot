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
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "https://yegnagame.vercel.app",
    /\.vercel\.app$/,
    /localhost:\d+$/
  ],
  credentials: true
}))
app.use(express.json())

console.log('🚀 BingoX Production Server Starting...')
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'https://yegnagame.vercel.app'}`)

// Create a single Socket.IO instance
const io = new SocketServer(httpServer, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "https://yegnagame.vercel.app",
      /\.vercel\.app$/,
      /localhost:\d+$/
    ],
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

        // Get players from waiting room
        const players = room.players.map((p: any) => ({
          username: p.username,
          socket_id: p.socket_id,
          user_id: p.telegram_id // Map telegram_id to user_id
        }))

        // Start the actual game
        await inGameSocketServer.startGame(roomId, room.game_level, players)

        // Notify waiting room clients to transition
        waitingRoomSocketServer.getIO().to(roomId).emit('start_game', {
          roomId: room.id,
          gameLevel: room.game_level,
          players: room.players
        })

        console.log(`✅ Successfully transitioned room ${roomId} to in-game mode`)

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
    version: '2.0.0',
    services: {
      waitingRoom: {
        ...waitingRoomStats,
        description: 'Waiting room matchmaking system'
      },
      inGame: {
        ...inGameStats,
        description: 'In-game synchronization system'
      }
    },
    totalConnections: waitingRoomStats.connectedSockets + inGameStats.connectedSockets,
    environment: process.env.NODE_ENV || 'development'
  })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'BingoX Game Server',
    version: '2.0.0',
    status: 'running',
    features: [
      'Waiting Room System',
      'In-Game Synchronization', 
      'Spectator Mode',
      'Reconnect Handling',
      'Real-time Number Calling'
    ],
    endpoints: {
      health: '/health',
      waitingRooms: '/api/rooms/waiting',
      activeGames: '/api/games/active',
      adminStats: '/api/admin/stats'
    }
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

// Admin stats endpoint
app.get('/api/admin/stats', (req, res) => {
  try {
    const waitingRoomStats = waitingRoomSocketServer.getStats()
    const inGameStats = inGameSocketServer.getStats()
    const activeRooms = waitingRoomManager.getActiveRooms()
    const activeGames = gameStateManager.getActiveGames()
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      server: {
        version: '2.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV
      },
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
        }
      }
    })
  } catch (error) {
    console.error('Error getting stats:', error)
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
    error: 'Endpoint not found',
    availableEndpoints: ['/health', '/api/rooms/waiting', '/api/games/active', '/api/admin/stats']
  })
})

const PORT = process.env.PORT || 3001

// Start server
httpServer.listen(PORT, () => {
  console.log('')
  console.log('🎮 ========================================')
  console.log('🎮 BINGOX PRODUCTION SERVER STARTED!')
  console.log('🎮 ========================================')
  console.log('')
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Health check: https://yegnabingobot-production.up.railway.app/health`)
  console.log(`📊 Admin stats: https://yegnabingobot-production.up.railway.app/api/admin/stats`)
  console.log('')
  console.log('🔌 Socket.IO Features Available:')
  console.log('   🏠 Waiting Room System (Phase 1)')
  console.log('   🎮 In-Game Synchronization (Phase 2)')
  console.log('   👁️ Spectator Mode')
  console.log('   🔄 Reconnect Handling (30s grace)')
  console.log('   📢 Real-time Number Calling')
  console.log('')
  console.log('✅ Ready for multiplayer BingoX games!')
  console.log('')
})

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('🛑 Shutting down gracefully...')
  
  // Cleanup game states
  try {
    inGameSocketServer.cleanup()
    gameStateManager.cleanupAllGames()
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
  
  // Close server
  httpServer.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  gracefulShutdown()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  gracefulShutdown()
})

export { app, httpServer, waitingRoomSocketServer, inGameSocketServer }
