# 🌐 Make Bot Always Online

## ✅ What Changed

### 1. **New User Welcome Bonus: 5 Birr** 🎁
- Every new user gets 5 Birr automatically
- Can play immediately without depositing
- Status set to "active" automatically

### 2. **Username Required** 📝
- Users must have a Telegram username to register
- Bot will guide them to set one if missing
- Ensures proper user identification

### 3. **Bot Always Online** 🚀
- No need to run `npm run bot` locally
- Bot runs 24/7 on Vercel serverless
- Responds instantly to all messages

---

## 🚀 Deploy Bot to Be Always Online

### Step 1: Deploy Bot to Vercel

```bash
# From root directory
cd d:/Projects/YegnaBingoBot

# Login to Vercel
vercel login

# Deploy
vercel
```

**Add these environment variables when prompted:**

```
BOT_TOKEN=7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw

SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co

SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yYXl4Z2hhcmRxc3dvbmlod2pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI0MDAyMywiZXhwIjoyMDc3ODE2MDIzfQ.Jwhc0KsaX5Pr5XAGuPE0GF11hoNZGS6ah__UaiuBIbc
```

**Deploy to production:**
```bash
vercel --prod
```

**Save your deployment URL!** (e.g., `https://yegna-bingo-bot.vercel.app`)

---

### Step 2: Set Telegram Webhook

Replace `YOUR-DEPLOYMENT-URL` with your actual Vercel URL:

```bash
curl -X POST "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://YOUR-DEPLOYMENT-URL.vercel.app/api/webhook\"}"
```

**Example:**
```bash
curl -X POST "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://yegna-bingo-bot.vercel.app/api/webhook\"}"
```

---

### Step 3: Verify Webhook is Set

```bash
curl "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/getWebhookInfo"
```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://yegna-bingo-bot.vercel.app/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40
  }
}
```

---

### Step 4: Test the Bot

1. Open Telegram
2. Search for your bot
3. Send `/start`
4. You should get instant response with 5 Birr bonus!

---

## 🎉 Bot is Now Always Online!

### What This Means:

✅ **No need to run locally** - Bot runs on Vercel 24/7
✅ **Instant responses** - Serverless functions respond immediately
✅ **Free hosting** - Vercel free tier is more than enough
✅ **Auto-scaling** - Handles any number of users
✅ **Always available** - Never goes offline

---

## 📊 New User Experience

**Before:**
```
User: /start
Bot: Welcome! Balance: 0 Birr
     Please deposit to play.
```

**After:**
```
User: /start
Bot: 🎉 Welcome to Bingo Vault, @username!
     ✅ Your account has been created!
     🎁 Welcome Bonus: 5 Birr
     💰 Current Balance: 5 Birr
     
     🎮 You can now play Bingo!
     • Use /play to join a game (10 Birr per game)
```

---

## 🔧 Customizing the Bonus

To change the starting bonus, edit `bot/commands/start.js`:

```javascript
const STARTING_BONUS = 5; // Change this number
```

Then redeploy:
```bash
vercel --prod
```

---

## 🆘 Troubleshooting

### Bot not responding?

**Check webhook status:**
```bash
curl "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/getWebhookInfo"
```

**Check Vercel logs:**
```bash
vercel logs --follow
```

**Verify environment variables:**
- Go to Vercel Dashboard
- Project Settings → Environment Variables
- Make sure all are set

### Webhook not working?

**Delete and reset:**
```bash
# Delete webhook
curl -X POST "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/deleteWebhook"

# Set again
curl -X POST "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://YOUR-URL.vercel.app/api/webhook\"}"
```

---

## 📝 Summary

1. ✅ Deploy bot to Vercel
2. ✅ Set webhook URL
3. ✅ Bot is now 24/7 online
4. ✅ New users get 5 Birr bonus
5. ✅ Users must have Telegram username

**You never need to run `npm run bot` again!** 🎉
