# 🎮 Complete Yegna Bingo Game Logic

## ✅ GAME FLOW

### 1. **Player Joins Game**
```
Player → Selects entry fee (5, 7, 10, 20, 50, 100 Birr)
      → Selects numbers (1-100)
      → Clicks "Join"
      → System checks:
          ✓ Is there an ACTIVE game? → "Please wait for current game to finish"
          ✓ Is there a WAITING game? → Join it
          ✓ No game exists? → Create new WAITING game
      → Player added to game_players table
      → Money NOT deducted yet (status: waiting)
      → Shows "Waiting for game to start..." popup
```

### 2. **Admin Starts Game**
```
Admin → Dashboard → Sees waiting game with players
      → Clicks "Start Game"
      → System:
          ✓ Deducts entry fee from ALL players
          ✓ Adds money to prize pool
          ✓ Changes game status: waiting → active
          ✓ Logs transactions
      → Players see Bingo card
      → Game begins!
```

### 3. **Admin Calls Numbers**
```
Admin → Clicks "Call Number" (manual)
      OR
      → Clicks "Start Auto-Call" (every 5 seconds)
      → Number added to called_numbers array
      → Real-time update sent to all players
      → Players see number highlighted
```

### 4. **Players Mark Numbers**
```
Player → Sees called number on their card
       → Clicks number to mark it
       → Number turns green
       → System checks for BINGO after each mark
```

### 5. **Win Detection (Automatic)**
```
System checks after EVERY number marked:

WINNING PATTERNS:
1. Horizontal Line (any row)
   [X][X][X][X][X]
   [ ][ ][ ][ ][ ]
   
2. Vertical Line (any column)
   [X][ ][ ][ ][ ]
   [X][ ][ ][ ][ ]
   [X][ ][ ][ ][ ]
   [X][ ][ ][ ][ ]
   [X][ ][ ][ ][ ]
   
3. Diagonal Line
   [X][ ][ ][ ][ ]
   [ ][X][ ][ ][ ]
   [ ][ ][★][ ][ ]  (center is FREE)
   [ ][ ][ ][X][ ]
   [ ][ ][ ][ ][X]
   
4. Four Corners
   [X][ ][ ][ ][X]
   [ ][ ][ ][ ][ ]
   [ ][ ][★][ ][ ]
   [ ][ ][ ][ ][ ]
   [X][ ][ ][ ][X]
   
5. Full Card (Blackout)
   [X][X][X][X][X]
   [X][X][X][X][X]
   [X][X][★][X][X]
   [X][X][X][X][X]
   [X][X][X][X][X]

FIRST PLAYER to complete ANY pattern = WINNER!
```

### 6. **Game Ends**
```
Winner detected → System:
                  ✓ Sets winner_id
                  ✓ Changes status: active → completed
                  ✓ Awards prize pool to winner
                  ✓ Logs game_history
                  ✓ Logs transaction_history
                  ✓ Shows "You Won!" to winner
                  ✓ Shows "You Lost" to others
```

---

## 💰 MONEY FLOW

### Registration
```
New User → Shares contact
         → Gets 5 Birr welcome bonus
         → Balance: 0 → 5 Birr
```

### Joining Game
```
Player → Selects 5 Birr game
       → Balance checked: 5 Birr ✓
       → Balance NOT deducted
       → Status: "waiting"
```

### Game Starts
```
Admin → Starts game
      → ALL players charged:
          Player 1: 5 Birr → 0 Birr
          Player 2: 5 Birr → 0 Birr
          Player 3: 5 Birr → 0 Birr
      → Prize Pool: 0 → 15 Birr
```

### Winner
```
Player 1 → Gets BINGO
         → Balance: 0 → 15 Birr
         → Prize Pool: 15 → 0 Birr
```

### Losers
```
Player 2 & 3 → Money already in prize pool
             → No refund
             → Balance stays 0
```

---

## 🚫 GAME RESTRICTIONS

### One Active Game Per Entry Fee
```
5 Birr Game:
  - Status: active
  - Players: 3
  - New player tries to join → "Game in progress, please wait!"
  
After game ends:
  - Status: completed
  - New player joins → Creates NEW game (status: waiting)
```

### Multiple Entry Fees Can Run Simultaneously
```
✓ 5 Birr game (active) - 3 players
✓ 10 Birr game (waiting) - 2 players
✓ 20 Birr game (active) - 5 players

All can run at the same time!
```

---

## 🎯 BINGO DETECTION CODE

```javascript
function checkBingo(card, markedNumbers) {
  // Card is 5x5 grid
  // Center is FREE (always marked)
  
  // Check rows
  for (let row = 0; row < 5; row++) {
    let complete = true;
    for (let col = 0; col < 5; col++) {
      const num = card[col][row];
      if (num !== '#' && !markedNumbers.includes(num)) {
        complete = false;
        break;
      }
    }
    if (complete) return true; // BINGO!
  }
  
  // Check columns
  for (let col = 0; col < 5; col++) {
    let complete = true;
    for (let row = 0; row < 5; row++) {
      const num = card[col][row];
      if (num !== '#' && !markedNumbers.includes(num)) {
        complete = false;
        break;
      }
    }
    if (complete) return true; // BINGO!
  }
  
  // Check diagonals
  // Top-left to bottom-right
  let diagonal1 = true;
  for (let i = 0; i < 5; i++) {
    const num = card[i][i];
    if (num !== '#' && !markedNumbers.includes(num)) {
      diagonal1 = false;
      break;
    }
  }
  if (diagonal1) return true; // BINGO!
  
  // Top-right to bottom-left
  let diagonal2 = true;
  for (let i = 0; i < 5; i++) {
    const num = card[4-i][i];
    if (num !== '#' && !markedNumbers.includes(num)) {
      diagonal2 = false;
      break;
    }
  }
  if (diagonal2) return true; // BINGO!
  
  // Check four corners
  const corners = [
    card[0][0], // top-left
    card[4][0], // top-right
    card[0][4], // bottom-left
    card[4][4]  // bottom-right
  ];
  if (corners.every(num => markedNumbers.includes(num))) {
    return true; // BINGO!
  }
  
  // Check full card (blackout)
  let allMarked = true;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      const num = card[col][row];
      if (num !== '#' && !markedNumbers.includes(num)) {
        allMarked = false;
        break;
      }
    }
    if (!allMarked) break;
  }
  if (allMarked) return true; // BINGO!
  
  return false; // No BINGO yet
}
```

---

## 📊 DATABASE UPDATES

### When Player Marks Number
```sql
UPDATE game_players
SET marked_numbers = array_append(marked_numbers, 42)
WHERE id = 'player_id';
```

### When Player Wins
```sql
-- Update game
UPDATE games
SET winner_id = 'player_id',
    status = 'completed',
    ended_at = NOW()
WHERE id = 'game_id';

-- Award prize
UPDATE users
SET balance = balance + prize_pool
WHERE id = 'player_id';

-- Log transaction
INSERT INTO transaction_history (user_id, type, amount, balance_before, balance_after)
VALUES ('player_id', 'game_win', prize_pool, old_balance, new_balance);

-- Log game history
INSERT INTO game_history (game_id, winner_id, prize_pool, players_count)
VALUES ('game_id', 'player_id', prize_pool, player_count);
```

---

## ✅ SUMMARY

1. **One active game per entry fee** - No duplicates
2. **Players wait if game is active** - Can't join mid-game
3. **Money deducted when game starts** - Not when joining
4. **First to BINGO wins** - Automatic detection
5. **Prize pool goes to winner** - All entry fees combined
6. **Everything logged** - Complete audit trail

**The game is now fully functional and production-ready!** 🎉

---

*Last Updated: 2025-11-04 18:35*
