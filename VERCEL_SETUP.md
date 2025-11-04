# 🚀 Vercel Multi-Project Setup Guide

## Problem
You have 3 separate apps in one repository:
- **Root** - Bot API endpoints
- **miniapp** - Mini app (Next.js)
- **dashboard** - Admin dashboard (Next.js)

When deploying from GitHub, Vercel needs to know which directory to deploy.

## Solution: Create 3 Separate Vercel Projects

### **Project 1: Bot API** (Root)
**URL:** `https://yegna-bingo-bot.vercel.app`

1. Go to Vercel Dashboard
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Project Name:** `yegna-bingo-bot`
   - **Framework Preset:** Other
   - **Root Directory:** `./` (leave empty)
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)

5. Environment Variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_key
   TELEGRAM_BOT_TOKEN=your_bot_token
   ```

6. Deploy!

---

### **Project 2: Mini App**
**URL:** `https://yegna-bingo-miniapp.vercel.app`

1. Go to Vercel Dashboard
2. Click "Add New Project"
3. Import the **SAME** GitHub repository
4. Configure:
   - **Project Name:** `yegna-bingo-miniapp`
   - **Framework Preset:** Next.js
   - **Root Directory:** `miniapp` ⚠️ **Important!**
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

5. Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YegnaBingoBot
   ```

6. Deploy!

---

### **Project 3: Admin Dashboard**
**URL:** `https://yegna-bingo-dashboard.vercel.app`

1. Go to Vercel Dashboard
2. Click "Add New Project"
3. Import the **SAME** GitHub repository
4. Configure:
   - **Project Name:** `yegna-bingo-dashboard`
   - **Framework Preset:** Next.js
   - **Root Directory:** `dashboard` ⚠️ **Important!**
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

5. Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_BOT_URL=https://yegna-bingo-bot.vercel.app
   ```

6. Deploy!

---

## Git-Based Deployment

Now when you push to GitHub:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

**All 3 projects will auto-deploy!** 🎉

---

## Deployment Settings in Vercel

For each project, configure:

### **Ignored Build Step** (Optional)
To prevent unnecessary builds, you can set up path-based deployment:

**Bot API:**
```bash
# Only deploy if files in root or api/ changed
git diff HEAD^ HEAD --quiet . api/ || exit 0
```

**Mini App:**
```bash
# Only deploy if files in miniapp/ changed
git diff HEAD^ HEAD --quiet miniapp/ || exit 0
```

**Dashboard:**
```bash
# Only deploy if files in dashboard/ changed
git diff HEAD^ HEAD --quiet dashboard/ || exit 0
```

---

## Vercel CLI Deployment (Alternative)

If you prefer CLI deployment:

```bash
# Deploy bot API
vercel --prod

# Deploy miniapp
cd miniapp
vercel --prod

# Deploy dashboard
cd ../dashboard
vercel --prod
```

**Note:** CLI deployments count toward your daily limit (100/day on free tier).

---

## Current URLs (Update These)

After setup, update these in your code:

- **Bot API:** `https://yegna-bingo-bot.vercel.app`
- **Mini App:** `https://yegna-bingo-miniapp.vercel.app`
- **Dashboard:** `https://yegna-bingo-dashboard.vercel.app`

Update in:
- `dashboard/pages/games.js` - Line 59 (BOT_URL)
- Telegram bot settings (Mini App URL)

---

## Testing

After deployment:

1. **Bot API:** Visit `https://yegna-bingo-bot.vercel.app`
   - Should show API status page

2. **Mini App:** Visit `https://yegna-bingo-miniapp.vercel.app`
   - Should show game selection page

3. **Dashboard:** Visit `https://yegna-bingo-dashboard.vercel.app`
   - Should show admin login

---

## Troubleshooting

### 404 Error
- Check "Root Directory" is set correctly
- Verify `vercel.json` exists in root
- Check build logs in Vercel dashboard

### Build Fails
- Check environment variables are set
- Verify `package.json` exists in the directory
- Check build logs for errors

### API Not Working
- Verify CORS is enabled (already configured)
- Check environment variables
- View function logs in Vercel

---

## Summary

✅ One GitHub repo = 3 Vercel projects
✅ Each project has its own URL
✅ Auto-deploy on git push
✅ No CLI deployment limits

All set! 🚀
