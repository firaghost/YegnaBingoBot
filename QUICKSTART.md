# ⚡ Quick Start Guide

Get Bingo Vault up and running in 10 minutes!

## 🚀 Prerequisites

- [ ] Node.js 18+ installed
- [ ] Telegram account
- [ ] 10 minutes of your time

## 📝 Step-by-Step

### 1. Get Telegram Bot Token (2 minutes)

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`
3. Choose a name: `My Bingo Bot`
4. Choose a username: `myBingoBot` (must end with 'bot')
5. Copy the token (looks like: `1234567890:ABCdef...`)

### 2. Set Up Supabase (3 minutes)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" (sign up if needed)
3. Create new project:
   - Name: `bingo-vault`
   - Password: (choose a strong password)
   - Region: (closest to you)
4. Wait ~2 minutes for setup
5. Go to SQL Editor → New Query
6. Copy contents from `supabase/schema.sql` and run
7. Go to Settings → API and copy:
   - Project URL
   - `anon` key
   - `service_role` key

### 3. Install & Configure (3 minutes)

```bash
# Clone/download the project
cd bingo-vault

# Install dependencies
npm run install-all

# Run setup wizard
npm run setup
```

Follow the prompts and enter:
- Bot token from step 1
- Supabase URL from step 2
- Supabase keys from step 2
- Admin password (choose something secure)

### 4. Test Locally (2 minutes)

```bash
# Terminal 1: Start the bot
npm run bot

# Terminal 2: Start the dashboard
npm run dev
```

**Test the bot:**
1. Open Telegram
2. Search for your bot
3. Send `/start`
4. You should get a welcome message!

**Test the dashboard:**
1. Open http://localhost:3000/login
2. Enter your admin password
3. You should see the dashboard!

## 🎉 You're Done!

Your Bingo Vault is now running locally!

## 🔥 Quick Commands

```bash
npm run bot              # Start bot
npm run dev              # Start dashboard
npm run test-connection  # Test setup
npm run setup            # Run setup wizard
```

## 🎮 Try It Out

### As a User:

1. In Telegram, send to your bot:
   ```
   /start
   /receipt TEST123 100
   /balance
   ```

2. In Dashboard:
   - Go to Payments
   - Approve the TEST123 payment
   - Enter amount: 100

3. Back in Telegram:
   ```
   /balance  (should show 100)
   /play     (join a game)
   ```

### As an Admin:

1. Dashboard → Games
2. Start the game
3. Call numbers
4. Watch the magic happen!

## 🚀 Deploy to Production

When ready to go live:

```bash
# Deploy to Vercel
npm install -g vercel
vercel

# Set webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-app.vercel.app/api/webhook"
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

## 🆘 Troubleshooting

### Bot not responding?
```bash
npm run test-connection
```

### Database errors?
- Check if schema was run in Supabase
- Verify credentials in `.env`

### Dashboard won't load?
- Check if `npm run dev` is running
- Try http://localhost:3000/login

## 📚 Next Steps

- Read [README.md](README.md) for full documentation
- Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment

## 💡 Tips

- Use `/help` in bot to see all commands
- Dashboard updates in real-time
- Test with small amounts first
- Keep your `.env` file secret!

---

**Need help?** Check the full documentation or open an issue!

**Happy Bingo! 🎮**
