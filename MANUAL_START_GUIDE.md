# 🎮 Manual Game Start - Admin Guide

## ✅ Setup Complete!

Your dashboard already has manual start functionality built-in!

## 📋 How It Works:

### 1. Players Join Game
- Players open mini app
- Select entry fee (5, 10, 20, 50, 100 Birr)
- Pick their lucky number
- Click "Join Game"
- **Money is NOT deducted yet** - they're just registered

### 2. Admin Starts Game
- Admin logs into dashboard: https://yegnabingo.vercel.app
- Go to **Games** page
- See list of waiting games
- Click **"Start Game"** button
- System automatically:
  - ✅ Deducts entry fee from all players
  - ✅ Removes players with insufficient balance
  - ✅ Calculates prize pool
  - ✅ Changes status to "active"
  - ✅ Logs all transactions

### 3. Admin Calls Numbers
- Go to **Live Game** view
- Click **"Call Number"** button
- Random number is called (1-75, no duplicates)
- All players see the number in real-time
- Continue calling until someone wins

### 4. Player Wins
- Player completes row/column/diagonal
- Clicks **"BINGO!"** button
- System verifies win
- Deducts 10% commission
- Credits 90% to winner
- Game ends automatically

## 🎯 Admin Workflow:

```
1. Check "Games" page
   ↓
2. See waiting games with player count
   ↓
3. When ready (2+ players), click "Start Game"
   ↓
4. Go to "Live Game" view
   ↓
5. Call numbers one by one
   ↓
6. Winner declared automatically
   ↓
7. Prize distributed automatically
```

## 📊 Dashboard Features:

### Games Page
- **View all games** (waiting, active, completed)
- **Player count** for each game
- **Prize pool** calculation
- **Start Game** button (only for waiting games)
- **Delete Game** button (only for waiting games)
- **View Live** button (for active games)

### Live Game Page
- **Real-time player cards**
- **Called numbers history**
- **Call Number** button
- **Current prize pool**
- **Player count**
- **End Game** button (emergency)

## ⚙️ Configuration:

### Environment Variables (Dashboard)

Make sure these are set in Vercel:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |
| `SUPABASE_SERVICE_KEY` | Your service key |

### Database Setup

Run this SQL in Supabase (if not done yet):

```sql
-- Add countdown column (for future auto-start)
ALTER TABLE games ADD COLUMN IF NOT EXISTS countdown_end TIMESTAMP;

-- Update status constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check 
  CHECK (status IN ('waiting', 'countdown', 'active', 'completed', 'cancelled'));
```

## 🧪 Testing:

### Test Manual Start:

1. **Create test users** (2+ players)
2. **Join game** from mini app
3. **Login to dashboard** as admin
4. **Click "Start Game"**
5. **Verify**:
   - Player balances decreased
   - Prize pool calculated
   - Game status = "active"
   - Transactions logged

### Expected Behavior:

**Before Start:**
- Game status: "waiting"
- Player paid: false
- Prize pool: 0
- Player balance: unchanged

**After Start:**
- Game status: "active"
- Player paid: true
- Prize pool: (entry fee × player count)
- Player balance: (original - entry fee)

## 🚨 Troubleshooting:

### "Start Game" button disabled?
- **Cause**: No players in game
- **Fix**: Wait for players to join

### Players removed when starting?
- **Cause**: Insufficient balance
- **Fix**: Players need to deposit money first

### Game doesn't start?
- **Check**: Dashboard console for errors
- **Check**: Supabase logs
- **Check**: Player balances
- **Check**: Environment variables set

### Numbers not calling?
- **Check**: Game status is "active"
- **Check**: You're on the Live Game page
- **Check**: Click "Call Number" button

## 📞 Admin Notifications:

Currently, admins need to:
- **Manually check** dashboard for new games
- **Manually start** games when ready
- **Manually call** numbers

**Future Enhancement**: 
- Telegram notifications when players join
- Auto-start after countdown
- Auto-call numbers

## ✅ Current Status:

- ✅ Manual start working
- ✅ Prize distribution working
- ✅ 10% commission working
- ✅ Win detection working
- ✅ Transaction logging working
- ⏳ Auto-start (future)
- ⏳ Auto-call numbers (future)

## 🎉 You're Ready!

The manual start system is **fully functional** and ready to use!

1. ✅ Run the SQL (if not done)
2. ✅ Login to dashboard
3. ✅ Wait for players to join
4. ✅ Click "Start Game"
5. ✅ Call numbers
6. ✅ Winner gets paid automatically!

---

**Dashboard URL**: https://yegnabingo.vercel.app
**Admin Login**: Use your admin credentials
