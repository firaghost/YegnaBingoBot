import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { supabase } from '../lib/supabase.js'

const SOCKET_PORT = parseInt(process.env.SOCKET_PORT || '3001', 10)

// Create HTTP server for Socket.IO only
const httpServer = createServer()

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
})

console.log('🚀 Socket.IO Server Starting...')

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id)

  // Join game room
  socket.on('join-game', async (gameId: string) => {
    socket.join(`game-${gameId}`)
    console.log(`👤 User ${socket.id} joined game ${gameId}`)
    
    // Fetch game data
    const { data: game } = await supabase
      .from('games')
      .select('*, rooms(*)')
      .eq('id', gameId)
      .single()

    if (game) {
      socket.emit('game-data', game)
    }
  })

  // Leave game room
  socket.on('leave-game', (gameId: string) => {
    socket.leave(`game-${gameId}`)
    console.log(`👋 User ${socket.id} left game ${gameId}`)
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
