# 🤖 Telegram Bot Commands - Bingo Royale

## 📋 **Complete Command List**

### **User Commands**

| Command | Description | Action |
|---------|-------------|--------|
 /start | Start the bot and register 
 /play | Join a game 
 /balance | Check your balance 
 /deposit | Deposit funds 
 /withdraw | Withdraw winnings 
 /account | View profile 
 /leaderboard | View top players 
 /rooms | View available rooms 
 /help | Show help message 

---

## 🎮 **Bot Features**

### **1. User Registration**
- Automatically creates user in Supabase on `/start`
- Stores Telegram ID and username
- Sets initial balance to 0 ETB

### **2. Balance Management**
- Real-time balance checking
- Shows games played and won
- Calculates win rate percentage
- Links to deposit/withdraw pages

### **3. Game Rooms**
- Fetches active rooms from Supabase
- Shows entry fee and player count
- Dynamic emoji based on stake amount:
  - 🎯 Low stake (≤10 ETB)
  - ⚡ Medium stake (≤50 ETB)
  - 💎 High stake (>50 ETB)

### **4. Leaderboard**
- Shows top 10 players
- Displays medals (🥇🥈🥉)
- Shows total winnings and wins
- Links to full leaderboard page

### **5. Deposit & Withdrawal**
- Direct links to mini app pages
- Validates minimum withdrawal (100 ETB)
- Shows available balance

### **6. Web App Integration**
- All buttons open Telegram Mini App
- Seamless navigation
- Full game interface in web app

---

## 🔧 **Setup Instructions**

### **1. Environment Variables**
Make sure your `.env` file has:
```env
BOT_TOKEN=7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw
MINI_APP_URL=https://your-domain.vercel.app
SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co
SUPABASE_KEY=your_supabase_key
```

### **2. Start the Bot**
```bash
npm run bot
```

### **3. Test Commands**
Open Telegram and send `/start` to your bot

---

## 📊 **Database Integration**

The bot interacts with these Supabase tables:

| Table | Purpose |
|-------|---------|
| `users` | User registration and balance |
| `rooms` | Available game rooms |
| `leaderboard` | Top players ranking |
| `games` | Active and completed games |
| `transactions` | Deposit/withdrawal history |

---

## 🎯 **Callback Actions**

The bot handles these inline button callbacks:

| Action | Trigger | Response |
|--------|---------|----------|
| `balance` | Balance button | Shows current balance |
| `leaderboard` | Leaderboard button | Opens leaderboard web app |
| `help` | Help button | Shows help message |

---

## 🚀 **Running the Bot**

### **Development**
```bash
npm run bot
```

### **Production**
```bash
npm start
```

### **With Main Server**
The bot runs alongside the Next.js server:
```bash
npm run dev  # Starts both server and bot
```

---

## 📝 **Bot Responses**

### **Welcome Message** (`/start`)
```
🎰 Welcome to Bingo Royale!

Hello [username]! 👋

Get ready for exciting bingo games with real prizes!

✨ Features:
💰 Win ETB prizes
🎮 Multiple game rooms
⚡ Real-time gameplay
🏆 Leaderboard rankings
💸 Easy deposit & withdrawal

Tap the button below to start playing!
```

### **Balance Message** (`/balance`)
```
💰 Your Account

Balance: 1,250 ETB
Games Played: 45
Games Won: 12
Win Rate: 26.7%
```

### **Game Rooms** (`/rooms`)
```
🎮 Available Game Rooms:

🎯 Classic Bingo
   Entry: 10 ETB
   Max Players: 50
   Current: 23 players

⚡ Speed Bingo
   Entry: 25 ETB
   Max Players: 30
   Current: 15 players

💎 Mega Jackpot
   Entry: 100 ETB
   Max Players: 100
   Current: 67 players
```

---

## 🔐 **Security**

- All user data stored in Supabase
- Telegram ID used for authentication
- No passwords required
- Secure API calls

---

## 📞 **Support**

For bot issues or questions:
- Update support username in `/help` command
- Monitor bot logs for errors
- Check Supabase connection

---

## ✅ **Bot Status**

- ✅ User registration
- ✅ Balance checking
- ✅ Game room listing
- ✅ Leaderboard display
- ✅ Deposit/withdrawal links
- ✅ Web app integration
- ✅ Error handling
- ✅ Supabase integration

**All features are fully functional and connected to Supabase!** 🎉
