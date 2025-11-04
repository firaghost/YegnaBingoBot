# 🚀 Complete Setup Guide - Bingo Vault

This guide will walk you through setting up the entire Bingo Vault system from scratch.

## 📋 Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Telegram account
- [ ] Supabase account (free)
- [ ] Vercel account (free, optional)

## Step 1: Create Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow prompts to name your bot
4. Save the **Bot Token** (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

**Important Commands:**
```
/setdescription - Set bot description
/setabouttext - Set about text
/setuserpic - Upload bot profile picture
```

## Step 2: Set Up Supabase Database

### 2.1 Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name:** bingo-vault
   - **Database Password:** (save this!)
   - **Region:** Choose closest to your users
4. Wait for project to be created (~2 minutes)

### 2.2 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy entire contents of `supabase/schema.sql`
4. Paste and click "Run"
5. Verify tables created: Go to **Table Editor**

You should see:
- ✅ users
- ✅ payments
- ✅ games
- ✅ game_players

### 2.3 Get API Credentials

1. Go to **Settings** > **API**
2. Copy these values:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...` (long string)
   - **service_role key:** `eyJhbGc...` (different long string)

⚠️ **Keep service_role key secret!**

## Step 3: Configure Environment Variables

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` with your values:
```env
# From BotFather
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# From Supabase Settings > API
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...your-service-role-key...

# Choose a secure password
ADMIN_PASSWORD=YourSecurePassword123

# Same as above (for Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
```

## Step 4: Install Dependencies

```bash
# Install root dependencies
npm install

# Install dashboard dependencies
cd dashboard
npm install
cd ..
```

## Step 5: Test Locally

### 5.1 Test the Bot

```bash
# Start bot in development mode
npm run bot
```

You should see:
```
🤖 Starting Bingo Vault Bot...
✅ Bot started in polling mode
```

**Test in Telegram:**
1. Open your bot in Telegram
2. Send `/start`
3. You should get a welcome message

### 5.2 Test the Dashboard

```bash
# In a new terminal
npm run dev
```

Open browser to `http://localhost:3000/login`

**Login with:**
- Password: The one you set in `.env`

## Step 6: Deploy to Production

### 6.1 Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

Follow prompts:
- **Set up and deploy?** Yes
- **Which scope?** Your account
- **Link to existing project?** No
- **Project name?** bingo-vault
- **Directory?** ./
- **Override settings?** No

4. Add environment variables in Vercel:
   - Go to your project on vercel.com
   - Settings > Environment Variables
   - Add all variables from `.env`

### 6.2 Set Telegram Webhook

After deployment, set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-project.vercel.app/api/webhook"}'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your actual token
- `your-project.vercel.app` with your Vercel URL

**Verify webhook:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 6.3 Deploy Dashboard

```bash
cd dashboard
vercel
```

Your dashboard will be at: `https://your-dashboard.vercel.app`

## Step 7: Configure Payment Method

### Option A: Manual Bank Transfer

1. Users send money to your bank account
2. They submit receipt number via bot
3. You verify in admin dashboard
4. Approve to add balance

### Option B: Mobile Money (e.g., M-Pesa, Telebirr)

1. Set up business account
2. Users send money and get receipt
3. Submit receipt number to bot
4. Verify and approve in dashboard

## Step 8: Test End-to-End

### Test User Flow:

1. **Register:**
   - Send `/start` to bot
   - Verify user created in Supabase

2. **Submit Payment:**
   - Send `/receipt TEST123 100`
   - Check dashboard > Payments
   - Approve payment
   - User balance should update

3. **Play Game:**
   - Send `/play` (need 10 Birr balance)
   - Verify game created
   - Check dashboard > Games

4. **Admin Controls:**
   - Start game from dashboard
   - Call numbers
   - End game

## 🎯 Quick Start Commands

```bash
# Development
npm run bot          # Start bot locally
npm run dev          # Start dashboard locally

# Production
vercel              # Deploy to Vercel
vercel --prod       # Deploy to production
```

## 🔧 Customization

### Change Entry Fee

Edit `bot/services/gameService.js`:
```javascript
const GAME_ENTRY_FEE = 20; // Change from 10 to 20
```

### Change Minimum Players

Edit `bot/commands/play.js`:
```javascript
const MIN_PLAYERS = 5; // Change from 2 to 5
```

### Customize Bot Messages

Edit files in `bot/commands/` to change messages.

### Customize Dashboard Theme

Edit `dashboard/tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
      secondary: '#your-color',
    },
  },
}
```

## 🐛 Common Issues

### Bot not responding
**Problem:** Bot doesn't reply to messages

**Solutions:**
1. Check BOT_TOKEN is correct
2. Verify webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Check Vercel logs: `vercel logs`
4. Ensure environment variables are set in Vercel

### Database connection error
**Problem:** "Missing Supabase credentials"

**Solutions:**
1. Verify `.env` file exists
2. Check SUPABASE_URL and SUPABASE_KEY are correct
3. Restart the bot/server
4. Check Supabase project is active

### Dashboard login fails
**Problem:** "Invalid password"

**Solutions:**
1. Check ADMIN_PASSWORD in `.env`
2. Clear browser cache
3. Try different browser
4. Check browser console for errors

### Payment approval not working
**Problem:** Balance doesn't update after approval

**Solutions:**
1. Check Supabase RLS policies
2. Verify service_role key is used (not anon key)
3. Check browser console for errors
4. Verify user_id matches in payments table

## 📊 Monitoring

### Check Bot Status
```bash
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

### Check Webhook
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### View Vercel Logs
```bash
vercel logs
```

### Monitor Supabase
- Go to Supabase Dashboard
- Check "Database" > "Tables" for data
- Check "Logs" for errors

## 🔐 Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Admin password is strong
- [ ] Supabase service_role key is secret
- [ ] Webhook uses HTTPS
- [ ] RLS policies are enabled
- [ ] Regular backups of database

## 📈 Scaling Tips

### For More Users:
1. Upgrade Supabase plan if needed
2. Add database indexes
3. Implement caching
4. Use Vercel Pro for better performance

### For Multiple Games:
1. Implement game scheduling
2. Add game categories
3. Create tournament mode
4. Add leaderboards

## 🎉 You're Done!

Your Bingo Vault system is now live!

**Next Steps:**
1. Promote your bot to users
2. Monitor the dashboard regularly
3. Process payments promptly
4. Engage with your community

**Need Help?**
- Check README.md for more info
- Review code comments
- Open an issue on GitHub

Good luck with your Bingo game! 🍀
