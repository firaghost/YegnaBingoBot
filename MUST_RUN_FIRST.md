# ⚠️ CRITICAL: RUN THIS FIRST OR GAME WON'T WORK!

## You're seeing 406 errors because you haven't run the database migration!

### Step-by-Step Instructions:

#### 1. Open Supabase Dashboard
- Go to https://supabase.com/dashboard
- Select your project

#### 2. Open SQL Editor
- Click "SQL Editor" in the left sidebar
- Click "+ New Query"

#### 3. Copy & Paste This SQL
```sql
-- ============================================
-- COMPLETE FIX FOR ALL GAME ISSUES
-- ============================================

-- Add missing columns
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS last_call_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS number_sequence_hash TEXT;

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;

-- Fix status constraint
ALTER TABLE games 
DROP CONSTRAINT IF EXISTS games_status_check;

ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status IN ('waiting', 'countdown', 'active', 'finished'));

-- Disable RLS for development
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_games_last_call_time ON games(last_call_time);
CREATE INDEX IF NOT EXISTS idx_games_room_status ON games(room_id, status);

-- Clean up stuck games
UPDATE games 
SET status = 'finished' 
WHERE status IN ('waiting', 'countdown', 'active') 
  AND created_at < NOW() - INTERVAL '1 hour';
```

#### 4. Click "RUN" Button
- You should see success messages

#### 5. Restart Your Dev Server
```bash
# Press Ctrl+C to stop
# Then restart:
npm run dev
```

#### 6. Clear Browser Cache
- Press Ctrl+Shift+Delete
- Clear cached images and files
- Or use Incognito/Private mode

## What This Fixes:

✅ **406 Errors** - RLS is now disabled  
✅ **Missing Columns** - Added to games table  
✅ **Game Crashes** - No more column errors  
✅ **Stuck Games** - Cleaned up old games  
✅ **Bingo Claims** - Now uses API route instead of Edge Function  

## After Running SQL, You Should See:

1. ✅ No more 406 errors in console
2. ✅ Game creates/joins successfully
3. ✅ Countdown works (10 → 0)
4. ✅ Numbers are called every 3 seconds
5. ✅ Bingo can be claimed
6. ✅ Winner is declared

## Still Having Issues?

### If you still see 406 errors:
- Make sure you ran the SQL in the CORRECT Supabase project
- Check Table Editor → games → Settings → "Row Level Security" should be OFF
- Verify the SQL ran without errors

### If bingo claim fails:
- Check that `/api/game/claim-bingo/route.ts` exists
- Restart dev server
- Check browser console for specific error

### If game doesn't start:
- Need at least 2 players (or set min_players to 1 in SQL)
- Check server logs for game loop errors
- Verify countdown is updating

## Need Help?

See `GAME_LOADING_FIX.md` for detailed documentation.
