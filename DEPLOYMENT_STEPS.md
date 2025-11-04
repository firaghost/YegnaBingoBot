# 🚀 Deployment Steps - Bingo Vault

## 📋 Overview

You need **TWO separate deployments**:

1. **Bot Webhook** (root directory) → For Telegram bot
2. **Admin Dashboard** (dashboard directory) → For admin panel

---

## 🤖 Step 1: Deploy Bot Webhook

### From Root Directory

```bash
# Make sure you're in the root directory
cd d:/Projects/YegnaBingoBot

# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (will prompt for env vars)
vercel
```

### Add These Environment Variables:

When Vercel asks, add:

```
BOT_TOKEN=7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
```

### Deploy to Production:

```bash
vercel --prod
```

**Save the URL!** It will be something like: `https://bingo-vault.vercel.app`

---

## 🎨 Step 2: Deploy Admin Dashboard

### From Dashboard Directory

```bash
# Navigate to dashboard folder
cd dashboard

# Deploy dashboard
vercel
```

### Add These Environment Variables:

When Vercel asks, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ADMIN_PASSWORD=your_chosen_password
```

### Deploy to Production:

```bash
vercel --prod
```

**Save the URL!** It will be something like: `https://bingo-vault-dashboard.vercel.app`

---

## 🔗 Step 3: Set Telegram Webhook

Use the **bot webhook URL** from Step 1:

```bash
curl -X POST "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR-BOT-URL.vercel.app/api/webhook"}'
```

Replace `YOUR-BOT-URL` with your actual bot deployment URL.

### Verify Webhook:

```bash
curl "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/getWebhookInfo"
```

---

## 🗄️ Step 4: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to **SQL Editor**
4. Copy contents from `supabase/schema.sql`
5. Run the SQL
6. Go to **Settings → API** and get:
   - Project URL
   - `anon` key
   - `service_role` key

---

## ✅ Quick Deployment Commands

### Bot Webhook:
```bash
cd d:/Projects/YegnaBingoBot
vercel --prod
```

### Dashboard:
```bash
cd d:/Projects/YegnaBingoBot/dashboard
vercel --prod
```

---

## 🔐 Environment Variables Summary

### Bot Webhook (Root):
- `BOT_TOKEN` - Your Telegram bot token
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase service role key

### Dashboard (dashboard/):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `ADMIN_PASSWORD` - Your admin password

---

## 🧪 Testing

### Test Bot:
1. Open Telegram
2. Search for your bot
3. Send `/start`
4. Should get welcome message

### Test Dashboard:
1. Go to your dashboard URL
2. Login with admin password
3. Should see dashboard

---

## 🆘 Troubleshooting

### Bot not responding?
- Check webhook is set correctly
- Check Vercel logs: `vercel logs`
- Verify environment variables in Vercel dashboard

### Dashboard not loading?
- Check if all env vars are set
- Check browser console for errors
- Verify Supabase credentials

### Database errors?
- Make sure schema.sql was run in Supabase
- Check if service_role key is correct
- Verify project is active

---

## 📞 Need Help?

Check the full [DEPLOYMENT.md](DEPLOYMENT.md) guide for detailed instructions.
