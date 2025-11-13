# 🤖 Telegram Bot Setup Guide

## Quick Setup Steps

### 1. Add Commands to BotFather

1. Open Telegram and search for **@BotFather**
2. Send `/setcommands` or use `/mybots` → Select your bot → Edit Bot → Edit Commands
3. Copy and paste the commands from `BOTFATHER_COMMANDS.txt`:

```
start - Register & get 1000 ETB bonus
play - Join a game room
rooms - View all available rooms
balance - Check your balance
account - View your profile
stats - View detailed statistics
history - View game & transaction history
deposit - Add funds to your account
withdraw - Withdraw your winnings
leaderboard - View top players
help - Show help & commands
```

### 2. Enable Inline Mode (Optional but Recommended)

1. Go to @BotFather
2. Send `/mybots`
3. Select your bot
4. Go to **Bot Settings** → **Inline Mode**
5. Turn it **ON**
6. Set inline placeholder: `Search games, balance, help...`

### 3. Set Bot Description

1. Go to @BotFather
2. Send `/mybots`
3. Select your bot
4. Go to **Edit Bot** → **Edit Description**
5. Paste:

```
🎰 BingoX - Win Real Prizes!

Play exciting bingo games and win ETB prizes!

✨ Features:
• 1000 ETB starting bonus
• Multiple game rooms
• Real-time gameplay
• Leaderboard rankings
• Easy deposit & withdrawal

Start playing now with /start
```

### 4. Set Bot About Text

1. Go to @BotFather
2. Send `/mybots`
3. Select your bot
4. Go to **Edit Bot** → **Edit About**
5. Paste:

```
🎰 Play BingoX and win real ETB prizes! Get 1000 ETB bonus on signup.
```

### 5. Set Bot Profile Picture (Optional)

Upload a nice bingo-themed image as your bot's profile picture.

---

## 🎮 Bot Features Overview

### User Registration
- **Command:** `/start`
- **New Users:** Get 1000 ETB starting bonus
- **Returning Users:** See their current balance and stats
- Auto-creates user in database with Telegram ID

### Game Commands
- **`/play`** - Browse and join available game rooms
- **`/rooms`** - View all game rooms with details (stake, players, prize pool)

### Account Commands
- **`/balance`** - Check balance, games played, games won, win rate
- **`/account`** - View complete profile via web app
- **`/stats`** - View detailed statistics
- **`/history`** - View game and transaction history

### Money Commands
- **`/deposit`** - Add funds to account (opens web app)
- **`/withdraw`** - Withdraw winnings (minimum 100 ETB)

### Info Commands
- **`/leaderboard`** - View top 10 players with rankings
- **`/help`** - Show all commands and how to play

### Inline Mode
Type `@YourBotUsername` in any chat to:
- Search game rooms
- Check your balance
- View leaderboard
- Get help

---

## 🔧 Implementation Details

### Database Integration
The bot connects to Supabase and uses these tables:
- `users` - User accounts with balance and stats
- `rooms` - Game rooms configuration
- `games` - Active and completed games
- `player_cards` - Player bingo cards
- `transactions` - Deposit/withdrawal history

### Starting Balance
- New users get **1000 ETB** automatically
- Configured in `supabase/setup.sql` (line 32)
- Can be changed by updating the default value

### Room Types
1. **Classic Room** 🎯 - 10 ETB stake, 500 max players
2. **Speed Bingo** ⚡ - 5 ETB stake, 200 max players
3. **Mega Jackpot** 💎 - 50 ETB stake, 1000 max players

### Web App Integration
All game features are accessible via Telegram Mini App:
- Seamless authentication using Telegram ID
- No password required
- Full game interface in web app
- Direct links from bot commands

---

## 🚀 Running the Bot

### Development
```bash
npm run bot
```

### Production
```bash
npm start
```

### With Next.js Server
```bash
npm run dev  # Starts both server and bot
```

---

## ✅ Checklist

- [ ] Add commands to BotFather using `/setcommands`
- [ ] Enable inline mode
- [ ] Set bot description
- [ ] Set bot about text
- [ ] Upload profile picture (optional)
- [ ] Test `/start` command
- [ ] Test inline mode by typing `@YourBotUsername`
- [ ] Verify database connection
- [ ] Test deposit/withdraw flows
- [ ] Check leaderboard display

---

## 📞 Support

For issues or questions:
- Update support username in bot code (line 391 in `telegram-bot.ts`)
- Monitor bot logs for errors
- Check Supabase connection and RLS policies

---

## 🎉 You're All Set!

Your bot is now ready to accept users and start games!

**Next Steps:**
1. Share your bot link with users
2. Monitor the dashboard at `/admin`
3. Send broadcasts to users
4. Track game statistics
