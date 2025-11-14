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

const app = express()
const httpServer = createServer(app)

// Silence logs in production (keep errors). Override is possible with ENABLE_LOGS=true
const SILENCE_LOGS = process.env.NODE_ENV === 'production' && process.env.ENABLE_LOGS !== 'true'
if (SILENCE_LOGS) {
  const noop = () => {}
  ;(console as any).log = noop
  ;(console as any).info = noop
  ;(console as any).debug = noop
  ;(console as any).warn = noop
  ;(console as any).trace = noop
  ;(console as any).time = noop
  ;(console as any).timeEnd = noop
}

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
    console.warn(`⚠️ Timing anomaly detected for game ${gameId}: Expected ~${expectedCalls} calls, got ${callCount} (${intervalMs}ms intervals)`)
  }
  
  return isValid
}

// Number calling function - Fair and consistent with caching
async function startNumberCalling(gameId: string) {
  try {
    // CRITICAL: Check if number calling already active for this game
    if (gameIntervals.has(gameId)) {
      console.log(`⚠️ Number calling already active for game ${gameId}, preventing duplicate`)
      return
    }
    
    // Try to get from cache first
    let game = gameStateCache.get(gameId)
    
    // If not in cache, load from database
    if (!game) {
      console.log(`📥 Loading game ${gameId} into cache...`)
      game = await gameStateCache.loadFromDatabase(gameId)
    }

    if (!game || game.status !== 'active') {
      console.log(`❌ Cannot start number calling - game ${gameId} not active`)
      return
    }

    // Get level settings for this game
    const { supabaseAdmin } = await import('../lib/supabase')
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('game_level, default_level')
      .eq('id', game.room_id)
      .single()
    
    const gameLevel = room?.game_level || room?.default_level || 'medium'
    
    // Get level configuration
    const { data: levelConfig } = await supabaseAdmin
      .from('levels')
      .select('call_interval, win_threshold, description')
      .eq('name', gameLevel)
      .single()
    
    const callIntervalMs = levelConfig?.call_interval || 2000 // Default to medium (2 seconds)
    const winThreshold = levelConfig?.win_threshold || 5
    
    console.log(`📢 Number calling started for game ${gameId} (${gameLevel} level: ${callIntervalMs}ms intervals, ${winThreshold} win threshold)`)
    console.log(`📝 Level description: ${levelConfig?.description || 'Standard game'}`)

    // Get current game state from cache
    const { called_numbers: alreadyCalled, last_number_called: lastCalledNumber, last_called_at: lastCalledAt } = game

    // Generate shuffled sequence of all numbers for fairness
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
    let availableNumbers = allNumbers.filter(num => !alreadyCalled.includes(num))
    
    // Shuffle the available numbers for true randomness
    for (let i = availableNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]]
    }
    
    let numberIndex = 0
    let callCount = alreadyCalled.length
    
    // Get BINGO letter for the number
    const getBingoLetter = (num: number) => {
      if (num >= 1 && num <= 15) return 'B'
      if (num >= 16 && num <= 30) return 'I'
      if (num >= 31 && num <= 45) return 'N'
      if (num >= 46 && num <= 60) return 'G'
      if (num >= 61 && num <= 75) return 'O'
      return 'N'
    }
    
    const callInterval = setInterval(async () => {
      try {
        // Check if game is still active (from cache - instant)
        const currentGame = gameStateCache.get(gameId)

        if (!currentGame || currentGame.status !== 'active' || currentGame.winner_id) {
          console.log(`🛑 Stopping number calling - game ${gameId} ended (status: ${currentGame?.status}, winner: ${currentGame?.winner_id})`)
          clearInterval(callInterval)
          gameIntervals.delete(gameId)
          gameStateCache.remove(gameId) // Clean up cache
          return
        }

        // Check if we have numbers left to call
        if (numberIndex >= availableNumbers.length) {
          console.log(`🏁 All available numbers called for game ${gameId}`)
          clearInterval(callInterval)
          gameIntervals.delete(gameId)
          return
        }

        // Use secure fair number calling function with fallback
        try {
          const { supabaseAdmin } = await import('../lib/supabase')
          const { data: numberResult, error: numberError } = await supabaseAdmin
            .rpc('call_next_number', {
              p_game_id: gameId
            })

          if (numberError) {
            console.warn('⚠️ Secure number calling failed, falling back to manual method:', numberError)
            throw new Error('Fallback to manual method')
          }

          const result = numberResult[0]
          if (!result.success) {
            console.log(`🏁 Number calling ended: ${result.message}`)
            clearInterval(callInterval)
            gameIntervals.delete(gameId)
            return
          }

          const calledNumber = result.number_called
          const letter = result.letter
          const remainingNumbers = result.remaining_numbers

          // Update cache with secure result
          gameStateCache.update(gameId, {
            called_numbers: [...(currentGame.called_numbers || []), calledNumber],
            last_number_called: calledNumber,
            last_called_at: new Date().toISOString(),
            latest_number: { letter, number: calledNumber }
          }, { immediate: true, priority: 'high' })

          console.log(`📢 Game ${gameId}: Called ${letter}${calledNumber} (${75 - remainingNumbers}/75) - SECURE`)

          // Check if game should end
          if (remainingNumbers === 0) {
            console.log(`🏁 All numbers called for game ${gameId}`)
            clearInterval(callInterval)
            gameIntervals.delete(gameId)
            return
          }

        } catch (fallbackError) {
          // FALLBACK: Use original manual method if secure function fails
          console.log('📋 Using fallback manual number calling')
          
          const calledNumber = availableNumbers[numberIndex]
          const letter = getBingoLetter(calledNumber)
          callCount++
          numberIndex++
          
          const newCalledNumbers = [...alreadyCalled, ...availableNumbers.slice(0, numberIndex)]
          
          // Update cache (original method)
          gameStateCache.update(gameId, {
            called_numbers: newCalledNumbers,
            last_number_called: calledNumber,
            last_called_at: new Date().toISOString(),
            latest_number: { letter, number: calledNumber }
          }, { immediate: true, priority: 'high' })
          
          const isFair = validateNumberCallFairness(gameId, callCount, callIntervalMs)
          console.log(`📢 Game ${gameId}: Called ${letter}${calledNumber} (${callCount}/75) - ${isFair ? 'Fair sequence' : 'Timing anomaly detected'}`)
        }

      } catch (error) {
        console.error(`❌ Error calling number for game ${gameId}:`, error)
        // Don't stop on single errors, but log them
      }
    }, callIntervalMs) // Dynamic interval based on game level (Easy: 1s, Medium: 2s, Hard: 3s)

    // Store interval for cleanup
    gameIntervals.set(gameId, callInterval)

  } catch (error) {
    console.error(`❌ Error starting number calling for game ${gameId}:`, error)
  }
}

// Function to stop number calling for a game
function stopNumberCalling(gameId: string) {
  const interval = gameIntervals.get(gameId)
  if (interval) {
    clearInterval(interval)
    gameIntervals.delete(gameId)
    console.log(`🛑 Stopped number calling for game ${gameId}`)
    
    // Also clean up waiting period and countdown tracking
    activeWaitingPeriods.delete(gameId)
    activeCountdowns.delete(gameId)
    gameStartTimes.delete(gameId) // Clean up timing data
    gameIntervalSettings.delete(gameId) // Clean up interval settings
    
    // Force sync cache to database before cleanup
    gameStateCache.forceSyncToDatabase(gameId).then(() => {
      console.log(`✅ Final cache sync completed for game ${gameId}`)
    }).catch(err => {
      console.error(`❌ Final cache sync failed for game ${gameId}:`, err)
    })
    
    console.log(`🧹 Cleaned up all tracking for game ${gameId}`)
  }
  // Removed the "No active interval found" warning to reduce spam
}

// Cleanup finished games and stop their number calling
async function cleanupFinishedGames() {
  try {
    // Only cleanup if there are active intervals to avoid spam
    if (gameIntervals.size === 0) {
      return // No active games, skip cleanup
    }

    const { supabaseAdmin } = await import('../lib/supabase')
    const supabase = supabaseAdmin

    // Only get finished games that have active intervals
    const activeGameIds = Array.from(gameIntervals.keys())
    if (activeGameIds.length === 0) {
      return
    }

    const { data: finishedGames } = await supabase
      .from('games')
      .select('id')
      .in('status', ['finished', 'cancelled'])
      .in('id', activeGameIds) // Only check games that actually have active intervals

    let cleanedCount = 0
    if (finishedGames && finishedGames.length > 0) {
      finishedGames.forEach(game => {
        if (gameIntervals.has(game.id)) {
          stopNumberCalling(game.id)
          cleanedCount++
        }
      })
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} finished games with active intervals`)
    }
  } catch (error) {
    console.error('Error cleaning up finished games:', error)
  }
}

// Run cleanup every 10 minutes (reduced frequency)
setInterval(cleanupFinishedGames, 10 * 60 * 1000)

// Run cache cleanup every 5 minutes (reduced frequency)
setInterval(() => {
  // Only run cache cleanup if there are active games or cached data
  const stats = gameStateCache.getStats()
  if (gameIntervals.size > 0 || stats.cached_games > 0) {
    gameStateCache.cleanup()
  }
}, 5 * 60 * 1000)

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

// Add server status endpoint
app.get('/status', (req, res) => {
  const cacheStats = gameStateCache.getStats()
  res.json({
    status: 'running',
    active_games: gameIntervals.size,
    active_waiting_periods: activeWaitingPeriods.size,
    active_countdowns: activeCountdowns.size,
    cache_stats: cacheStats,
    memory_usage: process.memoryUsage(),
    uptime: process.uptime(),
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
      
      // Use secure game creation function with built-in validation
      const { data: createResult, error: createError } = await supabase
        .rpc('create_game_safe', {
          p_room_id: roomId,
          p_creator_id: userId,
          p_stake: room.stake
        })

      if (createError) {
        console.error('Error creating game:', createError)
        return res.status(500).json({
          error: 'Failed to create game',
          details: createError.message
        })
      }

      const result = createResult[0]
      if (!result.success) {
        console.warn(`⚠️ Game creation failed: ${result.message}`)
        return res.status(400).json({
          error: result.message
        })
      }

      // Get the created game details
      const { data: newGame } = await supabase
        .from('games')
        .select('*')
        .eq('id', result.game_id)
        .single()

      return res.json({
        success: true,
        gameId: result.game_id,
        game: newGame,
        action: 'created'
      })
    }

    // Join existing game
    console.log(`👥 Joining existing game: ${activeGame.id}, current players: ${activeGame.players?.length}`)
    
    // CRITICAL: If game is already active, player should spectate instead
    if (activeGame.status === 'active') {
      console.log(`⚠️ Game ${activeGame.id} is already active, user ${userId} should join as spectator`)
      return res.json({
        success: true,
        gameId: activeGame.id,
        game: activeGame,
        action: 'spectate',
        message: 'Game already in progress. Joining as spectator.'
      })
    }
    
    if (!activeGame.players.includes(userId)) {
      console.log(`➕ Adding new player ${userId} to game ${activeGame.id}`)
      
      // Use atomic player joining function with fallback
      try {
        const { data: joinResult, error: joinFunctionError } = await supabase
          .rpc('add_player_to_game', {
            p_game_id: activeGame.id,
            p_user_id: userId,
            p_max_players: room.max_players || 20
          })

        if (joinFunctionError) {
          console.warn('⚠️ Atomic join function failed, falling back to manual method:', joinFunctionError)
          throw new Error('Fallback to manual method')
        }

        const result = joinResult[0]
        if (!result.success) {
          console.warn(`⚠️ Player join rejected: ${result.message}`)
          return res.status(400).json({
            error: result.message,
            currentPlayerCount: result.current_player_count
          })
        }

        console.log(`✅ Player ${userId} added atomically. Players: ${result.current_player_count}`)
        
        // Get updated game state
        const { data: updatedGame, error: fetchError } = await supabase
          .from('games')
          .select('*')
          .eq('id', activeGame.id)
          .single()

        if (fetchError) {
          console.error('Error fetching updated game:', fetchError)
          return res.status(500).json({
            error: 'Failed to get updated game state'
          })
        }

        // Continue with existing logic using updatedGame
        activeGame = updatedGame

      } catch (fallbackError) {
        // FALLBACK: Use original manual method if atomic function fails
        console.log('📋 Using fallback manual player joining method')
        
        const updatedPlayers = [...activeGame.players, userId]
        const updatedPrizePool = activeGame.prize_pool + stake
        
        let newStatus = activeGame.status
        if (activeGame.status === 'countdown') {
          newStatus = 'countdown'
        } else {
          newStatus = 'waiting'
        }
        
        // Update game with new player (original method)
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

        activeGame = updatedGame
      }

      console.log(`✅ Player ${userId} joined game ${activeGame.id}. Status: ${activeGame.status}, Players: ${activeGame.players.length}`)

      // If we have 2+ players and game is still in waiting status, start 30-second waiting period (only once)
      if (activeGame.players.length >= 2 && activeGame.status === 'waiting' && !activeWaitingPeriods.has(activeGame.id)) {
        console.log(`⏳ Game ${activeGame.id} has ${activeGame.players.length} players, starting 30-second waiting period...`)
        
        // Mark this game as having an active waiting period
        activeWaitingPeriods.add(activeGame.id)
        
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
          activeWaitingPeriods.delete(activeGame.id) // Remove from set on error
          return res.status(500).json({
            error: 'Failed to start waiting period',
            details: updateError.message
          })
        } else {
          console.log('✅ Game status updated to waiting_for_players')
        }
        
        // Start the waiting period directly
        console.log(`🔔 Starting waiting period directly for game ${activeGame.id}`)
        
        // Start the 30-second waiting period
        setTimeout(async () => {
          try {
            // Check if countdown is already active for this game
            if (activeCountdowns.has(activeGame.id)) {
              console.log(`⚠️ Countdown already active for game ${activeGame.id}, skipping`)
              return
            }
            
            // Mark countdown as active
            activeCountdowns.add(activeGame.id)
            
            // After 30 seconds, start the 10-second countdown
            console.log(`🔥 Starting 10-second countdown for game ${activeGame.id}`)
            
            await supabase
              .from('games')
              .update({ 
                status: 'countdown',
                countdown_time: 10,
                countdown_started_at: new Date().toISOString()
              })
              .eq('id', activeGame.id)

            // Start the actual countdown
            let timeLeft = 10
            const countdownInterval = setInterval(async () => {
              timeLeft--
              
              if (timeLeft > 0) {
                // Update countdown time
                await supabase
                  .from('games')
                  .update({ countdown_time: timeLeft })
                  .eq('id', activeGame.id)
                
                console.log(`⏰ Game ${activeGame.id} countdown: ${timeLeft}s`)
              } else {
                // Countdown finished, start the game
                clearInterval(countdownInterval)
                activeCountdowns.delete(activeGame.id) // Remove from active countdowns
                console.log(`🎮 Starting game ${activeGame.id}`)
                
                await supabase
                  .from('games')
                  .update({ 
                    status: 'active',
                    countdown_time: 0,
                    started_at: new Date().toISOString()
                  })
                  .eq('id', activeGame.id)

                // Start number calling (with duplicate protection)
                if (!gameIntervals.has(activeGame.id)) {
                  console.log(`📢 Starting number calling for game ${activeGame.id}`)
                  startNumberCalling(activeGame.id)
                } else {
                  console.log(`⚠️ Number calling already active for game ${activeGame.id}`)
                }
              }
            }, 1000)

          } catch (error) {
            console.error('Error in countdown phase:', error)
            activeCountdowns.delete(activeGame.id) // Remove from active countdowns on error
          }
        }, 30000) // 30 seconds

        // Update countdown time every second during waiting period
        let waitingTimeLeft = 30
        const waitingInterval = setInterval(async () => {
          waitingTimeLeft--
          
          if (waitingTimeLeft > 0) {
            await supabase
              .from('games')
              .update({ countdown_time: waitingTimeLeft })
              .eq('id', activeGame.id)
            
            console.log(`⏳ Game ${activeGame.id} waiting: ${waitingTimeLeft}s`)
          } else {
            clearInterval(waitingInterval)
            activeWaitingPeriods.delete(activeGame.id) // Remove from active waiting periods
          }
        }, 1000)
        
        console.log('✅ Waiting period started successfully')
      } else if (activeGame.players.length >= 2 && activeWaitingPeriods.has(activeGame.id)) {
        console.log(`⚠️ Game ${activeGame.id} already has active waiting period, player ${userId} joined existing process`)
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
        game: finalGameState || activeGame,
        action: 'joined'
      })
    }

    // Player already in game - check if stuck
    console.log(`🔄 Player ${userId} already in game ${activeGame.id}, rejoining`)
    
    // CRITICAL FIX: Check if waiting period or countdown is already active
    // This prevents duplicate timers that cause hallucination
    if (activeGame.players.length >= 2 && activeGame.status === 'waiting') {
      // Check if this game already has an active waiting period
      if (activeWaitingPeriods.has(activeGame.id)) {
        console.log(`⚠️ Game ${activeGame.id} already has active waiting period, skipping duplicate`)
      } else {
        console.log(`⚠️ Game ${activeGame.id} stuck in waiting with ${activeGame.players.length} players, starting waiting period...`)
        
        // Mark as having active waiting period
        activeWaitingPeriods.add(activeGame.id)
        
        await supabase
          .from('games')
          .update({ 
            status: 'waiting_for_players',
            countdown_time: 30,
            waiting_started_at: new Date().toISOString()
          })
          .eq('id', activeGame.id)
        
        // Start waiting period directly for stuck game
        console.log('🔔 Starting waiting period for stuck game')
        
        setTimeout(async () => {
          try {
            // Check if countdown is already active
            if (activeCountdowns.has(activeGame.id)) {
              console.log(`⚠️ Countdown already active for game ${activeGame.id}, skipping`)
              return
            }
            
            // Mark countdown as active
            activeCountdowns.add(activeGame.id)
            
            console.log(`🔥 Starting countdown for stuck game ${activeGame.id}`)
            await supabase
              .from('games')
              .update({ 
                status: 'countdown',
                countdown_time: 10,
                countdown_started_at: new Date().toISOString()
              })
              .eq('id', activeGame.id)

            let timeLeft = 10
            const countdownInterval = setInterval(async () => {
              timeLeft--
              if (timeLeft > 0) {
                await supabase
                  .from('games')
                  .update({ countdown_time: timeLeft })
                  .eq('id', activeGame.id)
                console.log(`⏰ Stuck game ${activeGame.id} countdown: ${timeLeft}s`)
              } else {
                clearInterval(countdownInterval)
                activeCountdowns.delete(activeGame.id)
                
                console.log(`🎮 Starting stuck game ${activeGame.id}`)
                await supabase
                  .from('games')
                  .update({ 
                    status: 'active',
                    countdown_time: 0,
                    started_at: new Date().toISOString()
                  })
                  .eq('id', activeGame.id)
                
                // CRITICAL: Check if number calling already started
                if (gameIntervals.has(activeGame.id)) {
                  console.log(`⚠️ Number calling already active for game ${activeGame.id}, skipping duplicate`)
                } else {
                  console.log(`📢 Starting number calling for stuck game ${activeGame.id}`)
                  startNumberCalling(activeGame.id)
                }
              }
            }, 1000)
          } catch (error) {
            console.error('Error in stuck game countdown:', error)
            activeCountdowns.delete(activeGame.id)
          }
        }, 30000)

        let waitingTimeLeft = 30
        const waitingInterval = setInterval(async () => {
          waitingTimeLeft--
          if (waitingTimeLeft > 0) {
            await supabase
              .from('games')
              .update({ countdown_time: waitingTimeLeft })
              .eq('id', activeGame.id)
            console.log(`⏳ Stuck game ${activeGame.id} waiting: ${waitingTimeLeft}s`)
          } else {
            clearInterval(waitingInterval)
            activeWaitingPeriods.delete(activeGame.id)
          }
        }, 1000)
        
        console.log('✅ Started waiting period for stuck game')
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

// Add API endpoint to manually start number calling for active games
app.post('/api/game/start-calling', async (req, res) => {
  try {
    const { gameId } = req.body

    if (!gameId) {
      return res.status(400).json({ error: 'Missing gameId' })
    }

    const { supabaseAdmin } = await import('../lib/supabase')
    const supabase = supabaseAdmin

    // Check if game exists and is active
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (!game) {
      return res.status(404).json({ error: 'Game not found' })
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: `Game is not active (status: ${game.status})` })
    }

    // Check if number calling is already running
    if (gameIntervals.has(gameId)) {
      return res.json({ 
        success: true, 
        message: 'Number calling already active',
        calledNumbers: game.called_numbers?.length || 0
      })
    }

    // Start number calling
    console.log(`📢 Manually starting number calling for game ${gameId}`)
    startNumberCalling(gameId)

    return res.json({
      success: true,
      message: `Started number calling for game ${gameId}`,
      calledNumbers: game.called_numbers?.length || 0
    })

  } catch (error) {
    console.error('Error starting number calling:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})

// Add cache force sync endpoint for critical operations
app.post('/api/cache/force-sync', async (req, res) => {
  try {
    const { gameId } = req.body

    if (!gameId) {
      return res.status(400).json({ error: 'Missing gameId' })
    }

    console.log(`🔄 Force syncing game ${gameId} to database...`)
    const success = await gameStateCache.forceSyncToDatabase(gameId)

    if (success) {
      return res.json({
        success: true,
        message: `Game ${gameId} synced to database`
      })
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to sync game to database'
      })
    }
  } catch (error) {
    console.error('Error force syncing cache:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Add cache stats endpoint for monitoring
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = gameStateCache.getStats()
    return res.json({
      success: true,
      cache: stats,
      active_games: gameIntervals.size,
      waiting_periods: activeWaitingPeriods.size,
      countdowns: activeCountdowns.size,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Add API endpoint to stop number calling for a game
app.post('/api/game/stop-calling', async (req, res) => {
  try {
    const { gameId } = req.body

    if (!gameId) {
      return res.status(400).json({ error: 'Missing gameId' })
    }

    console.log(`🛑 Stopping number calling for game ${gameId}`)
    stopNumberCalling(gameId)

    return res.json({
      success: true,
      message: `Stopped number calling for game ${gameId}`
    })

  } catch (error) {
    console.error('Error stopping number calling:', error)
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
console.log('   📢 POST /api/game/start-calling')
console.log('   🛑 POST /api/game/stop-calling')
console.log('   🔄 POST /api/cache/force-sync')
console.log('   📊 GET  /api/cache/stats')
console.log('')
console.log('⚡ Performance Features:')
console.log('   🚀 In-memory game state cache enabled')
console.log('   📦 Batch database sync (every 30s)')
console.log('   📡 Instant Socket.IO broadcasting')
console.log('   🧹 Automatic cache cleanup (every 2min)')

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

// Make socket server globally available for number calling
global.io = io

// Track active players per game
const activePlayers = new Map<string, Set<string>>() // gameId -> Set of socketIds

// Add global socket event handlers for game room joining
io.on('connection', (socket) => {
  console.log(`🔌 Global: Client connected ${socket.id}`)
  
  // Handle join-game event (hyphenated format from frontend)
  socket.on('join-game', ({ gameId, userId }: any) => {
    console.log(`👤 Global: User ${userId} joining game room ${gameId}`)
    socket.join(`game-${gameId}`)
    socket.join(gameId) // Join both formats for compatibility
    
    // Track this player as active in the game
    if (!activePlayers.has(gameId)) {
      activePlayers.set(gameId, new Set())
    }
    activePlayers.get(gameId)!.add(socket.id)
    
    console.log(`✅ Global: User ${userId} joined rooms: game-${gameId} and ${gameId}`)
    console.log(`👥 Active players in game ${gameId}: ${activePlayers.get(gameId)?.size || 0}`)
  })
  
  // Handle player disconnect
  socket.on('disconnect', async (reason) => {
    console.log(`🔌 Player disconnected: ${socket.id}, reason: ${reason}`)
    
    // Check all games to see if this player was in any
    activePlayers.forEach(async (players, gameId) => {
      if (players.has(socket.id)) {
        players.delete(socket.id)
        console.log(`👋 Player ${socket.id} left game ${gameId}. Remaining: ${players.size}`)
        
        // If no players left in an active game, stop it
        if (players.size === 0 && gameIntervals.has(gameId)) {
          console.log(`⚠️ All players left game ${gameId}, stopping game...`)
          
          try {
            const { supabaseAdmin } = await import('../lib/supabase')
            
            // Mark game as finished with no winner
            await supabaseAdmin
              .from('games')
              .update({
                status: 'finished',
                ended_at: new Date().toISOString(),
                winner_id: null
              })
              .eq('id', gameId)
            
            // Stop number calling
            stopNumberCalling(gameId)
            
            // Clean up tracking
            activePlayers.delete(gameId)
            
            console.log(`✅ Game ${gameId} stopped due to all players leaving`)
          } catch (error) {
            console.error(`❌ Error stopping abandoned game ${gameId}:`, error)
          }
        }
      }
    })
  })
})

// Initialize socket servers with the shared Socket.IO instance
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
  console.log(`🌐 Health check: https://BingoXbot-production.up.railway.app/health`)
  console.log(`📊 Admin stats: https://BingoXbot-production.up.railway.app/api/admin/stats`)
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
