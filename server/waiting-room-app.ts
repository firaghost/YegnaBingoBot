import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import WaitingRoomSocketServer from './waiting-room-server'
import { waitingRoomManager } from '../lib/waiting-room-manager'

const app = express()
const httpServer = createServer(app)

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}))
app.use(express.json())

// Initialize Socket.IO server
const waitingRoomSocketServer = new WaitingRoomSocketServer(httpServer)

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = waitingRoomSocketServer.getStats()
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stats
  })
})

// Get active rooms endpoint
app.get('/api/rooms/active', async (req, res) => {
  try {
    const activeRooms = Array.from(waitingRoomManager.getActiveRooms().values())
    res.json({
      success: true,
      rooms: activeRooms,
      count: activeRooms.length
    })
  } catch (error) {
    console.error('Error getting active rooms:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get active rooms'
    })
  }
})

// Get room details endpoint
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    const room = await waitingRoomManager.getRoom(roomId)
    res.json({
      success: true,
      room
    })
  } catch (error) {
    console.error('Error getting room:', error)
    res.status(404).json({
      success: false,
      error: 'Room not found'
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
    const { message } = req.body
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      })
    }

    waitingRoomSocketServer.broadcastMessage(message)
    res.json({
      success: true,
      message: 'Message broadcasted'
    })
  } catch (error) {
    console.error('Error broadcasting message:', error)
    res.status(500).json({
      success: false,
      error: 'Broadcast failed'
    })
  }
})

// Admin endpoint to get server stats
app.get('/api/admin/stats', (req, res) => {
  try {
    const stats = waitingRoomSocketServer.getStats()
    const activeRooms = waitingRoomManager.getActiveRooms()
    
    res.json({
      success: true,
      stats: {
        ...stats,
        activeRoomsDetails: Array.from(activeRooms.entries()).map(([roomId, room]) => ({
          roomId,
          gameLevel: room.game_level,
          playerCount: room.active_player_count,
          maxPlayers: room.max_players,
          status: room.status,
          createdAt: room.created_at
        }))
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
    error: 'Endpoint not found'
  })
})

const PORT = process.env.PORT || 3001

// Start server
httpServer.listen(PORT, () => {
  console.log('')
  console.log('🎮 ========================================')
  console.log('🎮 BINGOX WAITING ROOM SERVER STARTED!')
  console.log('🎮 ========================================')
  console.log('')
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Health check: http://localhost:${PORT}/health`)
  console.log(`📊 Admin stats: http://localhost:${PORT}/api/admin/stats`)
  console.log(`🏠 Active rooms: http://localhost:${PORT}/api/rooms/active`)
  console.log('')
  console.log('🔌 Socket.IO Events:')
  console.log('   📥 join_waiting_room - Join a waiting room')
  console.log('   📤 leave_waiting_room - Leave current room')
  console.log('   📊 get_room_status - Get room information')
  console.log('')
  console.log('   📡 room_update - Room state updates')
  console.log('   ⏰ game_starting_in - Countdown updates')
  console.log('   🎮 start_game - Game start notification')
  console.log('   👥 player_joined/left - Player events')
  console.log('')
  console.log('✅ Ready for connections!')
  console.log('')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully')
  httpServer.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully')
  httpServer.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

export { app, httpServer, waitingRoomSocketServer }
