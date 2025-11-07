# Webhook Setup Guide

## Problem
The bot commands are not working because the Telegram webhook is not properly configured to point to your Vercel deployment.

## Solution

### Step 1: Set Environment Variables in Vercel

Make sure these environment variables are set in your Vercel project:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add/verify these variables:
   - `BOT_TOKEN` - Your Telegram bot token from @BotFather
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Your Supabase service role key
   - `ADMIN_TELEGRAM_IDS` - Comma-separated admin Telegram user IDs (get from @userinfobot)
   - `MINI_APP_URL` - Your mini app URL (optional)
   - `WEBHOOK_URL` - Your webhook URL (e.g., `https://your-bot.vercel.app/api/webhook`)

### Step 2: Setup Webhook

After deploying to Vercel, run the webhook setup script:

```bash
cd bot
npm run setup-webhook
```

Or manually set the webhook using curl:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-bot.vercel.app/api/webhook",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

### Step 3: Verify Webhook

Check if the webhook is properly set:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Or visit: `https://your-bot.vercel.app/api/bot-status`

### Step 4: Test the Bot

Send `/start` to your bot on Telegram. It should respond immediately.

## Troubleshooting

### Commands still not working?

1. **Check Vercel logs**: Go to your Vercel dashboard → Deployments → Click on latest deployment → View Function Logs

2. **Verify webhook is set**: 
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```
   
   Should show:
   - `url`: Your Vercel webhook URL
   - `has_custom_certificate`: false
   - `pending_update_count`: 0
   - `last_error_date`: should be empty

3. **Test webhook endpoint directly**:
   ```bash
   curl "https://your-bot.vercel.app/api/webhook"
   ```
   
   Should return: `{"status":"Bot is running"}`

4. **Check bot status**:
   Visit: `https://your-bot.vercel.app/api/bot-status`

### Common Issues

1. **BOT_TOKEN not set in Vercel**: Add it in environment variables and redeploy
2. **Webhook URL is wrong**: Make sure it points to `/api/webhook` on your Vercel domain
3. **Old webhook still active**: Run the setup script to delete and recreate
4. **Pending updates blocking**: The setup script drops pending updates automatically

## Important Notes

- The bot uses **webhook mode** in production (Vercel)
- The bot uses **polling mode** in development (local)
- Never run both modes simultaneously
- After changing environment variables in Vercel, you must redeploy
