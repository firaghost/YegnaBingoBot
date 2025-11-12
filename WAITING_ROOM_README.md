# 🎮 BingoX Real-Time Waiting Room System

## Overview

A comprehensive real-time waiting room system for BingoX multiplayer Bingo games, built with **Socket.IO**, **Node.js**, and **Supabase**. Players join waiting rooms, get matched with others, and automatically start games when conditions are met.

## 🚀 Features

### ✅ **Core Functionality**
- **Auto Room Creation**: Dynamic room creation based on game level
- **Smart Matchmaking**: Players matched by preferred difficulty level
- **Auto-Start Logic**: Games start when minimum players reached or room is full
- **Countdown System**: 10-second countdown with cancellation support
- **Real-Time Updates**: Live player count and status updates
- **Disconnect Handling**: Graceful handling of player disconnections
- **Room Cleanup**: Automatic cleanup of expired and empty rooms

### 🎯 **Game Levels**
- **Easy**: 10 max players, 2 min players
- **Medium**: 8 max players, 2 min players  
- **Hard**: 6 max players, 2 min players

### 🔄 **Real-Time Events**
- `room_update` - Room state changes
- `game_starting_in` - Countdown updates
- `start_game` - Game launch notification
- `player_joined/left` - Player events
- `waiting_for_more_players` - Waiting state

## 📁 File Structure

```
├── supabase/
│   └── waiting_room_schema.sql      # Database schema
├── lib/
│   └── waiting-room-manager.ts      # Room management logic
├── server/
│   ├── waiting-room-server.ts       # Socket.IO server
│   └── waiting-room-app.ts          # Express app integration
└── test/
    └── waiting-room-test.ts         # Testing utilities
```

## 🗄️ Database Schema

### Tables Created/Extended
- **`rooms`** - Extended with waiting room fields
- **`room_players`** - Player tracking in rooms
- **`game_sessions`** - Game state management

### Key Functions
- `find_available_waiting_room(level)` - Find joinable room
- `get_active_room_players(room_id)` - Get room players
- `cleanup_expired_rooms()` - Remove old rooms
- `update_room_player_count(room_id)` - Sync player counts

## 🚀 Installation & Setup

### 1. Database Setup
```bash
# Run the schema in Supabase SQL Editor
cat supabase/waiting_room_schema.sql
```

### 2. Install Dependencies
```bash
npm install socket.io express cors uuid
npm install -D @types/uuid socket.io-client
```

### 3. Environment Variables
```env
# .env
PORT=3001
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Start the Server
```bash
# Development
npm run dev:waiting-room

# Production
npm run start:waiting-room
```

## 🔧 API Endpoints

### Health & Monitoring
```http
GET /health                    # Server health check
GET /api/admin/stats          # Server statistics
GET /api/rooms/active         # Active rooms list
GET /api/rooms/:roomId        # Room details
```

### Admin Operations
```http
POST /api/admin/cleanup       # Manual room cleanup
POST /api/admin/broadcast     # Broadcast message
```

## 🔌 Socket.IO Events

### Client → Server
```typescript
// Join waiting room
socket.emit('join_waiting_room', {
  username: 'PlayerName',
  level: 'easy' | 'medium' | 'hard',
  telegram_id?: 'optional_id'
})

// Leave room
socket.emit('leave_waiting_room', {
  roomId?: 'optional_room_id'
})

// Get room status
socket.emit('get_room_status', {
  roomId: 'room_id'
})
```

### Server → Client
```typescript
// Room assigned
socket.on('room_assigned', (data) => {
  console.log(`Joined room: ${data.roomId} (${data.gameLevel})`)
})

// Room updates
socket.on('room_update', (data) => {
  console.log(`Players: ${data.currentPlayers}/${data.maxPlayers}`)
})

// Countdown
socket.on('game_starting_in', (data) => {
  console.log(`Game starting in ${data.seconds} seconds`)
})

// Game start
socket.on('start_game', (data) => {
  console.log(`Game started! Level: ${data.gameLevel}`)
})

// Player events
socket.on('player_joined', (data) => {
  console.log(`${data.username} joined (${data.playerCount} total)`)
})

socket.on('player_left', (data) => {
  console.log(`${data.username} left (${data.playerCount} total)`)
})
```

## 🧪 Testing

### Run Test Suite
```bash
# Make sure server is running first
npm run start:waiting-room

# In another terminal
npm run test:waiting-room
```

### Manual Testing with Browser Console
```javascript
// Connect to waiting room
const socket = io('http://localhost:3001')

// Join room
socket.emit('join_waiting_room', {
  username: 'TestPlayer',
  level: 'medium'
})

// Listen for events
socket.on('room_update', console.log)
socket.on('game_starting_in', console.log)
socket.on('start_game', console.log)
```

### Test Scenarios Covered
- ✅ Basic room joining
- ✅ Countdown triggering (2+ players)
- ✅ Room full immediate start
- ✅ Player disconnect during countdown
- ✅ Multiple rooms with different levels
- ✅ Room cleanup and expiry

## 🔄 Game Flow

### 1. **Player Joins**
```
Player connects → Find/Create room → Add to room → Broadcast update
```

### 2. **Waiting State**
```
< Min players → Show "waiting for more players"
```

### 3. **Countdown State**
```
≥ Min players → Start 10s countdown → Broadcast countdown updates
```

### 4. **Game Start**
```
Countdown ends OR Room full → Create game session → Start game
```

### 5. **Cleanup**
```
Game ends OR Players leave → Clean up room → Archive data
```

## 🛠️ Configuration

### Room Settings (per level)
```typescript
const roomConfig = {
  easy: { maxPlayers: 10, minPlayers: 2 },
  medium: { maxPlayers: 8, minPlayers: 2 },
  hard: { maxPlayers: 6, minPlayers: 2 }
}
```

### Timing Settings
```typescript
const timing = {
  countdownDuration: 10,        // seconds
  roomExpiry: 10,              // minutes
  gameTimeout: 5,              // minutes
  cleanupInterval: 2           // minutes
}
```

## 📊 Monitoring & Analytics

### Server Stats Available
- Connected sockets count
- Active rooms count
- Player-room mappings
- Cached rooms count
- Room details (players, levels, status)

### Logging Events
- Player joins/leaves
- Room creation/cleanup
- Countdown start/cancel
- Game starts
- Error conditions

## 🚨 Error Handling

### Common Error Scenarios
- **Room Not Found**: Player tries to join non-existent room
- **Database Connection**: Supabase connection issues
- **Socket Disconnect**: Unexpected player disconnection
- **Countdown Conflicts**: Multiple countdown attempts

### Error Recovery
- Automatic retry for database operations
- Graceful degradation for missing data
- Socket reconnection handling
- Memory cleanup on errors

## 🔒 Security Considerations

### Input Validation
- Username sanitization
- Room ID validation
- Level parameter checking
- Rate limiting on joins

### Database Security
- Row Level Security (RLS) enabled
- Service role key protection
- SQL injection prevention
- Audit logging

## 🚀 Deployment

### Railway Deployment
```bash
# Build the project
npm run build

# Set environment variables in Railway
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
PORT=3001

# Deploy
railway up
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:waiting-room"]
```

## 🔧 Troubleshooting

### Common Issues

#### "Room not found" errors
- Check database connection
- Verify room cleanup isn't too aggressive
- Check room ID format

#### Countdown not starting
- Verify minimum player count
- Check if countdown already active
- Ensure database updates are working

#### Players not seeing updates
- Check Socket.IO connection
- Verify room joining process
- Check event emission

### Debug Commands
```bash
# Check server health
curl http://localhost:3001/health

# Get active rooms
curl http://localhost:3001/api/rooms/active

# Get server stats
curl http://localhost:3001/api/admin/stats
```

## 📈 Performance Optimization

### Caching Strategy
- In-memory room cache for quick access
- Player-room mapping cache
- Periodic cache cleanup

### Database Optimization
- Indexed queries for room lookup
- Batch operations for player updates
- Connection pooling

### Socket.IO Optimization
- Room-based event broadcasting
- Efficient event handling
- Connection cleanup

## 🔮 Future Enhancements

### Potential Features
- **Spectator Mode**: Watch ongoing games
- **Private Rooms**: Invite-only rooms
- **Tournament Mode**: Bracket-style competitions
- **Room Preferences**: Custom room settings
- **Chat System**: In-room messaging
- **Reconnection**: Rejoin after disconnect

### Scaling Considerations
- **Redis Adapter**: Multi-server Socket.IO
- **Load Balancing**: Distribute connections
- **Database Sharding**: Handle more concurrent games
- **CDN Integration**: Global latency reduction

## 📞 Support

### Getting Help
1. Check the troubleshooting section
2. Review server logs for errors
3. Test with the provided test suite
4. Check database connectivity

### Contributing
1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Ensure backward compatibility

---

## ✅ **System Ready!**

Your BingoX waiting room system is now complete with:
- 🎯 **Smart matchmaking** by game level
- ⏰ **Automatic countdown** and game start
- 🔄 **Real-time updates** for all players
- 🧹 **Automatic cleanup** of expired rooms
- 🧪 **Comprehensive testing** utilities
- 📊 **Monitoring** and admin tools

**Start the server and begin testing with multiple clients!** 🎮
