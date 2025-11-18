# 🎮 BingoX Bingo - Telegram Bingo Bot

A complete Telegram-based Bingo game system with auto-game features, real-time monitoring, and separate Super Admin dashboard for 50/50 partnership management.

## 🌟 Features

### For Players (Telegram Mini App)
- 🎯 Register and create account via Telegram
- 💰 Deposit/withdraw money with payment proof
- 🎲 Join Bingo games with automatic card generation
- ⏰ **Auto-countdown when 2+ players join (60 seconds)**
- 🎮 **Auto-start games** - No admin needed!
- 🔢 **Auto-call numbers** every 5 seconds
- 🏆 Win prizes automatically
- 📊 Real-time balance and game status
- ⚠️ Exit warnings for active games

### For Admins (Web Dashboard)
- ✅ Approve/reject payment receipts
- 🎮 Manage games (or let them auto-run)
- 👥 View all users and their balances
- 📈 Dashboard with statistics
- 💵 Track revenue and prize pools
- 📋 Payment management

### For Super Admin (Hidden Dashboard)
- 👑 **Separate authentication** (hidden from regular admin)
- 💰 **Complete financial overview**
- 📊 **Real-time analytics** (auto-refresh every 10s)
- 🔍 **Monitor all admin actions**
- 🏆 **Top players leaderboard**
- 📜 **Complete transaction history**
- 🤝 **50/50 partnership tracking**
- 🔐 **Secure & separate access**

## 🛡️ Race Condition Protection

This system implements robust race condition protection to ensure data integrity:

- **Atomic Game Operations**: All game state changes use database-level locking
- **Single Winner Guarantee**: Only one player can win each game, even under high concurrency
- **Unique Number Calling**: Each Bingo number is called exactly once per game
- **Concurrent Access Safety**: Multiple users can interact with the same game simultaneously without conflicts

### Technical Implementation
- Row-level locking with `FOR UPDATE SKIP LOCKED` for database operations
- Two-phase validation in critical operations (pre-lock check, post-lock verification)
- Atomic database functions for bingo claim resolution
- Time-window based tie-breaking for simultaneous claims

## 🏗️ Tech Stack

- **Bot Framework:** Telegraf.js
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel (Serverless)
- **Admin Panel:** Next.js + React + Tailwind CSS
- **Language:** JavaScript (ES6+)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Supabase account (free tier)
- Vercel account (for deployment)
- GitHub account

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/BingoXBot.git
cd BingoXBot

# Install dependencies for all projects
npm install
cd miniapp && npm install && cd ..
cd dashboard && npm install && cd ..
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run:
   - `supabase/schema.sql` - Database schema
   - `supabase/add_countdown_field.sql` - Auto-game fields
3. Get your credentials from Settings > API

### 3. Deploy to Vercel (Auto-Deploy Setup)

**See detailed guide:** [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md)

**Quick steps:**
1. Push code to GitHub
2. Create 3 Vercel projects from same repo:
   - **Bot API** (root: `./`)
   - **Mini App** (root: `miniapp/`)
   - **Dashboard** (root: `dashboard/`)
3. Set environment variables for each
4. Enable auto-deploy on `main` branch

**After setup, just:**
```
git add .
git commit -m "Your changes"
git push origin main
# ✅ All 3 projects auto-deploy!
```

### 4. Environment Variables

**Bot API:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
TELEGRAM_BOT_TOKEN=your_bot_token
```

**Mini App:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=BingoXBot
```

**Dashboard:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BOT_URL=https://BingoX-bingo-bot.vercel.app
NEXT_PUBLIC_SUPER_ADMIN_USERNAME=superadmin
NEXT_PUBLIC_SUPER_ADMIN_PASSWORD=YourStrongPassword123!
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 📚 Documentation

### Complete Guides
- 📖 [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md) - Auto-deploy with Git push
- 🚀 [`VERCEL_AUTO_DEPLOY.md`](./VERCEL_AUTO_DEPLOY.md) - Detailed Vercel setup
- 🤖 [`AUTO_GAME_SYSTEM.md`](./AUTO_GAME_SYSTEM.md) - Auto-game features
- 👑 [`SUPER_ADMIN_SETUP.md`](./SUPER_ADMIN_SETUP.md) - Super Admin guide
- 👑 [`SUPER_ADMIN_GUIDE.md`](./SUPER_ADMIN_GUIDE.md) - Dashboard features
- 🔔 [`NOTIFICATION_SYSTEM.md`](./NOTIFICATION_SYSTEM.md) - Notifications

### Project Structure
```
BingoXBot/
├── api/                    # Vercel serverless functions
│   ├── webhook.js         # Telegram bot webhook
│   ├── start-game.js      # Auto-start game endpoint
│   ├── check-countdown.js # Countdown trigger
│   └── index.html         # API landing page
├── bot/                   # Bot logic
│   ├── services/          # Game & auto-game services
│   └── utils/             # Utilities
├── miniapp/               # Telegram Mini App (Next.js)
│   ├── pages/             # App pages
│   ├── components/        # React components
│   └── lib/               # Supabase client
├── dashboard/             # Admin Dashboard (Next.js)
│   ├── pages/             # Dashboard pages
│   │   ├── super-admin.js # Super Admin (hidden)
│   │   └── super-login.js # Super Admin login
│   └── components/        # Dashboard components
└── supabase/              # Database schemas
```

## 📖 Usage Guide

### For Players

1. **Start the bot:**
   - Open Telegram and search for your bot
   - Send `/start` to register

2. **Add balance:**
   - Make a payment via your payment method
   - Send receipt: `/receipt REC123456 100`
   - Wait for admin approval

3. **Play Bingo:**
   - Send `/play` to join a game (10 Birr entry fee)
   - Receive your unique Bingo card
   - Wait for numbers to be called
   - First to complete a line wins!

4. **Other commands:**
   - `/balance` - Check your balance
   - `/status` - View current game status
   - `/help` - Show help message

### For Admins

1. **Login:**
   - Go to `https://your-dashboard.vercel.app/login`
   - Enter admin password

2. **Approve Payments:**
   - Navigate to "Payments" page
   - Review pending receipts
   - Enter amount and approve/reject

3. **Manage Games:**
   - Go to "Games" page
   - Start waiting games
   - Call numbers during active games
   - End games when there's a winner

## 🎲 Game Rules

- **Entry Fee:** 10 Birr per game
- **Prize Pool:** Sum of all entry fees
- **Winning Patterns:** Any row, column, or diagonal
- **Winner Takes All:** First player to get BINGO wins entire pool

## 🔧 Configuration

### Game Settings

Edit `bot/services/gameService.js`:
```javascript
const GAME_ENTRY_FEE = 10; // Change entry fee
const MIN_PLAYERS = 2;     // Minimum players to start
```

### Admin Password

## 🎯 Key Features Explained

### Auto-Game System
- **2+ players join** → 60-second countdown starts
- **Countdown ends** → Game auto-starts
- **Numbers auto-called** → Every 5 seconds
- **Winner auto-detected** → Prize awarded instantly
- **No admin needed** → Fully automated!

### Super Admin Dashboard
- **Separate login** → `/super-login` (hidden from regular admin)
- **Financial tracking** → Monitor all money flows
- **50/50 partnership** → Track revenue split
- **Admin audit log** → See all admin actions
- **Real-time updates** → Auto-refresh every 10s

### Money Deduction
- **Join game** → Money NOT deducted (reserved)
- **Game starts** → Money deducted from all players
- **Insufficient balance** → Player removed automatically
- **Exit warnings** → Players warned before leaving active games

## 🛡️ Security & Partnership

### Two-Level Access
1. **Regular Admin** (Your Partner)
   - Manages day-to-day operations
   - Approves payments
   - Can start games manually
   - Cannot see Super Admin

2. **Super Admin** (You - System Owner)
   - Complete financial oversight
   - Monitor all admin actions
   - Track 50/50 revenue split
   - Hidden from regular admin

### Security Features
- ✅ Separate authentication systems
- ✅ Different session tokens
- ✅ No cross-access
- ✅ Audit logging
- ✅ Environment-based credentials

## 🚀 Deployment Workflow

### One-Time Setup
```bash
# 1. Push to GitHub
git push origin main

# 2. Create 3 Vercel projects (see QUICK_DEPLOY.md)
# 3. Set environment variables
# 4. Enable auto-deploy
```

### Daily Workflow
```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main

# ✅ All 3 projects auto-deploy!
# No manual commands needed!
```

## 📊 Revenue Model

### Commission Structure
- **Game Entry Fee**: 5, 7, 10, 20, 50, or 100 Birr
- **Prize Pool**: Sum of all entry fees
- **Commission**: 10% of prize pool
- **Player Prize**: 90% of prize pool

### Partnership Split
- **Total Commission**: 10% from each game
- **Your Share**: 50% of commission (5% of prize pool)
- **Partner Share**: 50% of commission (5% of prize pool)

**Example:**
- 10 players × 10 Birr = 100 Birr prize pool
- Commission: 10 Birr (10%)
- Your share: 5 Birr
- Partner share: 5 Birr
- Winner gets: 90 Birr

## 🐛 Troubleshooting

### Deployment Issues
- See [`VERCEL_AUTO_DEPLOY.md`](./VERCEL_AUTO_DEPLOY.md)
- Check Vercel dashboard for build logs
- Verify environment variables are set

### Auto-Game Not Starting
- Check `countdown_end` field exists in database
- Run `supabase/add_countdown_field.sql`
- Verify `/api/check-countdown` endpoint works

### Super Admin Access Denied
- Check environment variables:
  - `NEXT_PUBLIC_SUPER_ADMIN_USERNAME`
  - `NEXT_PUBLIC_SUPER_ADMIN_PASSWORD`
- Clear browser cache
- Try incognito mode

## 📝 License

MIT License - Use for your projects!

## 🤝 Support

For issues:
- Check documentation files
- Review Vercel logs
- Test locally first

---

**Built for 50/50 Partnership Success** 🤝💰

**Auto-Deploy Ready** 🚀 **Just Git Push!**
