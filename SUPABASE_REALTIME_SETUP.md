# Supabase Realtime Setup Guide

## Overview

Your app now uses **Supabase Realtime** instead of Socket.IO, which means:
- ✅ No separate socket server needed
- ✅ Works perfectly with Vercel serverless
- ✅ Automatic scaling and reliability
- ✅ Real-time game updates via database changes

---

## Setup Steps

### 1. Update Database Schema

Run the SQL script to add required columns:

```bash
# In Supabase Dashboard → SQL Editor
```

Execute the file: `supabase/update_games_table.sql`

This will:
- Add `min_players` column (default: 2)
- Add `latest_number` column for real-time updates
- Update status constraint to include 'waiting' state
- Enable Realtime for the games table

---

### 2. Deploy Edge Function for Bingo Claims

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the claim-bingo function
supabase functions deploy claim-bingo
```

Or manually in Supabase Dashboard:
1. Go to **Edge Functions**
2. Create new function: `claim-bingo`
3. Copy content from `supabase/functions/claim-bingo/index.ts`
4. Deploy

---

### 3. Enable Realtime on Games Table

**Option A: Via SQL (Recommended)**

In Supabase Dashboard → SQL Editor, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE games;
```

Or run the file: `supabase/enable_realtime.sql`

**Option B: Via API Settings**

1. Go to **Settings** → **API**
2. Scroll to **Realtime** section
3. Add `games` to the list of tables
4. Click **Save**

**Verify it's enabled:**
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```
You should see `games` in the results.

---

### 4. Update Environment Variables

You **don't need** `NEXT_PUBLIC_SOCKET_URL` anymore!

Remove it from:
- Vercel environment variables
- Local `.env` file

The app now uses Supabase URLs which are already configured.

---

### 5. Redeploy Your App

```bash
# Commit changes
git add .
git commit -m "Switch to Supabase Realtime"
git push

# Vercel will auto-deploy
```

---

## How It Works Now

### Game Flow

1. **Player Joins Room**
   - Creates or joins a game with `waiting` status
   - Game needs minimum 2 players to start

2. **Waiting State**
   - Shows "Waiting for Players" screen
   - Displays current player count (e.g., 1/2)
   - Prize pool updates in real-time

3. **Countdown State**
   - When 2+ players join, status changes to `countdown`
   - 10-second countdown begins
   - All players see the countdown via Realtime

4. **Active Game**
   - Game starts, numbers are called
   - Players mark their cards locally
   - Game state syncs via Supabase Realtime

5. **Queue System**
   - If a player tries to join an `active` game
   - They see "You're in the queue" message
   - They'll join the next game when current one ends

---

## Real-time Updates

The app subscribes to database changes:

```typescript
supabase
  .channel(`game:${gameId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'games',
    filter: `id=eq.${gameId}`
  }, (payload) => {
    // Game state updates automatically
  })
```

---

## Testing

### Test Minimum Players

1. Open game in one browser
2. Should see "Waiting for Players 1/2"
3. Open same game in another browser (incognito)
4. Should automatically start countdown when 2nd player joins

### Test Queue System

1. Start a game with 2 players
2. Try to join from a 3rd browser
3. Should see "You're in the queue" message

---

## Troubleshooting

### Realtime not working?

1. **Check Realtime is enabled**
   - Supabase Dashboard → Database → Replication
   - Ensure `games` table has Realtime enabled

2. **Check RLS Policies**
   - Games table should allow SELECT for authenticated users
   - Run: `supabase/fix_rls_policies.sql`

3. **Check Browser Console**
   - Look for subscription status logs
   - Should see "📡 Subscription status: SUBSCRIBED"

### Game not starting?

1. **Check min_players column exists**
   - Run: `SELECT * FROM games LIMIT 1;`
   - Should have `min_players` column

2. **Check game status**
   - Should transition: `waiting` → `countdown` → `active`

### Edge Function errors?

1. **Check function is deployed**
   - Supabase Dashboard → Edge Functions
   - Should see `claim-bingo` function

2. **Check environment variables**
   - Function needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

---

## Advantages of Supabase Realtime

✅ **No separate server** - Everything runs on Supabase
✅ **Serverless-friendly** - Works perfectly with Vercel
✅ **Automatic scaling** - Supabase handles all the load
✅ **Built-in authentication** - Uses your existing Supabase auth
✅ **Cost-effective** - No extra hosting costs
✅ **Reliable** - Supabase's infrastructure is battle-tested

---

## Next Steps

1. ✅ Run `update_games_table.sql` in Supabase
2. ✅ Deploy `claim-bingo` edge function
3. ✅ Enable Realtime on games table
4. ✅ Remove `NEXT_PUBLIC_SOCKET_URL` from env vars
5. ✅ Push to GitHub and redeploy
6. ✅ Test with multiple browsers

---

## Need Help?

- Check Supabase logs: Dashboard → Logs
- Check browser console for errors
- Verify Realtime subscription status
- Test with Supabase Studio (real-time data viewer)
