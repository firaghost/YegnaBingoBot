# Server-Side Game Loop Implementation

## Overview
Moved game progression from **client-side ticker** to **server-side Socket.IO loop** for reliability and simplicity.

## Why This is Better

### Old Architecture (Client-Side Ticker) ❌
```
Client 1 (Game Master) → Calls /api/game/tick every 1s → Updates DB → Socket broadcasts
   ↓ Problem: If Client 1 disconnects, game stops!
   ↓ Problem: Race conditions with multiple clients
   ↓ Problem: Complex fallback logic needed
```

### New Architecture (Server-Side Loop) ✅
```
Socket.IO Server → Runs game loop → Updates DB → Broadcasts to all clients
   ✓ Always reliable - server never "disconnects"
   ✓ No race conditions - single source of truth
   ✓ Simple - clients just listen and update UI
```

## Implementation

### Server-Side (`server/socket-server.ts`)

#### Added Game Loop Functions:
1. **`startGameLoop(gameId)`** - Main entry point
   - Starts countdown phase (1s intervals)
   - Transitions to active phase when countdown reaches 0
   - Starts number calling phase

2. **`startActiveGameLoop(gameId, numberSequence)`** - Number calling
   - Calls numbers every 3 seconds
   - Updates database
   - Broadcasts to all clients
   - Stops when game ends

3. **`stopGameLoop(gameId)`** - Cleanup
   - Stops intervals
   - Removes from active loops map

#### Automatic Triggering:
- Game loop starts automatically when a player joins a game in 'countdown' or 'active' status
- Prevents duplicate loops with `activeGameLoops` Map

### Client-Side Changes Needed

#### 1. Remove `useGameTicker` Hook
The hook is no longer needed. Clients will just listen to Socket.IO events.

**File to modify:** `app/game/[roomId]/page.tsx`

**Remove:**
```typescript
useGameTicker(
  gameId, 
  gameState?.status || null,
  user?.id || null,
  gameState?.players || [],
  gameState?.countdown_time
)
```

#### 2. Update Socket Hook
The `useSocket` hook already listens to `game-state` events, so it should work automatically!

**Verify in:** `lib/hooks/useSocket.ts`
- Should have listener for 'game-state' event
- Should update local state when receiving updates

#### 3. Remove Tick API (Optional)
Since we're not using client-side ticking anymore:

**Files to remove/deprecate:**
- `app/api/game/tick/route.ts` (can keep for backward compatibility)
- `app/api/game/start/route.ts` (can keep for backward compatibility)

## How It Works

### Game Flow

#### 1. Game Creation
```
Player 1 joins → Game created (status: 'waiting')
Player 2 joins → Game updated (status: 'countdown')
                 ↓
Socket.IO server detects countdown status
                 ↓
Server starts game loop automatically
```

#### 2. Countdown Phase (10 seconds)
```
Server: countdown = 10
Every 1 second:
  - Decrement countdown
  - Update database
  - Broadcast to all clients: { countdown_time: 9 }
  - Clients update UI

When countdown reaches 0:
  - Generate number sequence
  - Update status to 'active'
  - Start number calling phase
```

#### 3. Active Phase (Number Calling)
```
Every 3 seconds:
  - Get next number from sequence
  - Update database with called number
  - Broadcast to all clients: { latest_number: {letter: 'B', number: 5} }
  - Clients auto-mark numbers on cards

When winner claims bingo:
  - Server verifies win
  - Updates winner_id
  - Game loop detects winner and stops
```

## Benefits

### For Users
- ✅ **More Reliable**: Game never stops due to client disconnection
- ✅ **Faster**: No API roundtrips for each tick
- ✅ **Smoother**: Consistent timing from server

### For Developers
- ✅ **Simpler Code**: No complex fallback logic
- ✅ **Easier Debugging**: All game logic in one place (server)
- ✅ **Better Performance**: Less database queries
- ✅ **No Race Conditions**: Single source of truth

## Deployment Steps

### 1. Deploy Socket.IO Server
```bash
# Make sure Socket.IO server is running
cd server
npm install
npm run dev  # or npm start for production
```

### 2. Update Client Code
Remove `useGameTicker` calls from game pages.

### 3. Test
1. Join a game with 2 players
2. Watch server logs - should see:
   ```
   🎮 Starting server-side game loop for [gameId]
   ⏰ Game [gameId] countdown: 9s
   ⏰ Game [gameId] countdown: 8s
   ...
   🎬 Game [gameId] started - beginning number calls
   📢 Game [gameId]: Called B5 [1/75]
   📢 Game [gameId]: Called I23 [2/75]
   ```
3. Verify clients receive updates and UI updates automatically

## Server Logs to Monitor

### Successful Game Flow:
```
👤 User [userId] joined game [gameId]
🚀 Triggering game loop for [gameId] (status: countdown)
🎮 Starting server-side game loop for [gameId]
⏰ Game [gameId] countdown: 10s
⏰ Game [gameId] countdown: 9s
...
⏰ Game [gameId] countdown: 1s
🎬 Game [gameId] started - beginning number calls
📢 Starting number calls for game [gameId]
📢 Game [gameId]: Called B5 [1/75]
📢 Game [gameId]: Called I23 [2/75]
...
🛑 Game [gameId] ended, stopping number calls
```

### Error Scenarios:
```
⚠️ Game loop already running for [gameId]  ← Duplicate prevention working
❌ Game [gameId] not found  ← Game doesn't exist
```

## Troubleshooting

### Game not starting?
1. Check if Socket.IO server is running
2. Check server logs for errors
3. Verify game status is 'countdown' in database

### Numbers not being called?
1. Check if game status is 'active'
2. Check if number_sequence exists in database
3. Check server logs for errors

### Countdown not updating?
1. Check if clients are connected to Socket.IO
2. Check browser console for 'game-state' events
3. Verify Socket.IO CORS settings

## Future Enhancements

- [ ] Add Redis for distributed game loops (multiple server instances)
- [ ] Add game loop recovery on server restart
- [ ] Add metrics/monitoring for game loops
- [ ] Add admin API to manually control game loops

## Migration from Client-Side Ticker

### Step 1: Deploy Server Changes
Deploy the updated `socket-server.ts` with game loop functions.

### Step 2: Keep Both Systems Running (Transition Period)
- Server-side loop will take over for new games
- Old games with client-side ticker will continue working
- Monitor for any issues

### Step 3: Remove Client-Side Ticker
After confirming server-side loop works:
- Remove `useGameTicker` hook usage
- Remove tick API routes (optional)
- Clean up documentation

### Step 4: Celebrate! 🎉
You now have a reliable, server-side game loop!
