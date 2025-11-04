# 🚀 Deployment Guide - Money Deduction Fix

## What Was Fixed

### ✅ Money Deduction on Game Start
- Money is now **properly deducted** when admin starts the game
- Uses the **actual entry fee** (5, 7, 10, 20, 50, or 100 Birr)
- Players with insufficient balance are **automatically removed**
- Prize pool is **calculated correctly**

### ✅ Exit Warnings
- **Back button** shows confirmation if game is active
- **Browser close/refresh** warns about losing stake
- Players are informed their money is at risk

## Deployment Steps

### 1. Deploy Bot (Root Project)
```bash
cd d:/Projects/YegnaBingoBot
vercel --prod
```

**Important:** Note the deployment URL (e.g., `https://yegna-bingo-bot.vercel.app`)

### 2. Set Environment Variables

#### In Vercel Dashboard for Bot:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key (for admin operations)
- `TELEGRAM_BOT_TOKEN` - Your bot token

#### In Vercel Dashboard for Dashboard:
- `NEXT_PUBLIC_BOT_URL` - Your bot's Vercel URL (e.g., `https://yegna-bingo-bot.vercel.app`)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

### 3. Deploy Mini App
```bash
cd miniapp
vercel --prod
```

### 4. Deploy Dashboard
```bash
cd dashboard
vercel --prod
```

## How It Works Now

### Before Game Starts (Waiting Room)
1. Player joins game
2. ✅ Balance checked (must have enough)
3. ✅ Player added to `game_players` with `paid: false`
4. ❌ **NO MONEY DEDUCTED**
5. ✅ Player can refresh/exit freely

### When Admin Starts Game
1. Admin clicks "Start Game" in dashboard
2. Dashboard calls `/api/start-game` endpoint
3. API endpoint:
   - Gets game's entry fee
   - Loops through all unpaid players
   - Checks each player's balance
   - **Deducts entry fee from each player**
   - Marks `paid: true`
   - Removes players with insufficient balance
   - Calculates total prize pool
   - Updates game status to `active`
   - Logs all transactions

### After Game Starts
1. Player sees "Live Game" screen
2. If player tries to exit:
   - ⚠️ **Warning dialog appears**
   - "Game has started, your entry fee has been deducted"
   - "If you leave now, you will LOSE your stake!"
   - Player must confirm to exit
3. If player closes browser/tab:
   - ⚠️ **Browser warning appears**
   - "Game is active! If you leave, you will lose your stake!"

## API Endpoints

### `/api/start-game` (POST)
**Request:**
```json
{
  "gameId": "abc-123-def"
}
```

**Response:**
```json
{
  "success": true,
  "game": { ... },
  "playersCharged": 2,
  "prizePool": 10
}
```

**Errors:**
- `400` - Game already started or no players
- `500` - Server error

## Testing Checklist

### ✅ Before Deployment
- [ ] Bot deployed to Vercel
- [ ] Environment variables set
- [ ] Dashboard deployed
- [ ] Mini app deployed

### ✅ After Deployment
- [ ] Create a test game (5 Birr)
- [ ] Join with 2 test accounts
- [ ] Check balances (should NOT be deducted yet)
- [ ] Admin starts game
- [ ] Check balances (should be deducted now)
- [ ] Verify prize pool = (2 players × 5 Birr = 10 Birr)
- [ ] Try to exit game (should show warning)
- [ ] Try to refresh (should show browser warning)

## Console Logs to Monitor

When admin starts game, you should see:
```
💰 Starting game abc123 with entry fee: 5 Birr
Checking player xyz: Balance 60, Entry Fee 5
✅ Charged player xyz: 5 Birr
Checking player abc: Balance 100, Entry Fee 5
✅ Charged player abc: 5 Birr
💰 Total Prize Pool: 10 Birr from 2 players
🎮 Game abc123 started successfully!
```

## Troubleshooting

### Money Not Deducted
- Check Vercel logs for bot deployment
- Verify `SUPABASE_SERVICE_KEY` is set correctly
- Check dashboard is calling correct bot URL

### API Errors
- Verify CORS is enabled (already configured)
- Check environment variables are set
- View Vercel function logs

### Players Can't Join
- Check balance is sufficient
- Verify game status is 'waiting'
- Check Supabase RLS policies

## Files Changed

1. `/api/start-game.js` - New API endpoint for starting games
2. `/vercel.json` - Added new API route
3. `/dashboard/pages/games.js` - Updated to call API
4. `/miniapp/pages/play/[gameId].js` - Added exit warnings
5. `/bot/services/gameService.js` - Fixed to use actual entry fee

## All Done! 🎉

Money is now properly deducted when admin starts the game, and players are warned before exiting active games!
