# 🚀 Vercel Auto-Deploy Setup - One Git Push, Three Deployments

## Overview
Configure Vercel to automatically deploy all three projects (Bot API, Mini App, Dashboard) from a single `git push`.

## Project Structure
```
YegnaBingoBot/
├── api/              → Bot API (Serverless Functions)
├── miniapp/          → Mini App (Next.js)
├── dashboard/        → Admin Dashboard (Next.js)
└── bot/              → Bot logic (shared)
```

## Setup Steps

### 1. Connect GitHub Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository: `YegnaBingoBot`

### 2. Create Three Separate Vercel Projects

You need to create **3 separate projects** from the same repository:

#### **Project 1: Bot API**
- **Project Name**: `yegna-bingo-bot`
- **Framework**: Other
- **Root Directory**: `./` (root)
- **Build Command**: (leave empty)
- **Output Directory**: (leave empty)
- **Install Command**: `npm install`

**Environment Variables:**
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
TELEGRAM_BOT_TOKEN=your_bot_token
```

**Git Branch**: `main`

---

#### **Project 2: Mini App**
- **Project Name**: `yegna-bingo-miniapp`
- **Framework**: Next.js
- **Root Directory**: `miniapp` ⚠️ **Important!**
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YegnaBingoBot
```

**Git Branch**: `main`

---

#### **Project 3: Admin Dashboard**
- **Project Name**: `yegna-bingo-dashboard`
- **Framework**: Next.js
- **Root Directory**: `dashboard` ⚠️ **Important!**
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BOT_URL=https://yegna-bingo-bot.vercel.app
NEXT_PUBLIC_SUPER_ADMIN_USERNAME=your_super_username
NEXT_PUBLIC_SUPER_ADMIN_PASSWORD=your_super_password
```

**Git Branch**: `main`

---

### 3. Configure Auto-Deploy Settings

For **each project**, go to:
**Settings → Git → Production Branch**

Set to: `main`

Enable:
- ✅ **Auto-deploy on push to main**
- ✅ **Auto-deploy on pull request**
- ✅ **Comments on pull requests**

---

### 4. Configure Ignored Build Step (Optional)

To prevent unnecessary builds, configure each project to only build when relevant files change:

#### **Bot API** - Ignored Build Step
```bash
#!/bin/bash

# Only build if root files or api/ folder changed
git diff HEAD^ HEAD --quiet . api/ bot/ || exit 0
exit 1
```

#### **Mini App** - Ignored Build Step
```bash
#!/bin/bash

# Only build if miniapp/ folder changed
git diff HEAD^ HEAD --quiet miniapp/ || exit 0
exit 1
```

#### **Dashboard** - Ignored Build Step
```bash
#!/bin/bash

# Only build if dashboard/ folder changed
git diff HEAD^ HEAD --quiet dashboard/ || exit 0
exit 1
```

**How to set:**
1. Go to project **Settings → Git**
2. Scroll to **Ignored Build Step**
3. Paste the script above
4. Save

---

## How It Works

### Before (Manual)
```bash
# Deploy bot
vercel --prod

# Deploy miniapp
cd miniapp
vercel --prod

# Deploy dashboard
cd ../dashboard
vercel --prod
```

### After (Automatic)
```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main

# ✅ All 3 projects auto-deploy!
```

---

## Deployment Flow

```
┌─────────────────────────────────────────┐
│  git push origin main                   │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  GitHub receives push                   │
└─────────────────────────────────────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────┐   ┌──────────────┐
│ Vercel Bot   │   │ Vercel Mini  │
│ Project      │   │ App Project  │
│ (Root)       │   │ (miniapp/)   │
└──────────────┘   └──────────────┘
        ↓                 ↓
┌──────────────┐   ┌──────────────┐
│ Build & Test │   │ Build & Test │
└──────────────┘   └──────────────┘
        ↓                 ↓
┌──────────────┐   ┌──────────────┐
│ Deploy Live  │   │ Deploy Live  │
└──────────────┘   └──────────────┘

        ┌──────────────┐
        │ Vercel Dash  │
        │ Project      │
        │ (dashboard/) │
        └──────────────┘
               ↓
        ┌──────────────┐
        │ Build & Test │
        └──────────────┘
               ↓
        ┌──────────────┐
        │ Deploy Live  │
        └──────────────┘
```

---

## Vercel Dashboard URLs

After setup, you'll have:

1. **Bot API**: `https://yegna-bingo-bot.vercel.app`
2. **Mini App**: `https://yegna-bingo-miniapp.vercel.app`
3. **Dashboard**: `https://yegna-bingo-dashboard.vercel.app`

---

## Monitoring Deployments

### Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. See all 3 projects
3. Click each to see deployment status

### Deployment Notifications
- ✅ Success: Green checkmark
- ❌ Failed: Red X
- ⏳ Building: Yellow spinner

### View Logs
1. Click on deployment
2. View **Build Logs**
3. View **Function Logs** (for API)
4. Check for errors

---

## Troubleshooting

### Build Fails for Mini App or Dashboard

**Check:**
1. `package.json` exists in the folder
2. `next.config.js` is correct
3. Environment variables are set
4. No syntax errors

**Fix:**
```bash
# Test locally first
cd miniapp
npm install
npm run build

cd ../dashboard
npm install
npm run build
```

### Bot API Not Working

**Check:**
1. `api/` folder has `.js` files
2. `vercel.json` is correct
3. Environment variables set
4. Supabase credentials valid

### Only One Project Deploys

**Check:**
1. All 3 projects created in Vercel
2. Each has correct **Root Directory**
3. Each watches `main` branch
4. Auto-deploy enabled

---

## Best Practices

### Commit Messages
Use clear commit messages:
```bash
git commit -m "feat: Add auto-game countdown"
git commit -m "fix: Super admin authentication"
git commit -m "docs: Update deployment guide"
```

### Branch Strategy
```bash
# Development
git checkout -b feature/new-feature
# Make changes
git commit -m "Add new feature"
git push origin feature/new-feature

# Create Pull Request
# Review & Merge to main
# Auto-deploy triggers!
```

### Environment Variables
- ✅ Set in Vercel Dashboard
- ✅ Never commit to Git
- ✅ Use `.env.local` for local dev
- ✅ Update all 3 projects when changed

---

## Quick Reference

### Deploy All Projects
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Check Deployment Status
```bash
# Visit Vercel Dashboard
https://vercel.com/dashboard

# Or use Vercel CLI
vercel ls
```

### Rollback Deployment
1. Go to Vercel project
2. Click **Deployments**
3. Find previous working deployment
4. Click **Promote to Production**

---

## Summary

✅ **One Git Push** → Three Auto-Deployments
✅ **No Manual Commands** → Vercel handles everything
✅ **Faster Workflow** → Push and forget
✅ **Automatic Testing** → Build fails = No deploy
✅ **Easy Rollback** → One-click restore

**Just push to GitHub, Vercel does the rest!** 🚀

---

## Initial Setup Checklist

- [ ] Create 3 Vercel projects
- [ ] Set root directories correctly
- [ ] Add environment variables to each
- [ ] Enable auto-deploy on main branch
- [ ] Test with a small commit
- [ ] Verify all 3 projects deploy
- [ ] Update Telegram bot webhook URL
- [ ] Update dashboard bot URL
- [ ] Test end-to-end functionality

**Done! Now just `git push` and relax!** ☕
