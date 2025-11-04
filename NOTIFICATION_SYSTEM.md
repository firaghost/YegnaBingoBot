# 🔔 Notification System - Complete Guide

## Overview
The notification system sends Telegram messages to users for important events:
- Payment approvals/rejections
- Game wins/losses
- Game start notifications

## ✅ What's Implemented

### 1. **Notification Service** (`bot/services/notificationService.js`)
Core functions for sending notifications:
- `notifyDepositApproved(userId, amount)`
- `notifyDepositRejected(userId, amount, reason)`
- `notifyWithdrawalApproved(userId, amount, method, accountNumber)`
- `notifyWithdrawalRejected(userId, amount, reason)`
- `notifyGameWin(userId, gameId, prizeAmount)`
- `notifyGameLoss(userId, gameId, winnerId)`
- `notifyGameStart(gameId)`

### 2. **API Endpoints**

**Mini App APIs** (`miniapp/pages/api/`):
- `/api/notify-game-result` - Triggers game result notifications
- `/api/notify-payment` - Triggers payment notifications

**Bot APIs** (`bot/api/`):
- `/api/notify-game-result` - Sends game result to Telegram
- `/api/notify-payment` - Sends payment status to Telegram

### 3. **Automatic Notifications**

#### Game Results
When a player wins:
```javascript
// Automatically called in endGame() function
notifyGameWin(winnerId, gameId, prizeAmount);
notifyGameLoss(loserId, gameId, winnerId);
```

**Winner receives:**
```
🎉 BINGO! YOU WON!

🏆 Congratulations!
💰 Prize: 13.50 Birr
💳 New Balance: 73.50 Birr

🎮 Game ID: 7e8852ac

Amazing! Keep playing to win more!
Use /play to join another game.
```

**Losers receive:**
```
😔 Game Over

Better luck next time!
🏆 Winner: kinkokkkg
💳 Your Balance: 60.00 Birr

🎮 Game ID: 7e8852ac

Don't give up! Try again!
Use /play to join another game.
```

#### Payment Notifications

**Deposit Approved:**
```
✅ Deposit Approved!

💰 Amount: 100 Birr
💳 New Balance: 160 Birr

Your deposit has been successfully processed.
You can now play games!

Use /play to start playing.
```

**Deposit Rejected:**
```
❌ Deposit Rejected

💰 Amount: 100 Birr
📋 Reason: Invalid transaction proof

Please contact support if you believe this is an error.
Or try submitting again with correct details.
```

**Withdrawal Approved:**
```
✅ Withdrawal Approved!

💸 Amount: 50 Birr
📱 Method: Telebirr
🔢 Account: 0912345678
💳 Remaining Balance: 10 Birr

Your withdrawal has been processed.
You should receive the money within 24 hours.
```

**Withdrawal Rejected:**
```
❌ Withdrawal Rejected

💸 Amount: 50 Birr
📋 Reason: Invalid account details

💳 Your Balance: 60 Birr

Your balance has been restored.
Please contact support if you need assistance.
```

## 🔧 How to Use in Admin Dashboard

### When Approving Deposit:
```javascript
// After updating payment status in database
await fetch('/api/notify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: payment.user_id,
    type: 'deposit',
    status: 'approved',
    amount: payment.amount
  })
});
```

### When Rejecting Deposit:
```javascript
await fetch('/api/notify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: payment.user_id,
    type: 'deposit',
    status: 'rejected',
    amount: payment.amount,
    reason: 'Invalid transaction proof'
  })
});
```

### When Approving Withdrawal:
```javascript
await fetch('/api/notify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: payment.user_id,
    type: 'withdrawal',
    status: 'approved',
    amount: payment.amount,
    method: payment.payment_method,
    accountNumber: payment.account_number
  })
});
```

### When Rejecting Withdrawal:
```javascript
await fetch('/api/notify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: payment.user_id,
    type: 'withdrawal',
    status: 'rejected',
    amount: payment.amount,
    reason: 'Invalid account number'
  })
});
```

## 📝 Environment Variables

Add to `.env`:
```
BOT_URL=http://localhost:3001  # For local development
# or
BOT_URL=https://your-bot-domain.com  # For production
```

## 🚀 Deployment

1. **Deploy Bot:**
```bash
cd bot
pm2 restart yegna-bingo-bot
```

2. **Deploy Mini App:**
```bash
cd miniapp
vercel --prod
```

3. **Test Notifications:**
- Make a deposit/withdrawal request
- Admin approves/rejects
- User receives Telegram notification
- Play a game and win/lose
- User receives game result notification

## ✅ Complete Flow

### Deposit Flow:
1. User submits deposit via Mini App
2. Admin receives notification
3. Admin approves in dashboard
4. Dashboard calls `/api/notify-payment`
5. User receives Telegram notification ✅

### Withdrawal Flow:
1. User submits withdrawal via Bot or Mini App
2. Admin receives notification
3. Admin approves in dashboard
4. Dashboard calls `/api/notify-payment`
5. User receives Telegram notification ✅

### Game Flow:
1. Players join game
2. Admin starts game
3. Players play
4. Someone wins
5. `endGame()` called automatically
6. Winner receives win notification ✅
7. Losers receive loss notification ✅

## 🎯 All Notifications Implemented!

✅ Deposit Approved
✅ Deposit Rejected
✅ Withdrawal Approved
✅ Withdrawal Rejected
✅ Game Win
✅ Game Loss
✅ Game Start (optional)

Users will now receive instant Telegram notifications for all important events! 🎉
