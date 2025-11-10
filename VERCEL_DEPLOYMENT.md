# Vercel Deployment Guide

## ✅ Broadcast Fix for Production

### **Problem:**
Broadcast failing with error: "Bad Request: inline keyboard button Web App URL 'http://localhost:3000' is invalid. Only HTTPS links are allowed"

### **Solution:**
The broadcast API now automatically uses the correct URL based on environment:
- **Development**: No web app button (localhost not allowed)
- **Production**: Uses `NEXT_PUBLIC_APP_URL` or Vercel's URL

## 🚀 Environment Variables for Vercel

### **Required Variables:**

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables:

```env
# Telegram Bot
BOT_TOKEN=your_bot_token_from_botfather

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Admin
ADMIN_PASSWORD=your_secure_password
ADMIN_TELEGRAM_ID=your_telegram_user_id

# App URL (IMPORTANT!)
NEXT_PUBLIC_APP_URL=https://yegnagame.vercel.app

# Environment
NODE_ENV=production
```

### **Critical: NEXT_PUBLIC_APP_URL**

This MUST be set to your actual Vercel URL:
- ✅ `https://yegnagame.vercel.app`
- ✅ `https://your-custom-domain.com`
- ❌ `http://localhost:3000` (will fail)
- ❌ Not set (broadcast won't have Play button)

## 📝 Deployment Checklist

### Before Deploying:

1. **Run SQL Migrations in Supabase:**
   ```sql
   -- 1. Fix all issues
   \i supabase/fix_all_issues.sql
   
   -- 2. Add commission system
   \i supabase/add_commission_system.sql
   
   -- 3. Add proof upload
   \i supabase/add_proof_upload.sql
   ```

2. **Create Storage Bucket:**
   - Go to Supabase → Storage
   - Create bucket: `transaction-proofs`
   - Make it Public
   - Set size limit: 5MB

3. **Set Environment Variables in Vercel:**
   - All variables listed above
   - **Double-check NEXT_PUBLIC_APP_URL is HTTPS**

4. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "Fix broadcast and add all features"
   git push
   ```

### After Deploying:

1. **Update Telegram Bot Webhook (if using):**
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://yegnagame.vercel.app/api/webhook
   ```

2. **Test Broadcast:**
   - Go to Admin → Broadcast
   - Send a test message
   - Should see "Sent: X" instead of "Failed: X"
   - Users should receive message with "🎮 Play Now" button

3. **Test Game Flow:**
   - Create/join game
   - Play and win
   - Check commission is deducted
   - Verify winner gets correct amount

## 🐛 Troubleshooting

### Broadcast Still Failing?

**Check Server Logs:**
```bash
vercel logs
```

**Common Issues:**

1. **"chat not found"**
   - User hasn't started the bot
   - Solution: Users must click "Start" on bot first

2. **"Bad Request: invalid URL"**
   - `NEXT_PUBLIC_APP_URL` not set or not HTTPS
   - Solution: Set it in Vercel environment variables

3. **"Sent: 0, Failed: X"**
   - No users have `telegram_id`
   - Solution: Users must register via Telegram bot

### Check Environment Variables:

In Vercel dashboard, verify:
- ✅ All variables are set
- ✅ `NEXT_PUBLIC_APP_URL` starts with `https://`
- ✅ No typos in variable names
- ✅ Redeploy after adding variables

## 🎯 Features Checklist

After deployment, verify these work:

- [ ] User registration via Telegram bot
- [ ] Deposit with proof upload
- [ ] Admin can approve/reject deposits
- [ ] Withdrawal requests
- [ ] Admin can approve/reject withdrawals
- [ ] Game creation and joining
- [ ] Game countdown and number calling
- [ ] Winner declaration
- [ ] Commission deduction
- [ ] Broadcast messages (with Play button)
- [ ] Game history in admin panel
- [ ] All admin pages functional

## 📊 Monitoring

**Check these regularly:**

1. **Vercel Logs** - For errors
2. **Supabase Logs** - For database issues
3. **Telegram Bot Logs** - For bot errors
4. **Admin Dashboard** - For pending requests

All done! Your app should now work perfectly on Vercel! 🚀
