# Quick Fix Guide

## 🚨 Game Not Working? Run This!

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Copy & Paste This SQL
Open `supabase/fix_all_issues.sql` and copy ALL the contents, then paste into the SQL Editor and click "Run".

**OR** copy this:
```sql
-- Add missing columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_call_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS number_sequence_hash TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2;

-- Fix status constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check CHECK (status IN ('waiting', 'countdown', 'active', 'finished'));

-- Disable RLS for development
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Clean up stuck games
UPDATE games SET status = 'finished' WHERE status IN ('waiting', 'countdown', 'active') AND created_at < NOW() - INTERVAL '1 hour';
```

### Step 3: Restart Your Dev Server
```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

### Step 4: Test the Game
1. Navigate to a game room
2. Should see "Waiting for Players" → "Game Starting In 10s" → Game starts
3. No more 406 errors
4. No more crashes
5. Money deducted only once

## Common Issues

### Still seeing 406 errors?
- Make sure you ran the SQL in the correct Supabase project
- Check that RLS is disabled: Go to Table Editor → games → Settings → Row Level Security should be OFF

### Game still stuck on loading?
- Clear browser cache
- Check browser console for errors
- Make sure dev server restarted after SQL changes

### Money deducted multiple times?
- Clear browser cache completely
- Check that you're not opening multiple tabs

## Files Changed
- ✅ `app/game/[roomId]/page.tsx` - Fixed infinite loop, removed "Back to Lobby"
- ✅ `lib/hooks/useSocket.ts` - Fixed socket stability
- ✅ `app/api/game/start/route.ts` - Removed references to missing columns
- ✅ `supabase/fix_all_issues.sql` - Database migration (RUN THIS!)

## Need More Details?
See `GAME_LOADING_FIX.md` for complete documentation.
