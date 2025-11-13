# Deploy Socket.IO Server - Quick Guide

## ✅ Client-Side Changes Complete

The following changes have been made to remove the client-side ticker:

1. **Removed** `useGameTicker` import from `app/game/[roomId]/page.tsx`
2. **Removed** `useGameTicker` hook usage
3. **Removed** countdown stuck detection code (no longer needed)
4. **Added** comment explaining server-side game loop

Clients now simply listen to Socket.IO `game-state` events!

## 🚀 Deploy Socket.IO Server

### Option 1: Local Development/Testing

```bash
# Navigate to project root
cd d:\Projects\BingoXBot

# Install dependencies (if not already installed)
npm install

# Start the Socket.IO server
npm run dev:socket

# Or if you have a separate script:
node server/index.ts
# or
ts-node server/index.ts
```

### Option 2: Production Deployment (Railway/Render/Heroku)

#### Railway (Recommended - Free Tier Available)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize Project:**
   ```bash
   railway init
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Set Environment Variables:**
   ```bash
   railway variables set SUPABASE_URL=your_supabase_url
   railway variables set SUPABASE_SERVICE_KEY=your_service_key
   railway variables set SOCKET_PORT=3001
   railway variables set NEXT_PUBLIC_APP_URL=your_vercel_url
   ```

#### Render.com (Free Tier)

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name:** BingoX-bingo-socket
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.ts` or `npm run start:socket`
   - **Port:** 3001
5. Add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `NEXT_PUBLIC_APP_URL`

#### Firebase (Cloud Run) - ✅ Recommended Free Option

**Step 1: Install Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
```

**Step 2: Initialize Firebase**
```bash
firebase init

# Select:
# - Hosting
# - Cloud Run (if available)
# Or just select "Hosting" and we'll configure manually
```

**Step 3: Create Dockerfile**
Create `Dockerfile` in project root:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose Socket.IO port
EXPOSE 3001

# Start Socket.IO server
CMD ["npm", "run", "start:socket"]
```

**Step 4: Create `.dockerignore`**
```
node_modules
.next
.git
.env.local
*.md
```

**Step 5: Deploy to Cloud Run via Firebase**
```bash
# Build and deploy
firebase deploy --only hosting

# Or deploy to Cloud Run directly
gcloud run deploy BingoX-bingo-socket \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL=your_url,SUPABASE_SERVICE_KEY=your_key,NEXT_PUBLIC_APP_URL=your_vercel_url
```

**Step 6: Get Your Socket URL**
After deployment, you'll get a URL like:
```
https://BingoX-bingo-socket-xxxxx.run.app
```

Use this as your `NEXT_PUBLIC_SOCKET_URL` in Vercel!

**Pricing:**
- ✅ **Free tier:** 2 million requests/month
- ✅ **Always-on:** First 180,000 vCPU-seconds free
- ✅ **Perfect for Socket.IO!**

#### Heroku

```bash
# Install Heroku CLI
# Then:
heroku login
heroku create BingoX-bingo-socket
git push heroku main

# Set environment variables
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_SERVICE_KEY=your_key
heroku config:set SOCKET_PORT=3001
```

### Option 3: VPS (DigitalOcean, AWS, etc.)

```bash
# SSH into your server
ssh user@your-server-ip

# Clone repo
git clone https://github.com/yourusername/BingoXBot.git
cd BingoXBot

# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Start server with PM2
pm2 start server/index.ts --name bingo-socket

# Make it restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs bingo-socket
```

## 🧪 Testing the Server

### 1. Check Server is Running

```bash
# You should see:
✅ Socket.IO server running on port 3001
🔗 Accepting connections from: http://localhost:3000
```

### 2. Test Game Flow

1. **Open your app** in browser (http://localhost:3000 or your Vercel URL)
2. **Join a game** with 2 players
3. **Watch server logs** - you should see:

```
👤 User [userId] joined game [gameId]
🚀 Triggering game loop for [gameId] (status: countdown)
🎮 Starting server-side game loop for [gameId]
⏰ Game [gameId] countdown: 10s
⏰ Game [gameId] countdown: 9s
⏰ Game [gameId] countdown: 8s
...
⏰ Game [gameId] countdown: 1s
🎬 Game [gameId] started - beginning number calls
📢 Starting number calls for game [gameId]
📢 Game [gameId]: Called B5 [1/75]
📢 Game [gameId]: Called I23 [2/75]
📢 Game [gameId]: Called N42 [3/75]
```

4. **Check browser console** - should see:
```
✅ User authenticated, redirecting to lobby
🔌 About to join socket game: [gameId]
🎮 Joining game: [gameId]
✅ Initial game state loaded: countdown
📡 Subscription status: SUBSCRIBED
```

5. **Verify countdown updates** in UI every second
6. **Verify numbers are called** every 3 seconds during active game

### 3. Test Multiple Games

Open multiple browser windows and join different games - each should have its own independent game loop.

## 🔧 Update Environment Variables

Make sure your client app knows where the Socket.IO server is:

### In `.env.local` (for local development):
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### In Vercel (for production):
```bash
vercel env add NEXT_PUBLIC_SOCKET_URL
# Enter: https://your-socket-server.railway.app
```

## 📊 Monitoring

### Check Active Game Loops

Add this endpoint to your Socket.IO server for monitoring:

```typescript
// Add to server/socket-server.ts
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      activeGames: activeGameLoops.size,
      uptime: process.uptime()
    }))
  }
})
```

Then check: `http://your-socket-server:3001/health`

### View Logs

**Railway:**
```bash
railway logs
```

**Render:**
Check logs in dashboard

**PM2:**
```bash
pm2 logs bingo-socket
```

**Heroku:**
```bash
heroku logs --tail
```

## ✅ Verification Checklist

After deployment, verify:

- [ ] Socket.IO server is running and accessible
- [ ] Server logs show game loops starting
- [ ] Countdown updates every second in UI
- [ ] Numbers are called every 3 seconds
- [ ] Multiple games can run simultaneously
- [ ] Games end properly when winner is declared
- [ ] No "countdown stuck" warnings in browser console
- [ ] No client-side ticker logs (should be gone)

## 🐛 Troubleshooting

### Server not starting?
- Check if port 3001 is available
- Verify environment variables are set
- Check for TypeScript compilation errors

### Games not progressing?
- Check server logs for errors
- Verify Socket.IO connection in browser console
- Check if game status is 'countdown' in database

### CORS errors?
- Verify `NEXT_PUBLIC_APP_URL` is in CORS origins
- Add your production URL to CORS array in `socket-server.ts`

### Multiple game loops for same game?
- Check server logs for "⚠️ Game loop already running" messages
- This is normal and means duplicate prevention is working

## 🎉 Success!

Once you see games progressing smoothly with server logs showing countdown and number calls, you're done!

The game will now:
- ✅ Never get stuck
- ✅ Work reliably for all players
- ✅ Progress even if players disconnect
- ✅ Be easier to debug and monitor

## 📝 Next Steps

1. Deploy to production
2. Monitor for a few days
3. Remove old tick API routes (optional cleanup)
4. Update documentation
5. Celebrate! 🎊
