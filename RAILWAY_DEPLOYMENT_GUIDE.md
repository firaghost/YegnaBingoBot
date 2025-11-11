# Railway Deployment Guide - Socket.IO Server

## Why Railway for Socket.IO?

✅ **Free tier** with 500 hours/month  
✅ **Always-on** - No cold starts  
✅ **WebSocket support** - Perfect for Socket.IO  
✅ **No timeouts** - Game loops run continuously  
✅ **Auto-restart** on crashes  

Firebase Cloud Functions won't work because they timeout after 60 seconds. Railway keeps your Socket.IO server running 24/7.

---

## Step-by-Step Deployment

### 1. Create Railway Account

1. Go to **https://railway.app**
2. Click **"Login"** → **"Login with GitHub"**
3. Authorize Railway to access your GitHub

### 2. Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: **`YegnaBingoBot`**
4. Railway will automatically detect your `railway.json` configuration

### 3. Configure Environment Variables

Click on your deployed service → **"Variables"** tab → Add these:

```env
# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key_here

# Port Configuration
PORT=3001
NODE_ENV=production

# Frontend URL (for CORS)
NEXT_PUBLIC_APP_URL=https://yegnagame.vercel.app
```

**Where to find these values:**
- `SUPABASE_URL` & `SUPABASE_KEY`: Supabase Dashboard → Settings → API
- Use the **service_role** key (not anon key) for the socket server

### 4. Deploy

1. Railway will **automatically deploy** after you add the environment variables
2. Wait 2-3 minutes for the build to complete
3. Check the **"Deployments"** tab for build logs

### 5. Get Your Railway URL

1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://yegnabingobot-production.up.railway.app`)

### 6. Update Vercel Environment Variables

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add or update:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://yegnabingobot-production.up.railway.app
   ```
3. **Redeploy** your Vercel app (Deployments → Click "..." → Redeploy)

---

## Verify Deployment

### Check Railway Logs

1. Go to Railway Dashboard → Your Service
2. Click **"Deployments"** → Latest deployment
3. View logs - you should see:
   ```
   🚀 Socket.IO Server Starting...
   ✅ Socket.IO server running on port 3001
   🔗 Accepting connections from: https://yegnagame.vercel.app
   ```

### Test Connection

Open your Vercel app and check browser console:
```
Socket.IO connected to: https://yegnabingobot-production.up.railway.app
```

---

## How Railway Fixes Your Game Stacking Issue

### The Problem:
- Vercel serverless functions timeout after 10 seconds
- Game loops couldn't run continuously
- Multiple game instances would stack up

### The Solution:
Railway runs your Socket.IO server as a **persistent process**:
- ✅ Game loops run continuously without timeouts
- ✅ Single server instance prevents stacking
- ✅ Auto-restart on crashes
- ✅ WebSocket connections stay alive

---

## Troubleshooting

### Build Fails

**Error: `Cannot find module 'tsx'`**
- Railway should auto-install dependencies
- Check `package.json` has `tsx` in dependencies

**Fix:** Ensure `railway.json` has correct build command:
```json
{
  "deploy": {
    "startCommand": "npm run start:socket"
  }
}
```

### Connection Refused

**Error: `ERR_CONNECTION_REFUSED`**

1. Check Railway logs for errors
2. Verify environment variables are set
3. Ensure Railway domain is generated
4. Check CORS origins in `socket-server.ts`

### CORS Errors

**Error: `Access-Control-Allow-Origin`**

1. Add your Vercel domain to CORS origins in `socket-server.ts`:
   ```typescript
   origin: [
     'https://yegnagame.vercel.app',
     'https://your-other-domain.vercel.app'
   ]
   ```
2. Redeploy Railway service

### Game Loop Not Starting

1. Check Railway logs for `🎮 Starting server-side game loop`
2. Verify Supabase credentials are correct
3. Check if game status is `countdown` or `active` in database
4. Ensure `SUPABASE_KEY` is the **service_role** key (not anon)

---

## Cost & Limits

### Railway Free Tier:
- ✅ **500 hours/month** (enough for 24/7 if you have one service)
- ✅ **512 MB RAM**
- ✅ **1 GB disk**
- ✅ **100 GB bandwidth**

### If You Need More:
- Upgrade to **Hobby plan** ($5/month) for unlimited hours
- Or use **Render.com** free tier (spins down after 15 min inactivity)

---

## Post-Deployment Checklist

- [ ] Railway service deployed successfully
- [ ] Environment variables configured
- [ ] Railway domain generated
- [ ] `NEXT_PUBLIC_SOCKET_URL` added to Vercel
- [ ] Vercel app redeployed
- [ ] Socket.IO connection working in browser
- [ ] Game loop starting automatically
- [ ] No game stacking issues

---

## Alternative: Render.com (If Railway Doesn't Work)

If you prefer Render:

1. Go to **https://render.com**
2. Create **New Web Service**
3. Connect GitHub repo
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:socket`
5. Add same environment variables
6. Use Render URL in Vercel

**Note:** Render free tier spins down after 15 minutes of inactivity (not ideal for game loops).

---

## Need Help?

Check Railway logs first:
```bash
# In Railway dashboard
Deployments → Latest → View Logs
```

Common issues are usually:
1. Missing environment variables
2. Wrong Supabase key (use service_role, not anon)
3. CORS configuration
4. Port conflicts

---

## Summary

✅ **Railway** = Perfect for Socket.IO (always-on, no timeouts)  
❌ **Firebase** = Not suitable (60s timeout, requires paid plan)  
✅ **Your Setup**: Vercel (frontend) + Railway (Socket.IO) + Supabase (database)

This architecture will fix your game stacking issue permanently! 🚀
