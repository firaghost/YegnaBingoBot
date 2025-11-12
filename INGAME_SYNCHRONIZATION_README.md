# 🎮 BingoX In-Game Synchronization System (Phase 2)

## Overview

A comprehensive real-time in-game synchronization system for BingoX multiplayer Bingo games. This extends the waiting room system with full game state management, spectator mode, reconnect handling, and bingo claim validation.

## 🚀 Features

### ✅ **Core In-Game Features**
- **Real-Time Number Calling**: Automatic number calling based on difficulty level
- **Game State Synchronization**: Live game state across all connected players
- **Bingo Claim Validation**: Server-side validation of bingo claims
- **Winner Detection**: Automatic game ending and winner announcement
- **Game Persistence**: Full game state saved to database

### 🔄 **Reconnect System**
- **30-Second Grace Period**: Players can reconnect within 30 seconds
- **State Recovery**: Full game state restored on reconnect
- **Automatic Timeout**: Players removed after grace period expires
- **Spectator Fallback**: Failed reconnects can join as spectators

### 👁️ **Spectator Mode**
- **Live Game Viewing**: Watch ongoing games without participating
- **Real-Time Updates**: See all number calls and game events
- **No Interaction**: Cannot claim bingo or affect game state
- **Dynamic Join/Leave**: Join/leave spectator mode anytime

### ⚡ **Performance Features**
- **In-Memory State**: Fast game state management
- **Database Persistence**: Key events saved to Supabase
- **Automatic Cleanup**: Games cleaned up after completion
- **Concurrent Games**: Multiple games running simultaneously

## 📁 File Structure

```
├── supabase/
│   ├── ingame_synchronization_schema.sql    # Database schema
│   └── fix_foreign_key_constraints.sql      # Foreign key fixes
├── lib/
│   ├── game-state-manager.ts               # Game state management
│   └── waiting-room-manager.ts             # Waiting room (Phase 1)
├── server/
│   ├── integrated-game-server.ts           # Complete game server
│   ├── ingame-socket-server.ts             # In-game Socket.IO
│   └── waiting-room-server.ts              # Waiting room Socket.IO
└── test/
    ├── ingame-test-suite.ts                # In-game testing
    └── waiting-room-test.ts                # Waiting room testing
```

## 🗄️ Database Schema

### New Tables
- **`game_players`** - Player state in active games
- **`game_numbers`** - Number call history
- **`bingo_claims`** - Bingo claim validation records

### Extended Tables
- **`game_sessions`** - Enhanced with sync fields
- **`rooms`** - Added level support

### Key Functions
- `get_active_game_session(room_id)` - Get active game
- `add_called_number(session_id, number)` - Record number call
- `validate_bingo_claim(...)` - Validate bingo claims
- `reconnect_player(...)` - Handle player reconnection

## 🚀 Installation & Setup

### 1. Database Setup
```bash
# Run these SQL scripts in Supabase SQL Editor:
# 1. supabase/levels_system_simple.sql (if not done)
# 2. supabase/waiting_room_schema.sql (if not done)
# 3. supabase/ingame_synchronization_schema.sql (new)
# 4. supabase/fix_foreign_key_constraints.sql (optional)
```

### 2. Install Dependencies
```bash
# Already installed from Phase 1
npm install
```

### 3. Environment Variables
```env
# .env (same as Phase 1)
PORT=3001
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Start the Complete Game Server
```bash
# Development (includes waiting room + in-game)
npm run dev:game-server

# Or run complete stack
npm run dev:complete  # Next.js + Game Server + Bot

# Production
npm run start:game-server
```

## 🔌 Socket.IO Events

### Waiting Room → In-Game Transition
```typescript
// Server emits when game starts
socket.on('transition_to_game', (data) => {
  // { roomId, gameLevel, message }
  // Client should join the actual game
})
```

### In-Game Events

#### Client → Server
```typescript
// Join active game
socket.emit('join_game', {
  username: 'PlayerName',
  roomId: 'room_id'
})

// Join as spectator
socket.emit('join_spectator', {
  username: 'SpectatorName',
  roomId: 'room_id'
})

// Reconnect request
socket.emit('reconnect_request', {
  username: 'PlayerName',
  roomId: 'room_id'
})

// Claim bingo
socket.emit('bingo_claim', {
  username: 'PlayerName',
  claimedCells: [1, 2, 3, 4, 5],
  bingoPattern: 'row',
  board: [[1,2,3,4,5], ...]
})

// Get game state
socket.emit('get_game_state', {
  roomId: 'room_id'
})
```

#### Server → Client
```typescript
// Game started
socket.on('game_started', (data) => {
  // { roomId, gameLevel, players, callInterval }
})

// Number called
socket.on('number_called', (data) => {
  // { number: 42, remaining: 33, letter: 'G' }
})

// Game snapshot (for reconnects/spectators)
socket.on('game_snapshot', (data) => {
  // { roomId, status, numbersCalled, players, spectators, playerBoard }
})

// Bingo winner
socket.on('bingo_winner', (data) => {
  // { username, pattern, winningCells }
})

// Game over
socket.on('game_over', (data) => {
  // { winner, reason, finalNumbers, duration }
})

// Player events
socket.on('player_reconnected', (data) => {
  // { username }
})

socket.on('spectator_joined', (data) => {
  // { username, spectatorCount }
})

// Validation
socket.on('invalid_claim', (data) => {
  // { reason, details }
})
```

## 🎯 Game Flow

### 1. **Waiting Room Phase**
```
Players join → Room fills → Countdown → Game starts
```

### 2. **Game Initialization**
```
Create game session → Generate boards → Start number calling
```

### 3. **Active Game Phase**
```
Call numbers → Players mark boards → Validate claims → Declare winner
```

### 4. **Game End & Cleanup**
```
Winner announced → Results shown → Clean up after 2 minutes
```

## 🔧 API Endpoints

### Game Management
```http
GET /api/games/active          # List active games
GET /api/games/:roomId         # Get specific game details
POST /api/admin/games/:roomId/end  # Force end game (admin)
```

### Monitoring
```http
GET /health                    # Server health + stats
GET /api/admin/stats          # Comprehensive statistics
```

### Example Response
```json
{
  "success": true,
  "games": [
    {
      "roomId": "room_123",
      "status": "in_progress",
      "gameLevel": "medium",
      "playerCount": 4,
      "spectatorCount": 2,
      "numbersCalled": 15,
      "startedAt": "2024-01-01T10:00:00Z",
      "lastActivity": "2024-01-01T10:05:00Z"
    }
  ]
}
```

## 🧪 Testing

### Run Test Suites
```bash
# Test waiting room functionality
npm run test:waiting-room-simple

# Test complete in-game functionality
npm run test:ingame

# Make sure game server is running first:
npm run dev:game-server
```

### Test Scenarios Covered
- ✅ **Complete Game Flow** (waiting → game → bingo)
- ✅ **Spectator Mode** (join ongoing games)
- ✅ **Reconnect Functionality** (30s grace period)
- ✅ **Reconnect Timeout** (grace period expiry)
- ✅ **Multiple Concurrent Games** (different levels)

### Manual Testing
```javascript
// Connect to game server
const socket = io('http://localhost:3001')

// Join waiting room first
socket.emit('join_waiting_room', {
  username: 'TestPlayer',
  level: 'medium'
})

// Listen for game transition
socket.on('transition_to_game', (data) => {
  // Join the actual game
  socket.emit('join_game', {
    username: 'TestPlayer',
    roomId: data.roomId
  })
})

// Listen for game events
socket.on('number_called', (data) => {
  console.log(`Called: ${data.letter}${data.number}`)
})

socket.on('game_snapshot', (data) => {
  console.log('Game state:', data)
})
```

## ⚙️ Configuration

### Game Level Settings
```typescript
const levelSettings = {
  easy: {
    callInterval: 3000,    // 3 seconds between numbers
    maxPlayers: 10,
    xpReward: 10
  },
  medium: {
    callInterval: 2000,    // 2 seconds between numbers
    maxPlayers: 8,
    xpReward: 25
  },
  hard: {
    callInterval: 1000,    // 1 second between numbers
    maxPlayers: 6,
    xpReward: 50
  }
}
```

### Timing Configuration
```typescript
const timing = {
  reconnectGracePeriod: 30,    // seconds
  gameCleanupDelay: 120,       // seconds (2 minutes)
  numberCallDelay: 1000,       // ms before first number
  resultDisplayTime: 30        // seconds to show results
}
```

## 🔄 Game State Management

### In-Memory State
```typescript
interface GameState {
  id: string
  room_id: string
  status: 'waiting' | 'in_progress' | 'finished'
  game_level: 'easy' | 'medium' | 'hard'
  numbers_called: number[]
  current_number?: number
  players: Map<string, GamePlayer>
  spectators: Map<string, GamePlayer>
  reconnect_timers: Map<string, NodeJS.Timeout>
  // ... more fields
}
```

### Database Persistence
- **Game sessions** saved on start/end
- **Number calls** recorded for recovery
- **Bingo claims** validated and logged
- **Player states** tracked for reconnection

## 🛡️ Security & Validation

### Bingo Claim Validation
- **Server-side validation** of all claims
- **Board state verification** against called numbers
- **Pattern validation** (row, column, diagonal, full house)
- **Duplicate claim prevention**
- **Audit trail** of all claims

### Anti-Cheat Measures
- **Server authoritative** game state
- **Validated number calling** sequence
- **Immutable game boards** after generation
- **Timestamped events** for audit

## 📊 Monitoring & Analytics

### Real-Time Metrics
- **Active games count**
- **Connected players/spectators**
- **Average game duration**
- **Bingo claim success rate**
- **Reconnection statistics**

### Performance Monitoring
- **Memory usage** of active games
- **Database query performance**
- **Socket.IO connection health**
- **Number calling accuracy**

## 🚨 Error Handling

### Common Scenarios
- **Player disconnection** during game
- **Invalid bingo claims**
- **Database connection issues**
- **Memory cleanup failures**
- **Concurrent access conflicts**

### Recovery Mechanisms
- **Automatic reconnection** within grace period
- **Spectator mode fallback** for failed reconnects
- **Game state recovery** from database
- **Graceful degradation** on errors

## 🔮 Advanced Features

### Potential Enhancements
- **Tournament Mode**: Multi-round competitions
- **Private Games**: Invite-only rooms
- **Custom Patterns**: Beyond standard bingo patterns
- **Power-ups**: Special game mechanics
- **Replay System**: Game recording and playback
- **Statistics Dashboard**: Detailed player analytics

### Scaling Considerations
- **Redis Clustering**: Multi-server state sharing
- **Database Sharding**: Handle more concurrent games
- **CDN Integration**: Global latency reduction
- **Load Balancing**: Distribute game servers

## 🔧 Troubleshooting

### Common Issues

#### "Game not found" errors
- Check if game server is running
- Verify room ID is correct
- Ensure game hasn't expired

#### Players can't reconnect
- Check grace period hasn't expired
- Verify username matches exactly
- Ensure game is still in progress

#### Numbers not being called
- Check if there are active players
- Verify game status is 'in_progress'
- Look for timer conflicts

### Debug Commands
```bash
# Check server health
curl http://localhost:3001/health

# Get active games
curl http://localhost:3001/api/games/active

# Get specific game
curl http://localhost:3001/api/games/room_123

# Force end game (admin)
curl -X POST http://localhost:3001/api/admin/games/room_123/end \
  -H "Content-Type: application/json" \
  -d '{"reason": "debug_test"}'
```

## 📈 Performance Optimization

### Memory Management
- **Automatic cleanup** of finished games
- **Efficient data structures** for game state
- **Garbage collection** of disconnected players
- **Resource monitoring** and alerts

### Database Optimization
- **Indexed queries** for fast lookups
- **Batch operations** for number calls
- **Connection pooling** for high concurrency
- **Query optimization** for real-time updates

### Network Optimization
- **Event batching** for reduced traffic
- **Compression** for large payloads
- **Efficient serialization** of game state
- **Connection management** for reliability

---

## ✅ **System Complete!**

Your BingoX in-game synchronization system is now fully implemented with:

- 🎯 **Real-time game synchronization** with number calling
- 🔄 **30-second reconnect grace period** with state recovery
- 👁️ **Spectator mode** for watching ongoing games
- 🏆 **Bingo claim validation** and winner detection
- 🗄️ **Complete database persistence** and state management
- 🧪 **Comprehensive testing suite** for all features
- 📊 **Monitoring and admin tools** for game management

**The system seamlessly transitions from waiting rooms to active games and handles all edge cases!** 🎮🚀

### Quick Start Commands
```bash
# 1. Setup database (run SQL scripts in Supabase)
# 2. Start complete system
npm run dev:complete

# 3. Test the system
npm run test:ingame
```

**Your multiplayer BingoX game is now production-ready with full real-time synchronization!** 🎉
