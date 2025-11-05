# 🚀 Vercel Auto-Deploy Setup - Monorepo

## Current Structure

```
YegnaBingoBot/
├── api/          → Bot API (Serverless Functions)
├── miniapp/      → Mini App (Next.js)
├── dashboard/    → Dashboard (Next.js)
└── vercel.json   → Root config (ignores builds)
```

## ✅ What's Already Done

1. ✅ Root `vercel.json` configured to ignore builds
2. ✅ Each project has its own `vercel.json`
3. ✅ All 3 projects deployed separately on Vercel

## 🎯 Goal: Auto-Deploy Only Changed Projects

When you push to GitHub, only the projects with changes should rebuild.

## 📋 Setup Instructions

### Step 1: Configure Ignored Build Step (One-Time Setup)

For each of your 3 Vercel projects, configure the "Ignored Build Step":

#### 1. Bot API Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select **yegna-bingo-bot-api** project
3. Go to **Settings** → **Git**
4. Scroll to **"Ignored Build Step"**
5. Select **"Custom"**
6. Enter this command:
   ```bash
   git diff HEAD^ HEAD --quiet -- api/ bot/ || exit 1
   ```
7. Click **Save**

**What this does**: Only rebuilds if files in `api/` or `bot/` folders changed.

#### 2. Mini App Project

1. Select **yegna-bingo-miniapp** project
2. Go to **Settings** → **Git**
3. **"Ignored Build Step"** → **"Custom"**
4. Enter:
   ```bash
   git diff HEAD^ HEAD --quiet -- miniapp/ || exit 1
   ```
5. Click **Save**

**What this does**: Only rebuilds if files in `miniapp/` folder changed.

#### 3. Dashboard Project

1. Select **yegna-bingo-dashboard** project
2. Go to **Settings** → **Git**
3. **"Ignored Build Step"** → **"Custom"**
4. Enter:
   ```bash
   git diff HEAD^ HEAD --quiet -- dashboard/ || exit 1
   ```
5. Click **Save**

**What this does**: Only rebuilds if files in `dashboard/` folder changed.

### Step 2: Verify Root Directory Settings

Make sure each project has the correct root directory:

#### Bot API
- **Root Directory**: `api`
- **Framework Preset**: Other
- **Build Command**: (leave empty)
- **Output Directory**: (leave empty)

#### Mini App
- **Root Directory**: `miniapp`
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

#### Dashboard
- **Root Directory**: `dashboard`
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

## 🧪 Testing the Setup

### Test 1: Change Only Mini App
```bash
# Make a change in miniapp
echo "// test" >> miniapp/pages/index.js
git add .
git commit -m "Test miniapp change"
git push origin main
```

**Expected Result**: 
- ✅ Mini App rebuilds
- ⏭️ Bot API skipped
- ⏭️ Dashboard skipped

### Test 2: Change Only Bot API
```bash
# Make a change in api
echo "// test" >> api/webhook.js
git add .
git commit -m "Test api change"
git push origin main
```

**Expected Result**:
- ✅ Bot API rebuilds
- ⏭️ Mini App skipped
- ⏭️ Dashboard skipped

### Test 3: Change Multiple Projects
```bash
# Make changes in both miniapp and dashboard
echo "// test" >> miniapp/pages/index.js
echo "// test" >> dashboard/pages/index.js
git add .
git commit -m "Test multiple changes"
git push origin main
```

**Expected Result**:
- ✅ Mini App rebuilds
- ✅ Dashboard rebuilds
- ⏭️ Bot API skipped

### Test 4: Change Root Files Only
```bash
# Make a change in root (like README)
echo "# test" >> README.md
git add .
git commit -m "Update README"
git push origin main
```

**Expected Result**:
- ⏭️ All projects skipped (no code changes)

## 📊 Monitoring Deployments

### Check Deployment Status

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. You'll see deployments for each project
3. Skipped builds show: "Build skipped (Ignored Build Step)"
4. Active builds show: "Building..."

### Deployment Logs

Click on any deployment to see:
- ✅ **Skipped**: "Ignored Build Step returned exit code 1"
- ✅ **Building**: Full build logs
- ✅ **Success**: "Deployment completed"

## 🔄 Workflow After Setup

### Normal Development Flow:

```bash
# 1. Make your changes
git add .
git commit -m "Your commit message"
git push origin main

# 2. Vercel automatically:
#    - Detects which folders changed
#    - Rebuilds only affected projects
#    - Skips unchanged projects
#    - Deploys to production

# 3. Check deployment status:
#    - Visit Vercel Dashboard
#    - Or check GitHub commit status
```

### Manual Deploy (if needed):

```bash
# Deploy specific project manually
cd miniapp
vercel --prod

cd ../dashboard
vercel --prod

cd ../api
vercel --prod
```

## 🎯 Benefits

1. ✅ **Faster Deployments** - Only changed projects rebuild
2. ✅ **Save Build Minutes** - Don't waste build time on unchanged code
3. ✅ **Automatic** - No manual intervention needed
4. ✅ **Safe** - Each project deploys independently
5. ✅ **Efficient** - Parallel deployments when multiple projects change

## 🚨 Troubleshooting

### Issue: All Projects Build Every Time

**Solution**: Check Ignored Build Step is configured correctly for each project.

### Issue: Project Doesn't Build When It Should

**Solution**: 
1. Check if files are in the correct directory
2. Verify git diff command includes the right path
3. Try manual deploy: `cd [project] && vercel --prod`

### Issue: Build Fails

**Solution**:
1. Check build logs in Vercel Dashboard
2. Test build locally: `npm run build`
3. Verify environment variables are set

## 📝 Current Configuration Summary

### Root Project (Ignored)
- ✅ `vercel.json` with `ignoreCommand: "exit 1"`
- ✅ Prevents root-level builds

### Bot API
- ✅ Root Directory: `api`
- ✅ Ignored Build Step: Checks `api/` and `bot/` changes
- ✅ Serverless functions

### Mini App
- ✅ Root Directory: `miniapp`
- ✅ Ignored Build Step: Checks `miniapp/` changes
- ✅ Next.js app

### Dashboard
- ✅ Root Directory: `dashboard`
- ✅ Ignored Build Step: Checks `dashboard/` changes
- ✅ Next.js app

## ✅ Setup Complete!

After following these steps:
1. Push to GitHub once
2. All 3 projects deploy automatically
3. Future pushes only rebuild changed projects
4. No manual deployment needed!

---

**Status**: ✅ READY FOR AUTO-DEPLOYMENT
**Last Updated**: 2025-11-05
