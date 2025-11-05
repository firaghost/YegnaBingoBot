# 🤖 Deploy Standalone Bot Project

## What Changed:
- Created `bot/` as a standalone Vercel project
- Added `bot/api/webhook.js` (webhook handler)
- Added `bot/package.json` (dependencies)
- Added `bot/vercel.json` (Vercel config)

## 🚀 Deploy Steps

### 1. Commit Changes
```bash
git add .
git commit -m "Add standalone bot deployment"
git push origin main
```

### 2. Deploy Bot to Vercel
```bash
cd bot
vercel --prod
```

### 3. Answer Prompts:
```
? Set up and deploy "~/YegnaBingoBot/bot"? Y
? Which scope? [Your account]
? Link to existing project? N
? What's your project's name? yegna-bingo-bot
? In which directory is your code located? ./
? Want to override the settings? N
```

### 4. Add Environment Variables

Go to Vercel Dashboard → yegna-bingo-bot → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | `7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw` |
| `SUPABASE_URL` | `https://mrayxghardqswonihwjs.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (service key) |
| `MINI_APP_URL` | `https://miniapo.vercel.app` |
| `NODE_ENV` | `production` |

### 5. Redeploy
After adding env vars:
- Go to Deployments
- Click Redeploy

### 6. Set Telegram Webhook

Replace `YOUR_VERCEL_URL` with your actual deployment URL:

```
https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setWebhook?url=https://yegna-bingo-bot.vercel.app/webhook
```

### 7. Test Bot
Send `/start` to your bot in Telegram!

## 📊 Final Project Structure

You now have **4 Vercel projects**:

1. **miniapp** (Root: `miniapp/`)
2. **yegnabingo** (Root: `dashboard/`)
3. **yegna-bingo-bot-api** (Root: `api/`)
4. **yegna-bingo-bot** (Root: `bot/`) ← NEW!

## 🔧 Configure Ignored Build Step

For the new bot project:

**Settings → Git → Ignored Build Step → Custom:**
```bash
git diff HEAD^ HEAD --quiet -- bot/ || exit 1
```

## ✅ Verify Everything Works

1. **Bot responds** to `/start`
2. **Mini App** opens from bot
3. **Dashboard** accessible
4. **API** endpoints working

---

**Status**: Ready to deploy standalone bot! 🚀
