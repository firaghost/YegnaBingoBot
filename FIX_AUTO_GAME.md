# 🔧 Fix Auto-Game System

## 🚨 Problems Identified:

1. **Database missing `countdown_end` column** - SQL not executed
2. **Serverless functions lose state** - `setTimeout` doesn't work in serverless
3. **No cron job** - Need scheduled function to check countdowns

## ✅ Solutions:

### Step 1: Add Database Column

Run this SQL in Supabase SQL Editor:

```sql
-- Add countdown_end column
ALTER TABLE games ADD COLUMN IF NOT EXISTS countdown_end TIMESTAMP;

-- Update status constraint to include 'countdown'
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check 
  CHECK (status IN ('waiting', 'countdown', 'active', 'completed', 'cancelled'));
```

### Step 2: Create Cron Job API

The miniapp needs a cron job to check for expired countdowns.

**File: `miniapp/pages/api/cron-check-games.js`**

This will be called every minute by Vercel Cron.

### Step 3: Configure Vercel Cron

Add to `miniapp/vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron-check-games",
    "schedule": "* * * * *"
  }]
}
```

This runs every minute to check for:
- Games with 2+ players → Start countdown
- Countdowns that expired → Start game
- Active games → Call numbers

## 🎯 Alternative: Use Supabase Edge Functions

Instead of Vercel Cron, use Supabase's built-in cron:

1. Create Edge Function
2. Schedule with pg_cron
3. More reliable for game logic

## 🚀 Quick Fix (For Now):

Since serverless won't work for auto-game, we need to:

1. **Manual start** - Admin starts game from dashboard
2. **OR** - Deploy bot to a VPS/Railway (always running)
3. **OR** - Use Vercel Cron (requires paid plan)

## 📝 Recommended Solution:

**Deploy the auto-game logic to Railway/Render** (free tier):

1. Create separate service for game automation
2. Runs 24/7 checking for games to start
3. Calls numbers automatically
4. More reliable than serverless

Would you like me to:
- A) Set up Vercel Cron (requires paid plan)
- B) Create Railway deployment for auto-game
- C) Keep manual start from dashboard for now
