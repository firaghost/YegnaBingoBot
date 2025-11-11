# Countdown Stuck Issue - Debug Guide

## Problem
Game countdown gets stuck and doesn't progress, even though:
- User is the game master
- Ticker is starting
- Game transitions to countdown status

## Symptoms from Logs
```
✅ Initial game state loaded: waiting
👑 Game master - starting ticker
💰 Stake deducted: 5
👑 Game master - starting ticker (appears multiple times!)
⚠️ Countdown appears stuck, attempting to restart game loop...
```

## Root Causes Identified

### 1. Multiple Ticker Instances
**Problem:** The ticker is starting multiple times (`👑 Game master - starting ticker` appears 3 times)
**Cause:** useEffect re-running due to dependency changes
**Fix:** Removed `isFallbackMaster` from dependency array and added better duplicate prevention

### 2. Missing Tick Logs
**Problem:** No logs showing actual tick API calls (`🔄 Ticking game...`)
**Cause:** Ticker might not be calling the API, or calls are failing silently
**Fix:** Added comprehensive logging to track every tick attempt and result

### 3. Game Status Transition
**Problem:** Game might be stuck in "waiting" status
**Cause:** Second player might not be joining properly, or status update isn't broadcasting
**Solution:** Need to verify game status transitions properly

## Debugging Steps

### Step 1: Check Console Logs
Look for these specific messages in order:

1. **Game Initialization:**
   ```
   🎮 Initializing game for room: [roomId]
   ✅ Join result: {game: {...}, action: 'joined'}
   ```

2. **Socket Connection:**
   ```
   🔌 About to join socket game: [gameId]
   🔌 Socket join completed
   ✅ Subscribed to game updates
   ```

3. **Ticker Start:**
   ```
   👑 Game master - starting ticker for game: [gameId]
   ```
   **Should appear ONLY ONCE!**

4. **Tick Attempts:**
   ```
   🔄 Ticking game [gameId] (status: countdown)...
   ✅ Tick result: {action: 'countdown', countdown_time: 9}
   ```
   **Should appear every 1 second**

### Step 2: Check Game Status
In browser console, run:
```javascript
// Check current game state
console.log('Game Status:', gameState?.status)
console.log('Countdown Time:', gameState?.countdown_time)
console.log('Players:', gameState?.players)
```

### Step 3: Check Network Tab
1. Open DevTools → Network tab
2. Filter for "tick"
3. Watch for POST requests to `/api/game/tick`
4. Check if requests are:
   - Being sent (should be every 1 second)
   - Returning 200 OK
   - Returning valid JSON response

### Step 4: Check Database
Run this query in Supabase SQL Editor:
```sql
SELECT id, status, countdown_time, players, created_at
FROM games
WHERE status IN ('waiting', 'countdown')
ORDER BY created_at DESC
LIMIT 5;
```

## Expected Flow

### Normal Game Start
```
1. Player 1 joins → Game created (status: 'waiting')
2. Player 2 joins → Game updated (status: 'countdown', countdown_time: 10)
3. Socket broadcasts status change
4. Player 1 (game master) starts ticker
5. Ticker calls /api/game/tick every 1 second
6. Each tick decrements countdown_time
7. When countdown_time reaches 0, game starts (status: 'active')
```

### What's Happening (Bug)
```
1. Player joins → Game created
2. Game master starts ticker ✅
3. Ticker starts MULTIPLE times ❌
4. Tick API calls not happening or failing ❌
5. Countdown stuck at initial value ❌
```

## Fixes Applied

### Fix 1: Prevent Multiple Tickers
**File:** `lib/hooks/useGameTicker.ts`
**Changes:**
- Added check for existing ticker before starting new one
- Clear existing ticker interval before creating new one
- Removed `isFallbackMaster` from dependency array

### Fix 2: Enhanced Logging
**File:** `lib/hooks/useGameTicker.ts`
**Changes:**
- Log every tick attempt with game ID and status
- Log tick API responses
- Log when ticker stops
- Log duplicate ticker prevention

### Fix 3: Better Error Handling
**File:** `lib/hooks/useGameTicker.ts`
**Changes:**
- Log HTTP status codes on error
- Catch and log all errors
- Don't silently fail

## Testing Checklist

After deploying fixes, verify:

- [ ] Only ONE "👑 Game master - starting ticker" message appears
- [ ] "🔄 Ticking game..." messages appear every 1 second
- [ ] "✅ Tick result:" messages show countdown decreasing
- [ ] Countdown UI updates every second
- [ ] Game starts when countdown reaches 0
- [ ] No "⚠️ Countdown appears stuck" warnings

## If Still Stuck

### Check 1: Is Ticker Running?
If you see "👑 Game master - starting ticker" but NO "🔄 Ticking game..." messages:
- The interval isn't being set up properly
- Check if there's a JavaScript error preventing interval creation

### Check 2: Are Ticks Failing?
If you see "🔄 Ticking game..." but NO "✅ Tick result:" messages:
- The API is failing
- Check Network tab for 500 errors
- Check server logs for errors

### Check 3: Is Status Wrong?
If ticks succeed but countdown doesn't decrease:
- Game might be in wrong status
- Check database: `SELECT status FROM games WHERE id = '[gameId]'`
- Game should be in 'countdown' status

### Check 4: Is Socket Not Broadcasting?
If countdown decreases in database but not in UI:
- Socket.IO isn't broadcasting updates
- Check socket server logs
- Verify Supabase Realtime is enabled

## Quick Fix for Stuck Games

If a game gets stuck, run this in Supabase SQL Editor:
```sql
-- Reset stuck game to countdown
UPDATE games
SET status = 'countdown', countdown_time = 10
WHERE id = '[stuck-game-id]';
```

Or delete the stuck game:
```sql
DELETE FROM games WHERE id = '[stuck-game-id]';
```
