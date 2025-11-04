# 🎮 Bingo Vault - Telegram Bingo Bot

A complete Telegram-based Bingo game system with Supabase backend and Next.js admin dashboard.

## 🌟 Features

### For Players (Telegram Bot)
- 🎯 Register and create account via `/start`
- 💰 Submit payment receipts for balance top-up
- 🎲 Join Bingo games with automatic card generation
- 🏆 Win prizes from the prize pool
- 📊 Check balance and game status

### For Admins (Web Dashboard)
- ✅ Approve/reject payment receipts
- 🎮 Manage game rounds (start, call numbers, end)
- 👥 View all users and their balances
- 📈 Dashboard with statistics
- 💵 Track revenue and prize pools

## 🏗️ Tech Stack

- **Bot Framework:** Telegraf.js
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel (Serverless)
- **Admin Panel:** Next.js + React + Tailwind CSS
- **Language:** JavaScript (ES6+)

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Supabase account (free tier)
- Vercel account (optional, for deployment)

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd bingo-vault

# Install root dependencies
npm install

# Install dashboard dependencies
cd dashboard
npm install
cd ..
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema:
   ```bash
   # Copy contents from supabase/schema.sql and execute
   ```
3. Get your credentials:
   - Project URL: `https://your-project.supabase.co`
   - Anon/Public Key: From Settings > API

### 3. Configure Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
```

Required variables:
```env
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run Locally

#### Start the Bot (Development)
```bash
npm run bot
```

#### Start the Dashboard
```bash
npm run dev
# Dashboard will be at http://localhost:3000
```

## 🚀 Deployment

### Deploy Bot to Vercel

1. Create `api/webhook.js` for Vercel serverless:

```javascript
import bot from '../bot/index.js';

export default async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

2. Deploy to Vercel:
```bash
vercel
```

3. Set webhook URL:
```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-vercel-app.vercel.app/api/webhook"}'
```

### Deploy Dashboard to Vercel

```bash
cd dashboard
vercel
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

Set in `.env`:
```env
ADMIN_PASSWORD=your_secure_password
```

## 📁 Project Structure

```
bingo-vault/
├── bot/                    # Telegram bot
│   ├── commands/          # Bot commands
│   ├── services/          # Business logic
│   └── utils/             # Helper functions
├── dashboard/             # Admin web dashboard
│   ├── pages/            # Next.js pages
│   ├── components/       # React components
│   └── lib/              # Utilities
├── supabase/             # Database schema
└── api/                  # Vercel serverless functions
```

## 🛡️ Security Notes

- Never commit `.env` file
- Use Supabase Row Level Security (RLS)
- Keep admin password secure
- Use HTTPS for webhooks
- Validate all user inputs

## 🐛 Troubleshooting

### Bot not responding
- Check BOT_TOKEN is correct
- Verify webhook is set properly
- Check Vercel logs for errors

### Database errors
- Verify Supabase credentials
- Check if schema is properly created
- Ensure RLS policies are set

### Dashboard not loading
- Check NEXT_PUBLIC_* variables
- Clear browser cache
- Check browser console for errors

## 📝 License

MIT License - feel free to use for your projects!

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Contact: your-email@example.com

---

**Built with ❤️ for the Bingo community**
