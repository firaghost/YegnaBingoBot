# Quick Start Guide

## 🚀 Get Your Bot Running in 5 Minutes

### Step 1: Configure Environment Variables

Create a `.env` file in the `bot` directory:

```env
# Required
BOT_TOKEN=7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw
SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# Admin (Get your ID from @userinfobot on Telegram)
ADMIN_TELEGRAM_IDS=your_telegram_user_id

# Production
WEBHOOK_URL=https://yegna-bingo-bot.vercel.app/api/webhook
NODE_ENV=production
```

### Step 2: Set Webhook

Visit this URL in your browser:
```
https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setWebhook?url=https://yegna-bingo-bot.vercel.app/api/webhook
```

You should see:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### Step 3: Set Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your `yegna-bingo-bot` project
3. Go to Settings → Environment Variables
4. Add these variables:

| Variable | Value |
|----------|-------|
| `BOT_TOKEN` | `7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw` |
| `SUPABASE_URL` | `https://mrayxghardqswonihwjs.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Your Supabase service key |
| `ADMIN_TELEGRAM_IDS` | Your Telegram user ID |
| `WEBHOOK_URL` | `https://yegna-bingo-bot.vercel.app/api/webhook` |

5. Click "Save"
6. Go to Deployments → Click on latest → Click "Redeploy"

### Step 4: Get Your Admin Telegram ID

1. Open Telegram
2. Search for `@userinfobot`
3. Send `/start`
4. Copy your user ID
5. Add it to `ADMIN_TELEGRAM_IDS` in Vercel

### Step 5: Test the Bot

1. Open your bot on Telegram
2. Send `/start` - Should show welcome message
3. Send `/deposit` - Should show deposit instructions
4. Send `/admin` - Should show admin panel (if you're an admin)

## ✅ Verification Checklist

- [ ] Bot responds to `/start`
- [ ] Bot responds to `/deposit`
- [ ] Bot responds to `/withdraw`
- [ ] Admin panel opens with `/admin`
- [ ] Webhook is set (check at `/api/bot-status`)

## 🔧 Troubleshooting

### Bot not responding?

1. **Check webhook status:**
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
   ```
   Should show your Vercel URL

2. **Check Vercel logs:**
   - Go to Vercel Dashboard
   - Click on your project
   - Go to Deployments
   - Click on latest deployment
   - Click "View Function Logs"

3. **Check environment variables:**
   Visit: `https://yegna-bingo-bot.vercel.app/api/bot-status`

### Deposit not working?

**Error:** "❌ An error occurred. Please try again later."

**Fix:** Add `SUPABASE_SERVICE_KEY` to Vercel environment variables and redeploy.

### Admin panel not working?

**Error:** "❌ Unauthorized"

**Fix:** 
1. Get your Telegram ID from @userinfobot
2. Add it to `ADMIN_TELEGRAM_IDS` in Vercel
3. Redeploy

## 📚 Next Steps

1. **Read the Admin Guide:** See `ADMIN_GUIDE.md` for complete admin features
2. **Configure payment details:** Update payment info in `paymentHandler.js`
3. **Test deposits/withdrawals:** Make test transactions
4. **Set up notifications:** Configure admin notifications

## 🎯 Common Tasks

### Send a broadcast message
```
/broadcast 🎉 Welcome to Yegna Bingo! Get 5 Birr bonus on signup!
```

### Approve a deposit
1. `/admin`
2. Click "💰 Pending Deposits"
3. Click "✅ Approve #1"

### Check statistics
1. `/admin`
2. Click "📊 Statistics"

## 🆘 Need Help?

1. Check the logs in Vercel
2. Verify all environment variables are set
3. Make sure webhook is configured
4. Test with `/start` command first
