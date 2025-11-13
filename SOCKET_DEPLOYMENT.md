# Socket Server Deployment Guide

## Problem
Vercel doesn't support WebSocket connections, so the Socket.IO server needs to be deployed separately.

## Solution Options

### Option 1: Deploy to Railway (Recommended)

Railway is free for hobby projects and supports WebSocket connections.

#### Steps:

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Build Settings**
   - Add a `railway.json` file (see below)
   - Or configure in Railway dashboard:
     - Build Command: `npm install`
     - Start Command: `npm run start:socket`

4. **Add Environment Variables** in Railway dashboard:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_role_key
   PORT=3001
   NODE_ENV=production
   ```

5. **Get Your Railway URL**
   - After deployment, Railway will give you a URL like: `https://your-app.railway.app`
   - Copy this URL

6. **Update Vercel Environment Variables**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_SOCKET_URL=https://your-app.railway.app`
   - Redeploy your Vercel app

#### Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:socket",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

### Option 2: Deploy to Render

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository
   - Configure:
     - Name: `BingoX-bingo-socket`
     - Build Command: `npm install`
     - Start Command: `npm run start:socket`

3. **Add Environment Variables**:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_role_key
   NODE_ENV=production
   ```

4. **Get Your Render URL**
   - After deployment: `https://BingoX-bingo-socket.onrender.com`

5. **Update Vercel**:
   - Add `NEXT_PUBLIC_SOCKET_URL=https://BingoX-bingo-socket.onrender.com`

---

### Option 3: Use Supabase Realtime (Alternative Approach)

Instead of Socket.IO, use Supabase's built-in Realtime features:

**Pros:**
- No separate server needed
- Already integrated with your database
- Automatic scaling

**Cons:**
- Requires code refactoring
- Different API than Socket.IO

---

## Quick Fix for Testing

For immediate testing, you can:

1. **Run socket server locally**:
   ```bash
   npm run dev:socket
   ```

2. **Use ngrok to expose it**:
   ```bash
   ngrok http 3001
   ```

3. **Update your production env**:
   - Set `NEXT_PUBLIC_SOCKET_URL` to your ngrok URL
   - Note: ngrok URLs change on restart (not for production)

---

## Recommended: Railway Deployment

Railway is the easiest and most reliable option for WebSocket servers.

### After Deployment Checklist:

- [ ] Socket server deployed to Railway/Render
- [ ] `NEXT_PUBLIC_SOCKET_URL` added to Vercel environment variables
- [ ] Vercel app redeployed
- [ ] Test WebSocket connection from production app
- [ ] Monitor Railway/Render logs for errors

---

## Troubleshooting

**Connection Refused:**
- Check if socket server is running
- Verify CORS origins include your Vercel domain
- Check Railway/Render logs

**CORS Errors:**
- Add your Vercel domain to the `origin` array in `socket-server.ts`

**Environment Variables:**
- Ensure all required env vars are set on Railway/Render
- Restart the service after adding env vars
