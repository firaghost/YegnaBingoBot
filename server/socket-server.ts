import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { supabase } from '../lib/supabase.js'

const SOCKET_PORT = parseInt(process.env.PORT || process.env.SOCKET_PORT || '3001', 10)

// Track active game loops to prevent duplicates
const activeGameLoops = new Map<string, NodeJS.Timeout>()

// Create HTTP server for Socket.IO only
const httpServer = createServer()

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'https://yegnagame.vercel.app',
      'http://localhost:3000',
      /\.vercel\.app$/  // Allow all Vercel preview deployments
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
})

console.log('🚀 Socket.IO Server Starting...')

// ============================================
// SERVER-SIDE GAME LOOP
// ============================================

// Get bingo letter for number
function getBingoLetter(number: number): string {
  if (number <= 15) return 'B'
  if (number <= 30) return 'I'
  if (number <= 45) return 'N'
  if (number <= 60) return 'G'
  return 'O'
}

// Generate shuffled number sequence
function generateNumberSequence(): number[] {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1)
  // Fisher-Yates shuffle
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]]
  }
  return numbers
}

// Start game loop for a specific game
async function startGameLoop(gameId: string) {
  // Prevent duplicate loops
  if (activeGameLoops.has(gameId)) {
    console.log(`⚠️ Game loop already running for ${gameId}`)
    return
  }

  console.log(`🎮 Starting server-side game loop for ${gameId}`)

  // Fetch game data
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (!game) {
    console.error(`❌ Game ${gameId} not found`)
    return
  }

  // Countdown phase
  if (game.status === 'countdown') {
    let countdown = game.countdown_time || 10

    const countdownInterval = setInterval(async () => {
      countdown--

      if (countdown <= 0) {
        clearInterval(countdownInterval)
        activeGameLoops.delete(gameId)

        // Start active game phase
        const numberSequence = generateNumberSequence()
        await supabase
          .from('games')
          .update({
            status: 'active',
            countdown_time: 0,
            started_at: new Date().toISOString(),
            number_sequence: numberSequence
          })
          .eq('id', gameId)

        console.log(`🎬 Game ${gameId} started - beginning number calls`)
        
        // Broadcast game start
        io.to(`game-${gameId}`).emit('game-state', {
          ...game,
          status: 'active',
          countdown_time: 0
        })

        // Start active game loop
        startActiveGameLoop(gameId, numberSequence)
      } else {
        // Update countdown in database
        await supabase
          .from('games')
          .update({ countdown_time: countdown })
          .eq('id', gameId)

        console.log(`⏰ Game ${gameId} countdown: ${countdown}s`)

        // Broadcast countdown update
        io.to(`game-${gameId}`).emit('game-state', {
          ...game,
          countdown_time: countdown
        })
      }
    }, 1000)

    activeGameLoops.set(gameId, countdownInterval)
  } else if (game.status === 'active') {
    // Game already active, start number calling
    const numberSequence = game.number_sequence || generateNumberSequence()
    startActiveGameLoop(gameId, numberSequence)
  }
}

// Active game loop - call numbers
async function startActiveGameLoop(gameId: string, numberSequence: number[]) {
  if (activeGameLoops.has(gameId)) {
    console.log(`⚠️ Active game loop already running for ${gameId}`)
    return
  }

  console.log(`📢 Starting number calls for game ${gameId}`)

  const numberInterval = setInterval(async () => {
    // Fetch current game state
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (!game || game.status !== 'active' || game.winner_id) {
      // Game ended, stop loop
      clearInterval(numberInterval)
      activeGameLoops.delete(gameId)
      console.log(`🛑 Game ${gameId} ended, stopping number calls`)
      return
    }

    const calledNumbers = game.called_numbers || []
    
    // Find next uncalled number
    let nextNumber: number | null = null
    for (const num of numberSequence) {
      if (!calledNumbers.includes(num)) {
        nextNumber = num
        break
      }
    }

    if (!nextNumber) {
      // All numbers called - wait 10 seconds for bingo claims, then finish with no winner
      clearInterval(numberInterval)
      activeGameLoops.delete(gameId)
      
      console.log(`⏰ Game ${gameId} - all numbers called, waiting 10s for bingo claims...`)
      
      // Wait 10 seconds for players to claim
      setTimeout(async () => {
        // Check if someone claimed in the meantime
        const { data: finalGame } = await supabase
          .from('games')
          .select('winner_id, status')
          .eq('id', gameId)
          .single()
        
        if (finalGame?.winner_id || finalGame?.status === 'finished') {
          console.log(`✅ Game ${gameId} already finished with winner`)
          return
        }
        
        // No winner claimed - finish game
        await supabase
          .from('games')
          .update({ 
            status: 'finished', 
            ended_at: new Date().toISOString(),
            winner_id: null  // No winner
          })
          .eq('id', gameId)
          .is('winner_id', null)  // Only if no winner yet
        
        console.log(`🏁 Game ${gameId} finished - no winner claimed`)
        io.to(`game-${gameId}`).emit('game-state', { ...game, status: 'finished', winner_id: null })
      }, 10000)  // 10 second grace period
      
      return
    }

    // Call the number
    const updatedNumbers = [...calledNumbers, nextNumber]
    const latestNumber = {
      letter: getBingoLetter(nextNumber),
      number: nextNumber
    }

    await supabase
      .from('games')
      .update({
        called_numbers: updatedNumbers,
        latest_number: latestNumber
      })
      .eq('id', gameId)

    console.log(`📢 Game ${gameId}: Called ${latestNumber.letter}${latestNumber.number} [${updatedNumbers.length}/75]`)

    // Broadcast number call
    io.to(`game-${gameId}`).emit('game-state', {
      ...game,
      called_numbers: updatedNumbers,
      latest_number: latestNumber
    })
  }, 3000) // Call number every 3 seconds

  activeGameLoops.set(gameId, numberInterval)
}

// Stop game loop
function stopGameLoop(gameId: string) {
  const interval = activeGameLoops.get(gameId)
  if (interval) {
    clearInterval(interval)
    activeGameLoops.delete(gameId)
    console.log(`🛑 Stopped game loop for ${gameId}`)
  }
}

// ============================================
// SOCKET.IO CONNECTION HANDLER
// ============================================

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id)

  // Join game room
  socket.on('join-game', async ({ gameId, userId }: { gameId: string; userId: string }) => {
    socket.join(`game-${gameId}`)
    console.log(`👤 User ${userId} (${socket.id}) joined game ${gameId}`)
    
    // Fetch game data
    const { data: game } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single()

    if (game) {
      // Send game state to the joining player
      socket.emit('game-state', {
        id: game.id,
        room_id: game.room_id,
        status: game.status,
        countdown_time: game.countdown_time || 10,
        players: game.players || [],
        bots: game.bots || [],
        called_numbers: game.called_numbers || [],
        latest_number: game.latest_number || null,
        stake: game.stake,
        prize_pool: game.prize_pool,
        winner_id: game.winner_id
      })

      // Notify other players
      socket.to(`game-${gameId}`).emit('player-joined', { userId })

      // Start game loop if game is in countdown or active status
      if ((game.status === 'countdown' || game.status === 'active') && !activeGameLoops.has(gameId)) {
        console.log(`🚀 Triggering game loop for ${gameId} (status: ${game.status})`)
        startGameLoop(gameId)
      }
    }
  })

  // Leave game room
  socket.on('leave-game', ({ gameId, userId }: { gameId: string; userId: string }) => {
    socket.leave(`game-${gameId}`)
    console.log(`👋 User ${userId} (${socket.id}) left game ${gameId}`)
    socket.to(`game-${gameId}`).emit('player-left', { userId })
  })

  // Mark number on card
  socket.on('mark-number', async ({ gameId, userId, number }) => {
    console.log(`🎯 User ${userId} marked number ${number} in game ${gameId}`)
    
    // Broadcast to all players in the game
    io.to(`game-${gameId}`).emit('number-marked', {
      userId,
      number,
      timestamp: Date.now()
    })
  })

  // Check for bingo
  socket.on('check-bingo', async ({ gameId, userId, card }) => {
    console.log(`🎰 Checking bingo for user ${userId} in game ${gameId}`)
    
    // Verify bingo
    const isValid = verifyBingo(card)
    
    if (isValid) {
      // Update game status
      await supabase
        .from('games')
        .update({ 
          status: 'completed',
          winner_id: userId,
          completed_at: new Date().toISOString()
        })
        .eq('id', gameId)

      // Get game data for prize calculation
      const { data: game } = await supabase
        .from('games')
        .select('prize_pool')
        .eq('id', gameId)
        .single()

      // Update winner's balance
      if (game) {
        await supabase.rpc('add_balance', {
          user_id: userId,
          amount: game.prize_pool
        })

        // Create transaction
        await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            type: 'win',
            amount: game.prize_pool,
            status: 'completed',
            description: `Won game ${gameId}`
          })
      }

      // Broadcast winner to all players
      io.to(`game-${gameId}`).emit('game-won', {
        winnerId: userId,
        prize: game?.prize_pool || 0,
        timestamp: Date.now()
      })
    } else {
      socket.emit('invalid-bingo', { message: 'Invalid bingo claim' })
    }
  })

  // Call number (for game master/system)
  socket.on('call-number', async ({ gameId, number }) => {
    console.log(`📢 Number ${number} called in game ${gameId}`)
    
    // Broadcast to all players
    io.to(`game-${gameId}`).emit('number-called', {
      number,
      timestamp: Date.now()
    })
  })

  // Player ready
  socket.on('player-ready', async ({ gameId, userId }) => {
    console.log(`✅ Player ${userId} ready in game ${gameId}`)
    
    // Broadcast to room
    io.to(`game-${gameId}`).emit('player-ready', { userId })
  })

  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id)
  })
})

// Helper function to verify bingo
function verifyBingo(card: number[][]): boolean {
  // Check rows
  for (let row of card) {
    if (row.every(num => num === -1)) return true
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (card.every(row => row[col] === -1)) return true
  }

  // Check diagonals
  if (card.every((row, i) => row[i] === -1)) return true
  if (card.every((row, i) => row[4 - i] === -1)) return true

  return false
}

// Start server
httpServer.listen(SOCKET_PORT, () => {
  console.log(`✅ Socket.IO server running on port ${SOCKET_PORT}`)
  console.log(`🔗 Accepting connections from: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM signal received: closing Socket.IO server')
  httpServer.close(() => {
    console.log('✅ Socket.IO server closed')
  })
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT signal received: closing Socket.IO server')
  httpServer.close(() => {
    console.log('✅ Socket.IO server closed')
  })
})
