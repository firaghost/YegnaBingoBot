# Game Loading Issues - Fixed

## 🚨 CRITICAL: Run Database Migration First!

Before testing, you **MUST** run this SQL in Supabase SQL Editor:

### Option 1: Complete Fix (Recommended)
```sql
-- Copy/paste contents of supabase/fix_all_issues.sql
-- This fixes EVERYTHING: missing columns, RLS, stuck games
```

### Option 2: Individual Fixes
```sql
-- 1. Add missing columns
\i supabase/add_missing_game_columns.sql

-- 2. Disable RLS for development
\i supabase/disable_rls_dev.sql
```

**Why?** 
1. The game was crashing because the `games` table was missing columns
2. The 406 errors are caused by RLS blocking queries
3. Running `fix_all_issues.sql` fixes both problems at once

---

## Problems Identified

### 1. ✅ Infinite Loop (FIXED)
**Symptom**: Game initialization running hundreds of times, deducting money repeatedly
**Root Cause**: `useEffect` dependencies included `joinGame` and `leaveGame` which weren't memoized
**Fix**: 
- Added `initializingRef` to prevent concurrent initializations
- Removed unstable dependencies from effect array
- Separated cleanup logic into independent effect

### 2. ✅ Stuck on Loading Screen (FIXED)
**Symptom**: "Connecting to game..." shown indefinitely
**Root Cause**: 
- `leaveGame` was being called immediately after `joinGame`, clearing `gameState`
- Cleanup effect was running on every render due to unstable dependencies
**Fix**:
- Used `cleanupRef` to store cleanup data
- Cleanup effect now only runs on unmount (empty dependency array)
- Made `joinGame` awaited before setting `loading = false`

### 3. ⚠️ Supabase 406 Errors (NEEDS VERIFICATION)
**Symptom**: `GET .../games?... 406 (Not Acceptable)`
**Likely Cause**: RLS policies or missing Accept headers
**Fix Applied**: 
- Added explicit headers to Supabase client configuration
- Set `Accept: application/json` and `Content-Type: application/json`

**Action Required**: 
1. **CRITICAL**: Run this SQL migration first to add missing columns:
```sql
-- Run in Supabase SQL Editor
\i supabase/add_missing_game_columns.sql
```

2. If 406 errors persist, run the RLS fix:
```sql
-- Run the RLS fix
\i supabase/fix_all_rls_simple.sql
```

## Changes Made

### `app/game/[roomId]/page.tsx`
1. Added `useRef` imports and refs for state management
2. Added `initializingRef` to prevent duplicate initializations
3. Added `cleanupRef` to store cleanup data without triggering re-renders
4. Made `joinGame` awaited (line 200)
5. Stored cleanup data after successful join (line 204)
6. Fixed cleanup effect to only run on unmount
7. Increased safety timeout to 10 seconds with debug logging
8. Improved loading state checks
9. **Removed "Back to Lobby" link** - only "Leave Game" button remains
10. **Re-fetch game status** after joining to ensure start API is called
11. **Added countdown monitor** - restarts game loop if countdown stuck for 15+ seconds

### `lib/hooks/useSocket.ts`
1. Added debug logging for game state fetching
2. Added error handling for failed game state fetch
3. Logs now show: "📥 Fetching initial game state..." → "✅ Initial game state loaded: waiting"
4. **Fixed `joinGame` stability** - now uses `useRef` for channel tracking
5. **Removed dependencies** from `joinGame` useCallback (now `[]`)
6. Channel cleanup no longer causes re-creation of `joinGame` function

### `lib/supabase.ts`
1. Added explicit headers configuration
2. Set schema to 'public'
3. Added Accept and Content-Type headers

### `app/api/game/start/route.ts`
1. **Removed `last_call_time` update** - column didn't exist, causing crashes
2. **Removed `number_sequence_hash` update** - column didn't exist
3. Game loop now works without these optional audit columns

### `supabase/add_missing_game_columns.sql` (NEW FILE)
1. Adds `last_call_time` column for future use
2. Adds `number_sequence_hash` column for provably fair gaming
3. Adds `min_players` column
4. Updates status constraint to include 'waiting' state

## Expected Behavior Now

1. User navigates to `/game/[roomId]`
2. Shows "Joining game..." spinner
3. Initializes game **once** (creates/joins in DB)
4. Deducts stake **once**
5. Calls `await joinGame()` and waits for initial state
6. Sets `loading = false`
7. Shows "Connecting to game..." briefly
8. Game state loads and shows appropriate screen
9. Cleanup only happens on page unmount

## Testing Checklist

- [ ] Game initializes only once (check console logs)
- [ ] Money deducted only once
- [ ] No "👋 Leaving game" logs until you actually leave
- [ ] Game state loads within 10 seconds
- [ ] No 406 errors in console
- [ ] Game displays waiting/countdown/active state correctly

## Troubleshooting

### If still stuck on loading:
1. Check browser console for errors
2. Look for "⚠️ Game state failed to load after 10 seconds"
3. Check if "✅ Initial game state loaded" appears
4. Verify Supabase RLS policies are correct

### If 406 errors persist:
1. Run `supabase/fix_all_rls_simple.sql` in Supabase SQL Editor
2. Check Supabase project settings → API → URL and Keys are correct
3. Verify `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### If money still deducted multiple times:
1. Clear browser cache and reload
2. Check if `initializingRef` is working (should see only one "🎮 Initializing game" log)
3. Verify database transactions table for duplicate entries

### If countdown gets stuck:
1. Check browser console for "⚠️ Countdown appears stuck" message
2. The system will automatically attempt to restart after 15 seconds
3. Check server logs to see if game loop is running
4. Verify the `/api/game/start` endpoint is accessible

## Latest Updates (2025-11-10)

### UI Changes
- ✅ Removed "Back to Lobby" link from game page header
- ✅ Only "Leave Game" button remains during gameplay
- ✅ Cleaner header with just room name and leave button

### Countdown Fix
- ✅ Re-fetch game status after joining to ensure start API is called
- ✅ Added 15-second countdown monitor with auto-restart
- ✅ Better logging to diagnose countdown issues
- ✅ Handles race condition where first player doesn't trigger start

### Socket Stability
- ✅ `joinGame` function now stable across renders
- ✅ Uses `useRef` instead of state dependencies
- ✅ No more premature cleanup causing game state loss
