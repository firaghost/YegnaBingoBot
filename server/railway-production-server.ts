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
    "http://localhost:3000",
    "https://localhost:3000",
    /\.vercel\.app$/,
    /localhost:\d+$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// Add test endpoint to verify API routes are working
app.get('/api/test', (req, res) => {
  console.log('🧪 TEST API CALLED - API routes are working!')
  res.json({ 
    success: true, 
    message: 'API routes are working!',
    version: '2.0-with-api-routes',
    timestamp: new Date().toISOString()
  })
})

// Add health check with version info
app.get('/health', (req, res) => {
  console.log('🏥 Health check called')
  res.json({
    status: 'healthy',
    version: '2.0-with-api-routes',
    features: ['socket.io', 'api-routes', 'game-join', 'waiting-period'],
    timestamp: new Date().toISOString()
  })
})

// Add game join API route directly to the socket server
app.post('/api/game/join', async (req, res) => {
  try {
    const timestamp = new Date().toISOString()
    console.log(`🎮 ===== GAME JOIN API CALLED [${timestamp}] =====`)
    const { roomId, userId } = req.body
    console.log(`🎯 Join request: Room=${roomId}, User=${userId} at ${timestamp}`)

    if (!roomId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: roomId, userId'
      })
    }

    // Import the game join logic
    const { supabaseAdmin } = await import('../lib/supabase')
    const supabase = supabaseAdmin

    // Get room data to use correct stake and settings
    console.log('🔍 Looking for room with ID:', roomId)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      console.error('❌ Room not found:', roomError?.message)
      return res.status(404).json({
        error: `Room '${roomId}' not found`,
        details: roomError?.message
      })
    }

    console.log('✅ Found room:', room.name, 'Stake:', room.stake)
    const stake = room.stake

    // Only cleanup truly stuck games (older than 10 minutes)
    try {
      const { data: stuckGames } = await supabase
        .from('games')
        .select('id')
        .contains('players', [userId])
        .in('status', ['waiting', 'waiting_for_players', 'countdown'])
        .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      
      if (stuckGames && stuckGames.length > 0) {
        await supabase.rpc('force_cleanup_user_from_games', { user_uuid: userId })
        console.log(`🧹 Cleaned up user ${userId} from ${stuckGames.length} stuck games`)
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError)
    }

    // Find active or waiting game for this room
    console.log(`🔍 Looking for existing games in room: ${roomId}`)
    
    let { data: activeGame, error: findError } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'waiting_for_players', 'countdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      console.error('Error finding games:', findError)
      return res.status(500).json({
        error: 'Database error',
        details: findError.message
      })
    }

    // Create new game if none exists
    if (!activeGame) {
      console.log(`🆕 No active game found, creating new game for room: ${roomId}`)
      
      const { data: newGame, error: createError } = await supabase
        .from('games')
        .insert({
          room_id: roomId,
          status: 'waiting',
          countdown_time: 10,
          players: [userId],
          bots: [],
          called_numbers: [],
          stake: room.stake,
          prize_pool: room.stake,
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating game:', createError)
        return res.status(500).json({
          error: 'Failed to create game',
          details: createError.message
        })
      }

      return res.json({
        success: true,
        gameId: newGame.id,
        game: newGame,
        action: 'created'
      })
    }

    // Join existing game
    console.log(`👥 Joining existing game: ${activeGame.id}, current players: ${activeGame.players?.length}`)
    
    if (!activeGame.players.includes(userId)) {
      console.log(`➕ Adding new player ${userId} to game ${activeGame.id}`)
      const updatedPlayers = [...activeGame.players, userId]
      const updatedPrizePool = activeGame.prize_pool + stake
      
      let newStatus = activeGame.status
      if (activeGame.status === 'countdown') {
        newStatus = 'countdown'
      } else {
        newStatus = 'waiting'
      }
      
      // Update game with new player
      const { data: updatedGame, error: joinError } = await supabase
        .from('games')
        .update({
          players: updatedPlayers,
          prize_pool: updatedPrizePool,
          status: newStatus
        })
        .eq('id', activeGame.id)
        .select()
        .single()

      if (joinError) {
        console.error('Error joining game:', joinError)
        return res.status(500).json({
          error: 'Failed to join game',
          details: joinError.message
        })
      }

      console.log(`✅ Player ${userId} joined game ${activeGame.id}. Status: ${newStatus}, Players: ${updatedPlayers.length}`)

      // If we have 2+ players and game is still in waiting status, start 30-second waiting period
      if (updatedPlayers.length >= 2 && (newStatus === 'waiting' || activeGame.status === 'waiting')) {
        console.log(`⏳ Game ${activeGame.id} has ${updatedPlayers.length} players, starting 30-second waiting period...`)
        
        // Update status to waiting_for_players with 30-second timer
        const { error: updateError } = await supabase
          .from('games')
          .update({ 
            status: 'waiting_for_players',
            countdown_time: 30,
            waiting_started_at: new Date().toISOString()
          })
          .eq('id', activeGame.id)
        
        if (updateError) {
          console.error('❌ Failed to update game status to waiting_for_players:', updateError)
        } else {
          console.log('✅ Game status updated to waiting_for_players')
        }
        
        // Notify API to start the waiting period
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_STATIC_URL || 'https://yegnabingobot-production.up.railway.app'
          console.log(`🔔 Calling waiting period API: ${baseUrl}/api/socket/start-waiting-period`)
          
          const response = await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              gameId: activeGame.id,
              waitingTime: 30,
              countdownTime: 10
            })
          })
          
          if (!response.ok) {
            console.error('❌ Waiting period API failed:', response.status, response.statusText)
            const errorText = await response.text()
            console.error('❌ Error details:', errorText)
          } else {
            const result = await response.json()
            console.log('✅ Waiting period started successfully:', result)
          }
        } catch (error) {
          console.error('❌ Error calling waiting period API:', error)
        }
      }

      // Get the latest game state after all updates
      const { data: finalGameState } = await supabase
        .from('games')
        .select('*')
        .eq('id', activeGame.id)
        .single()

      return res.json({
        success: true,
        gameId: activeGame.id,
        game: finalGameState || updatedGame,
        action: 'joined'
      })
    }

    // Player already in game - check if stuck
    console.log(`🔄 Player ${userId} already in game ${activeGame.id}, rejoining`)
    
    if (activeGame.players.length >= 2 && activeGame.status === 'waiting') {
      console.log(`⚠️ Game ${activeGame.id} stuck in waiting with ${activeGame.players.length} players, starting waiting period...`)
      
      await supabase
        .from('games')
        .update({ 
          status: 'waiting_for_players',
          countdown_time: 30,
          waiting_started_at: new Date().toISOString()
        })
        .eq('id', activeGame.id)
      
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_STATIC_URL || 'https://yegnabingobot-production.up.railway.app'
        await fetch(`${baseUrl}/api/socket/start-waiting-period`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            gameId: activeGame.id,
            waitingTime: 30,
            countdownTime: 10
          })
        })
        console.log('✅ Started waiting period for stuck game')
      } catch (error) {
        console.error('❌ Error starting waiting period for stuck game:', error)
      }
    }
    
    return res.json({
      success: true,
      gameId: activeGame.id,
      game: activeGame,
      action: 'already_joined'
    })

  } catch (error) {
    console.error('❌ Game join API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Add waiting period API route
app.post('/api/socket/start-waiting-period', async (req, res) => {
  try {
    const { gameId, waitingTime = 30, countdownTime = 10 } = req.body

    if (!gameId) {
      return res.status(400).json({ error: 'Missing gameId' })
    }

    console.log(`⏳ Starting waiting period for game ${gameId}: ${waitingTime}s waiting + ${countdownTime}s countdown`)

    const { supabaseAdmin } = await import('../lib/supabase')
    const supabase = supabaseAdmin

    // Start the 30-second waiting period
    setTimeout(async () => {
      try {
        // After 30 seconds, start the 10-second countdown
        console.log(`🔥 Starting 10-second countdown for game ${gameId}`)
        
        await supabase
          .from('games')
          .update({ 
            status: 'countdown',
            countdown_time: countdownTime,
            countdown_started_at: new Date().toISOString()
          })
          .eq('id', gameId)

        // Start the actual countdown
        let timeLeft = countdownTime
        const countdownInterval = setInterval(async () => {
          timeLeft--
          
          if (timeLeft > 0) {
            // Update countdown time
            await supabase
              .from('games')
              .update({ countdown_time: timeLeft })
              .eq('id', gameId)
            
            console.log(`⏰ Game ${gameId} countdown: ${timeLeft}s`)
          } else {
            // Countdown finished, start the game
            clearInterval(countdownInterval)
            console.log(`🎮 Starting game ${gameId}`)
            
            await supabase
              .from('games')
              .update({ 
                status: 'active',
                countdown_time: 0,
                started_at: new Date().toISOString()
              })
              .eq('id', gameId)
          }
        }, 1000)

      } catch (error) {
        console.error('Error in countdown phase:', error)
      }
    }, waitingTime * 1000)

    // Update countdown time every second during waiting period
    let waitingTimeLeft = waitingTime
    const waitingInterval = setInterval(async () => {
      waitingTimeLeft--
      
      if (waitingTimeLeft > 0) {
        await supabase
          .from('games')
          .update({ countdown_time: waitingTimeLeft })
          .eq('id', gameId)
        
        console.log(`⏳ Game ${gameId} waiting: ${waitingTimeLeft}s`)
      } else {
        clearInterval(waitingInterval)
      }
    }, 1000)

    return res.json({
      success: true,
      message: `Started waiting period for game ${gameId}`,
      waitingTime,
      countdownTime
    })

  } catch (error) {
    console.error('Error starting waiting period:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})

console.log('🚀 bingoX Production Server Starting...')
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`)
console.log('🔗 API Routes Registered:')
console.log('   📡 GET  /api/test')
console.log('   🎮 POST /api/game/join')
console.log('   ⏳ POST /api/socket/start-waiting-period')

// Temporary: Allow single-player games for testing (default enabled for now)
// Disable single-player games in production
process.env.ALLOW_SINGLE_PLAYER = 'false'
const ALLOW_SINGLE_PLAYER = false
console.log('🎮 PRODUCTION MODE: Multi-player games only')

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

// Admin endpoint to toggle single-player mode
app.post('/admin/toggle-single-player', (req, res) => {
  const currentValue = process.env.ALLOW_SINGLE_PLAYER === 'true'
  process.env.ALLOW_SINGLE_PLAYER = currentValue ? 'false' : 'true'
  
  res.json({
    success: true,
    message: `Single-player mode ${process.env.ALLOW_SINGLE_PLAYER === 'true' ? 'enabled' : 'disabled'}`,
    allowSinglePlayer: process.env.ALLOW_SINGLE_PLAYER === 'true'
  })
  
  console.log(`🔧 Admin: Single-player mode ${process.env.ALLOW_SINGLE_PLAYER === 'true' ? 'enabled' : 'disabled'}`)
})

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
