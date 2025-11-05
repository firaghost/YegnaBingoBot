# ⚡ Quick Deploy Guide - Auto-Deploy with Git Push

## One-Time Setup (Do This Once)

### Step 1: Connect to GitHub
```bash
# If not already done
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/YegnaBingoBot.git
git push -u origin main
```

### Step 2: Create Vercel Projects

Go to [Vercel Dashboard](https://vercel.com/dashboard) and create **3 projects**:

#### Project 1: Bot API
- Click **"Add New Project"**
- Import your GitHub repo
- **Project Name**: `yegna-bingo-bot`
- **Framework**: Other
- **Root Directory**: `./` (leave empty)
- Add environment variables:
  ```
  SUPABASE_URL=...
  SUPABASE_SERVICE_KEY=...
  TELEGRAM_BOT_TOKEN=...
  ```
- Click **Deploy**

#### Project 2: Mini App
- Click **"Add New Project"** again
- Import **same** GitHub repo
- **Project Name**: `yegna-bingo-miniapp`
- **Framework**: Next.js
- **Root Directory**: `miniapp` ⚠️
- Add environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YegnaBingoBot
  ```
- Click **Deploy**

#### Project 3: Dashboard
- Click **"Add New Project"** again
- Import **same** GitHub repo
- **Project Name**: `yegna-bingo-dashboard`
- **Framework**: Next.js
- **Root Directory**: `dashboard` ⚠️
- Add environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  NEXT_PUBLIC_BOT_URL=https://yegna-bingo-bot.vercel.app
  NEXT_PUBLIC_SUPER_ADMIN_USERNAME=superadmin
  NEXT_PUBLIC_SUPER_ADMIN_PASSWORD=YourStrongPassword123!
  ```
- Click **Deploy**

### Step 3: Enable Auto-Deploy

For **each project**:
1. Go to **Settings → Git**
2. Under **Production Branch**, ensure it's set to `main`
3. ✅ Auto-deploy should be enabled by default

---

## Daily Usage (Every Time You Make Changes)

### Simple 3-Step Deploy

```bash
# 1. Add your changes
git add .

# 2. Commit with message
git commit -m "Your changes description"

# 3. Push to GitHub
git push origin main
```

**That's it!** All 3 projects auto-deploy! 🚀

---

## Using the Deploy Script

### Windows PowerShell
```powershell
.\deploy.ps1
```

The script will:
1. ✅ Check for uncommitted changes
2. ✅ Help you commit them
3. ✅ Push to GitHub
4. ✅ Show deployment URLs

---

## Verify Deployment

### Check Status
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. You'll see all 3 projects
3. Green ✅ = Deployed successfully
4. Red ❌ = Build failed (check logs)

### Test Your Apps
- **Bot API**: `https://yegna-bingo-bot.vercel.app`
- **Mini App**: `https://yegna-bingo-miniapp.vercel.app`
- **Dashboard**: `https://yegna-bingo-dashboard.vercel.app`

---

## Common Workflows

### Fix a Bug
```bash
# Make your fix
git add .
git commit -m "fix: Resolve countdown timer issue"
git push origin main
# ✅ Auto-deploys!
```

### Add New Feature
```bash
# Add feature
git add .
git commit -m "feat: Add super admin dashboard"
git push origin main
# ✅ Auto-deploys!
```

### Update Environment Variables
1. Go to Vercel project
2. **Settings → Environment Variables**
3. Update variable
4. Click **Save**
5. **Redeploy** (click button)

---

## Troubleshooting

### "Build Failed" Error

**Check:**
1. Click on failed deployment
2. View **Build Logs**
3. Fix the error in your code
4. Commit and push again

### "Environment Variable Missing"

**Fix:**
1. Go to Vercel project
2. **Settings → Environment Variables**
3. Add missing variable
4. Redeploy

### Only One Project Deploys

**Check:**
1. Verify all 3 projects exist in Vercel
2. Each has correct **Root Directory**
3. Each watches `main` branch

---

## Pro Tips

### Commit Message Format
```bash
# Feature
git commit -m "feat: Add countdown timer"

# Bug fix
git commit -m "fix: Resolve payment issue"

# Documentation
git commit -m "docs: Update README"

# Style/formatting
git commit -m "style: Format code"
```

### View Deployment Logs
```bash
# Install Vercel CLI (optional)
npm i -g vercel

# View logs
vercel logs yegna-bingo-bot
vercel logs yegna-bingo-miniapp
vercel logs yegna-bingo-dashboard
```

### Rollback if Needed
1. Go to Vercel project
2. **Deployments** tab
3. Find previous working version
4. Click **⋯** → **Promote to Production**

---

## Summary

### Before (Manual)
```bash
vercel --prod                    # Deploy bot
cd miniapp && vercel --prod      # Deploy miniapp
cd ../dashboard && vercel --prod # Deploy dashboard
```

### After (Automatic)
```bash
git push origin main  # ✅ All 3 deploy automatically!
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────┐
│  DEPLOY WORKFLOW                        │
├─────────────────────────────────────────┤
│  1. Make changes                        │
│  2. git add .                           │
│  3. git commit -m "message"             │
│  4. git push origin main                │
│                                         │
│  ✅ Done! Vercel auto-deploys          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  DEPLOYMENT URLS                        │
├─────────────────────────────────────────┤
│  Bot:   yegna-bingo-bot.vercel.app     │
│  Mini:  yegna-bingo-miniapp.vercel.app │
│  Dash:  yegna-bingo-dashboard.vercel.app│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  VERCEL DASHBOARD                       │
├─────────────────────────────────────────┤
│  https://vercel.com/dashboard           │
└─────────────────────────────────────────┘
```

**No more manual deployments! Just push and relax!** ☕🚀
