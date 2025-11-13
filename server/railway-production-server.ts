import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import cors from 'cors'

// Global socket server declaration
declare global {
  var io: SocketServer | undefined
}
import WaitingRoomSocketServer from './waiting-room-server'
import InGameSocketServer from './ingame-socket-server'
import { waitingRoomManager } from '../lib/waiting-room-manager'
import { gameStateManager } from '../lib/game-state-manager'
import { gameStateCache } from './game-state-cache'
import { botManager } from '../lib/bot-manager'

const app = express()
const httpServer = createServer(app)

// Store active game intervals to manage number calling
const gameIntervals = new Map<string, NodeJS.Timeout>()

// Store active waiting periods to prevent duplicates
const activeWaitingPeriods = new Set<string>()

// Store active countdowns to prevent duplicates
const activeCountdowns = new Set<string>()

// Store game start times for fairness validation
const gameStartTimes = new Map<string, number>()

// Store game intervals for fairness validation
const gameIntervalSettings = new Map<string, number>() // gameId -> intervalMs

// Validate number calling fairness with dynamic intervals
function validateNumberCallFairness(gameId: string, callCount: number, intervalMs: number): boolean {
  const startTime = gameStartTimes.get(gameId)
  if (!startTime) {
    gameStartTimes.set(gameId, Date.now())
    gameIntervalSettings.set(gameId, intervalMs)
    return true
  }
  
  const elapsed = Date.now() - startTime
  const expectedCalls = Math.floor(elapsed / intervalMs) // Dynamic interval per call
  const tolerance = 2 // Allow 2 calls variance
  
  const isValid = Math.abs(callCount - expectedCalls) <= tolerance
  if (!isValid) {
    console.warn(`⚠️ Fairness violation in game ${gameId}: Expected ~${expectedCalls} calls, got ${callCount} (${Math.abs(callCount - expectedCalls)} variance)`)
  }
  
  return isValid
}

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://yegnabingobot-production.up.railway.app",
    process.env.FRONTEND_URL
  ].filter((url): url is string => Boolean(url)),
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}

app.use(cors(corsOptions))
app.use(express.json())

// Initialize Socket.IO with CORS
const io = new SocketServer(httpServer, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    allowedHeaders: corsOptions.allowedHeaders,
    credentials: corsOptions.credentials
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
})

// Make io globally available
global.io = io

// Initialize socket servers
console.log('🔌 Initializing Socket.IO servers...')
const waitingRoomSocketServer = new WaitingRoomSocketServer(io)
const inGameSocketServer = new InGameSocketServer(io)

console.log('✅ Socket servers initialized')

// Health check endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0-with-api-routes',
    features: ['socket.io', 'api-routes', 'game-join', 'waiting-period'],
    timestamp: new Date().toISOString()
  })
})

// Add CORS headers for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// ============================================
// FIXED GAME JOIN API - USES NEW BOT SYSTEM FORMAT
// ============================================
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

    // Clean up any old format games (players array) for this user
    try {
      const { data: oldGames } = await supabase
        .from('games')
        .select('id, players')
        .eq('room_id', roomId)
        .not('players', 'is', null)
      
      if (oldGames && oldGames.length > 0) {
        for (const game of oldGames) {
          // Check if this user is in the players array
          if (game.players && Array.isArray(game.players) && game.players.includes(userId)) {
            console.log(`🧹 Cleaning up old format game ${game.id} for user ${userId}`)
            await supabase.from('games').delete().eq('id', game.id)
          }
        }
      }
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError)
    }

    // Check if user already has a waiting game record in this room (new format)
    const { data: existingGame } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('status', 'waiting')
      .maybeSingle()

    if (existingGame) {
      console.log(`🔄 User ${userId} already has waiting game in room ${roomId}`)
      
      // Count all players and check if countdown should start
      const { data: allPlayersInRoom } = await supabase
        .from('games')
        .select('user_id, users!inner(is_bot)')
        .eq('room_id', roomId)
        .eq('status', 'waiting')
      
      const totalPlayersInRoom = allPlayersInRoom?.length || 0
      const realPlayerCount = allPlayersInRoom?.filter((p: any) => !p.users?.is_bot).length || 0
      
      return res.json({
        success: true,
        gameId: existingGame.id,
        game: existingGame,
        action: 'rejoined',
        roomStats: {
          totalPlayers: totalPlayersInRoom,
          realPlayers: realPlayerCount,
          bots: totalPlayersInRoom - realPlayerCount
        }
      })
    }

    // Create new game record in NEW BOT SYSTEM FORMAT
    console.log(`🆕 Creating new game record for user ${userId} in room ${roomId}`)
    
    const { data: newGame, error: createError } = await supabase
      .from('games')
      .insert({
        room_id: roomId,
        user_id: userId,           // ✅ NEW FORMAT: individual user_id field
        status: 'waiting',
        stake: room.stake,
        game_level: 'medium'       // ✅ Compatible with bot system
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

    console.log(`✅ Created new game record: ${newGame.id} for user ${userId}`)

    // Count all players in the room using NEW FORMAT
    const { data: allPlayersInRoom } = await supabase
      .from('games')
      .select('user_id, users!inner(is_bot)')
      .eq('room_id', roomId)
      .eq('status', 'waiting')
    
    const totalPlayersInRoom = allPlayersInRoom?.length || 0
    const realPlayerCount = allPlayersInRoom?.filter((p: any) => !p.users?.is_bot).length || 0
    const botCount = allPlayersInRoom?.filter((p: any) => p.users?.is_bot).length || 0
    
    console.log(`👥 Room ${roomId} now has: ${totalPlayersInRoom} total (${realPlayerCount} real, ${botCount} bots)`)

    // ✅ FIXED COUNTDOWN LOGIC: Uses new format counting
    if (realPlayerCount >= 1 && totalPlayersInRoom >= 2 && !activeWaitingPeriods.has(roomId)) {
      console.log(`⏳ Starting countdown: ${realPlayerCount} real players, ${totalPlayersInRoom} total players`)
      
      activeWaitingPeriods.add(roomId)
      
      // Update all waiting games in this room to waiting_for_players status
      const { error: updateError } = await supabase
        .from('games')
        .update({ 
          status: 'waiting_for_players',
          countdown_time: 30,
          waiting_started_at: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('status', 'waiting')
      
      if (updateError) {
        console.error('❌ Failed to start countdown:', updateError)
        activeWaitingPeriods.delete(roomId)
      } else {
        console.log('✅ Countdown started for all players in room')
        
        // Start the actual countdown timer
        setTimeout(async () => {
          try {
            // Transition all waiting_for_players games to countdown
            await supabase
              .from('games')
              .update({ 
                status: 'countdown',
                countdown_time: 10
              })
              .eq('room_id', roomId)
              .eq('status', 'waiting_for_players')
            
            console.log(`🔥 Room ${roomId} transitioned to countdown phase`)
            
            // Start game after countdown
            setTimeout(async () => {
              await supabase
                .from('games')
                .update({ 
                  status: 'active',
                  started_at: new Date().toISOString()
                })
                .eq('room_id', roomId)
                .eq('status', 'countdown')
              
              console.log(`🎮 Room ${roomId} game started!`)
              activeWaitingPeriods.delete(roomId)
            }, 10000) // 10 second countdown
            
          } catch (error) {
            console.error('Error in countdown transition:', error)
            activeWaitingPeriods.delete(roomId)
          }
        }, 30000) // 30 second waiting period
      }
    }

    return res.json({
      success: true,
      gameId: newGame.id,
      game: newGame,
      action: 'created',
      roomStats: {
        totalPlayers: totalPlayersInRoom,
        realPlayers: realPlayerCount,
        bots: botCount
      }
    })

  } catch (error: any) {
    console.error('❌ Game join error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
})

// Start the actual server and socket setup
const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`)
  console.log('🔗 API Routes Registered:')
  console.log('   📡 GET  /api/test')
  console.log('   🎮 POST /api/game/join (FIXED - Uses new bot system format)')
  console.log('')
  console.log('✅ Ready for multiplayer BingoX games!')
  console.log('🤖 Bot presence maintained successfully')
})

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('🔄 Graceful shutdown initiated...')
  
  // Clear all game intervals
  gameIntervals.forEach((interval, gameId) => {
    clearInterval(interval)
    console.log(`🛑 Cleared interval for game ${gameId}`)
  })
  gameIntervals.clear()
  
  // Clear tracking sets
  activeWaitingPeriods.clear()
  activeCountdowns.clear()
  gameStartTimes.clear()
  gameIntervalSettings.clear()
  
  httpServer.close(() => {
    console.log('✅ Server closed successfully')
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
