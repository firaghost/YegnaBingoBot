# 🤖 Auto-Game System - Complete Guide

## Overview
The game now runs **fully automatically** with no admin intervention needed!

## How It Works

### **1. Auto-Countdown (60 seconds)**
When **2 or more players** join a game:
- ⏰ **60-second countdown starts automatically**
- 🎮 More players can join during countdown
- 📊 Countdown displayed in real-time on UI
- 🔔 Players see: "Game Starting in 0:XX"

### **2. Auto-Start Game**
After countdown ends:
- 💰 **Money automatically deducted** from all players
- 🎯 Game status changes to `active`
- 🚀 Prize pool calculated
- ❌ Players with insufficient balance removed
- ✅ All transactions logged

### **3. Auto-Call Numbers**
Once game starts:
- 🔢 **Numbers called every 5 seconds**
- 🎲 Random selection from 1-75
- 📡 Real-time updates to all players
- 🎯 Automatic winner detection

### **4. Auto-End Game**
When someone wins:
- 🏆 Winner detected automatically
- 💰 Prize awarded instantly
- 📝 Transaction logged
- 🔔 Notifications sent
- ⏹️ Number calling stops

---

## Database Changes

Run this SQL in Supabase:

```sql
-- Add new fields
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS countdown_end TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_number INTEGER;

-- Add 'countdown' status (if using enum)
-- ALTER TYPE game_status ADD VALUE 'countdown';
```

---

## Game Flow

```
┌─────────────────────────────────────┐
│  Player 1 Joins (1 player)          │
│  Status: waiting                     │
│  No countdown yet                    │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Player 2 Joins (2 players)          │
│  ⏰ COUNTDOWN STARTS (60 seconds)    │
│  Status: waiting (with countdown)    │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  More Players Can Join               │
│  Countdown continues...              │
│  UI shows: "Game Starting in 0:XX"   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Countdown Ends (0:00)               │
│  🚀 AUTO-START GAME                  │
│  💰 Deduct money from all players    │
│  Status: active                      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  🔢 AUTO-CALL NUMBERS                │
│  Every 5 seconds                     │
│  Random 1-75                         │
│  Real-time updates                   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  🎯 BINGO DETECTED                   │
│  🏆 Winner found automatically       │
│  💰 Prize awarded                    │
│  Status: completed                   │
└─────────────────────────────────────┘
```

---

## API Endpoints

### `/api/check-countdown` (POST)
Triggered when player joins game.

**Request:**
```json
{
  "gameId": "abc-123"
}
```

**What it does:**
1. Checks player count
2. If 2+ players → starts 60s countdown
3. Sets timeout to auto-start game
4. Updates `countdown_end` in database

---

### `/api/start-game` (POST)
Called automatically after countdown OR manually by admin.

**Request:**
```json
{
  "gameId": "abc-123"
}
```

**What it does:**
1. Gets game's entry fee
2. Deducts money from all players
3. Marks players as `paid: true`
4. Calculates prize pool
5. Sets game status to `active`
6. Starts auto number calling

---

## UI Features

### Countdown Banner
Appears when countdown is active:

```
┌──────────────────────────────────────┐
│  ⏰ Game Starting in 0:45             │
│  3 players joined • More can join!   │
└──────────────────────────────────────┘
```

- **Orange/Red gradient** background
- **Animated pulse** effect
- **Real-time countdown** (MM:SS format)
- **Player count** displayed

### Auto Number Display
During game:
- Numbers appear automatically every 5 seconds
- Last called number highlighted
- All called numbers visible
- No manual calling needed

---

## Configuration

### Timing Settings

**Countdown Duration:** 60 seconds
```javascript
// In api/check-countdown.js
const countdownEnd = new Date(Date.now() + 60000); // 60 seconds
```

**Number Call Interval:** 5 seconds
```javascript
// In api/check-countdown.js
const interval = setInterval(async () => {
  // Call next number
}, 5000); // 5 seconds
```

**Minimum Players:** 2
```javascript
// In api/check-countdown.js
if (playerCount >= 2 && game.status === 'waiting') {
  await startCountdown(gameId);
}
```

---

## Testing

### Test Auto-Countdown
1. Create a 5 Birr game
2. Join with Player 1 → No countdown
3. Join with Player 2 → Countdown starts!
4. Watch countdown: 0:60 → 0:59 → ... → 0:00
5. Game auto-starts at 0:00

### Test Auto-Start
1. Wait for countdown to reach 0:00
2. Check console logs:
   ```
   🚀 Auto-starting game abc123
   💰 Starting game abc123 with entry fee: 5 Birr
   ✅ Charged player xyz: 5 Birr
   💰 Total Prize Pool: 10 Birr from 2 players
   🎮 Game abc123 started successfully!
   ```
3. Verify money deducted from players
4. Verify game status = `active`

### Test Auto-Call Numbers
1. After game starts, watch console:
   ```
   🔢 Starting auto number calling for game abc123
   🔢 Called number 42 (1/75)
   🔢 Called number 17 (2/75)
   🔢 Called number 63 (3/75)
   ```
2. Check UI updates in real-time
3. Verify numbers appear every 5 seconds

### Test Auto-End
1. Mark numbers to complete a line
2. System detects BINGO automatically
3. Winner gets prize instantly
4. Game ends, number calling stops

---

## Advantages

✅ **No Admin Needed** - Fully automated
✅ **Fast Games** - 60s countdown + auto-play
✅ **Fair** - Random number generation
✅ **Real-time** - Instant updates
✅ **Scalable** - Multiple games run simultaneously
✅ **Transparent** - All actions logged

---

## Deployment

```bash
# 1. Run SQL migration
# Execute add_countdown_field.sql in Supabase

# 2. Deploy bot API
git add .
git commit -m "Add auto-game system"
git push

# 3. Deploy miniapp
cd miniapp
vercel --prod

# 4. Test!
```

---

## Monitoring

### Console Logs to Watch

**Countdown Started:**
```
⏰ Countdown started for game abc123, ends at 2025-11-05T09:00:00.000Z
```

**Auto-Start:**
```
🚀 Auto-starting game abc123
✅ Game abc123 auto-started with 2 players
```

**Number Calling:**
```
🔢 Starting auto number calling for game abc123
🔢 Called number 42 (1/75)
```

**Winner Detected:**
```
🎉 WINNER! Player xyz won game abc123
✅ Game abc123 ended. Winner: xyz, Prize: 9.00 Birr
```

---

## Troubleshooting

### Countdown Doesn't Start
- Check player count ≥ 2
- Verify game status = 'waiting'
- Check `/api/check-countdown` is called
- View Vercel function logs

### Game Doesn't Auto-Start
- Check countdown_end timestamp
- Verify timeout is set
- Check `/api/start-game` response
- Ensure players have sufficient balance

### Numbers Don't Auto-Call
- Verify game status = 'active'
- Check interval is running
- View console logs for errors
- Ensure game hasn't ended

---

## Summary

🎮 **2+ players join** → ⏰ **60s countdown** → 🚀 **Auto-start** → 🔢 **Auto-call numbers** → 🏆 **Auto-detect winner** → 💰 **Award prize**

**No admin intervention needed!** The game runs completely automatically from start to finish! 🎉
