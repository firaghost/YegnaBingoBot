# Firebase Deployment Guide for Socket.IO Server

## Why Firebase Cloud Run?

✅ **Perfect for Socket.IO:**
- Supports WebSocket connections
- Always-on server (not serverless functions)
- Auto-scaling
- Free tier: 2M requests/month + 180,000 vCPU-seconds free

❌ **Why NOT Firebase Cloud Functions:**
- 60-second timeout (too short for WebSockets)
- Designed for short-lived requests
- Cannot maintain persistent connections

## Prerequisites

1. **Google Cloud Account** (Firebase uses Google Cloud)
2. **Firebase CLI** installed
3. **Docker** (optional, Cloud Run can build for you)

## Step-by-Step Deployment

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Create Firebase Project

**Option A: Via Firebase Console**
1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Name it: `BingoX-bingo-bot`
4. Follow the setup wizard

**Option B: Via CLI**
```bash
firebase projects:create BingoX-bingo-bot
```

### 4. Initialize Firebase in Your Project

```bash
cd d:\Projects\BingoXBot
firebase init

# Select:
# ✓ Hosting: Configure files for Firebase Hosting
# 
# Choose your Firebase project: BingoX-bingo-bot
# 
# What do you want to use as your public directory? (public) 
# → Press Enter (we'll configure manually)
# 
# Configure as a single-page app? (y/N) 
# → N
```

### 5. Enable Cloud Run API

```bash
# Enable Cloud Run API in your Google Cloud project
gcloud services enable run.googleapis.com

# Or enable via console:
# https://console.cloud.google.com/apis/library/run.googleapis.com
```

### 6. Deploy to Cloud Run

**Option A: Using gcloud CLI (Recommended)**

```bash
# Install gcloud CLI if not already installed
# Download from: https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Set your project
gcloud config set project BingoX-bingo-bot

# Deploy
gcloud run deploy BingoX-bingo-socket \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001 \
  --set-env-vars SUPABASE_URL=your_supabase_url,SUPABASE_SERVICE_KEY=your_service_key,NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Option B: Using Dockerfile (More Control)**

```bash
# Build Docker image
docker build -t BingoX-bingo-socket .

# Tag for Google Container Registry
docker tag BingoX-bingo-socket gcr.io/BingoX-bingo-bot/socket-server

# Push to GCR
docker push gcr.io/BingoX-bingo-bot/socket-server

# Deploy to Cloud Run
gcloud run deploy BingoX-bingo-socket \
  --image gcr.io/BingoX-bingo-bot/socket-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001
```

### 7. Set Environment Variables

**Via gcloud CLI:**
```bash
gcloud run services update BingoX-bingo-socket \
  --set-env-vars SUPABASE_URL=https://your-project.supabase.co \
  --set-env-vars SUPABASE_SERVICE_KEY=your-service-key \
  --set-env-vars NEXT_PUBLIC_APP_URL=https://your-app.vercel.app \
  --region us-central1
```

**Via Cloud Console:**
1. Go to https://console.cloud.google.com/run
2. Click on `BingoX-bingo-socket`
3. Click "Edit & Deploy New Revision"
4. Scroll to "Variables & Secrets"
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `NEXT_PUBLIC_APP_URL`
   - `SOCKET_PORT` = `3001`

### 8. Get Your Socket.IO URL

After deployment, you'll get a URL like:
```
https://BingoX-bingo-socket-xxxxx-uc.a.run.app
```

Copy this URL!

### 9. Update Your Next.js App

**In Vercel Environment Variables:**
```bash
# Go to Vercel Dashboard → Your Project → Settings → Environment Variables
# Add:
NEXT_PUBLIC_SOCKET_URL=https://BingoX-bingo-socket-xxxxx-uc.a.run.app
```

**Or via Vercel CLI:**
```bash
vercel env add NEXT_PUBLIC_SOCKET_URL
# Paste your Cloud Run URL
```

### 10. Update CORS in Socket Server

Edit `server/socket-server.ts`:
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'https://BingoX-bingo-bot.vercel.app',
      'https://your-production-domain.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
})
```

Redeploy:
```bash
gcloud run deploy BingoX-bingo-socket --source .
```

## Testing Your Deployment

### 1. Test Health Endpoint

```bash
curl https://BingoX-bingo-socket-xxxxx-uc.a.run.app/health
```

Should return:
```json
{
  "status": "ok",
  "activeGames": 0,
  "uptime": 123.45
}
```

### 2. Test Socket.IO Connection

Open browser console on your app:
```javascript
// Should see in console:
✅ Socket connected
```

### 3. Test Game Flow

1. Join a game with 2 players
2. Check Cloud Run logs:
   ```bash
   gcloud run logs read BingoX-bingo-socket --region us-central1
   ```
3. Should see:
   ```
   🎮 Starting server-side game loop
   ⏰ Game countdown: 10s
   📢 Called B5 [1/75]
   ```

## Monitoring & Logs

### View Logs

**Via gcloud:**
```bash
# Stream logs
gcloud run logs tail BingoX-bingo-socket --region us-central1

# View recent logs
gcloud run logs read BingoX-bingo-socket --region us-central1 --limit 50
```

**Via Console:**
1. Go to https://console.cloud.google.com/run
2. Click on `BingoX-bingo-socket`
3. Click "Logs" tab

### Monitor Metrics

**Via Console:**
1. Go to Cloud Run service
2. Click "Metrics" tab
3. View:
   - Request count
   - Request latency
   - Container CPU utilization
   - Container memory utilization

## Cost Estimation

### Free Tier (Monthly):
- ✅ 2 million requests
- ✅ 360,000 GB-seconds memory
- ✅ 180,000 vCPU-seconds

### Typical Usage for Bingo Game:
- **WebSocket connections:** ~100 concurrent players
- **CPU usage:** Low (just game loops)
- **Memory:** ~256 MB
- **Estimated cost:** **$0-5/month** (likely free!)

### To Stay in Free Tier:
- Use smallest instance (256 MB RAM, 1 vCPU)
- Set min instances to 0 (scale to zero when idle)
- Set max instances to 1-2

```bash
gcloud run services update BingoX-bingo-socket \
  --min-instances 0 \
  --max-instances 2 \
  --memory 256Mi \
  --cpu 1 \
  --region us-central1
```

## Troubleshooting

### Deployment fails?

**Check Docker build:**
```bash
docker build -t test-socket .
docker run -p 3001:3001 test-socket
```

**Check logs:**
```bash
gcloud run logs read BingoX-bingo-socket --region us-central1
```

### Socket.IO not connecting?

1. **Check CORS:** Make sure your app URL is in CORS origins
2. **Check port:** Cloud Run should expose port 3001
3. **Check URL:** Use the full Cloud Run URL with `https://`

### Games not progressing?

1. **Check environment variables:**
   ```bash
   gcloud run services describe BingoX-bingo-socket --region us-central1
   ```
2. **Check Supabase connection:** Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
3. **Check logs:** Look for errors in Cloud Run logs

### Cold starts?

Cloud Run may "sleep" when idle. To keep it warm:

```bash
# Set min instances to 1 (costs ~$5/month)
gcloud run services update BingoX-bingo-socket \
  --min-instances 1 \
  --region us-central1
```

Or use a cron job to ping it every 5 minutes (free):
```bash
# Create Cloud Scheduler job
gcloud scheduler jobs create http keep-socket-warm \
  --schedule="*/5 * * * *" \
  --uri="https://BingoX-bingo-socket-xxxxx-uc.a.run.app/health" \
  --http-method=GET
```

## Updating Your Deployment

### Quick Update:
```bash
# Make changes to code
# Then redeploy
gcloud run deploy BingoX-bingo-socket --source . --region us-central1
```

### With Docker:
```bash
docker build -t BingoX-bingo-socket .
docker tag BingoX-bingo-socket gcr.io/BingoX-bingo-bot/socket-server
docker push gcr.io/BingoX-bingo-bot/socket-server
gcloud run deploy BingoX-bingo-socket \
  --image gcr.io/BingoX-bingo-bot/socket-server \
  --region us-central1
```

## Comparison: Firebase vs Others

| Feature | Firebase Cloud Run | Railway | Render |
|---------|-------------------|---------|--------|
| Free Tier | ✅ 2M requests | ✅ $5 credit | ✅ 750 hrs |
| WebSockets | ✅ Yes | ✅ Yes | ✅ Yes |
| Auto-scale | ✅ Yes | ✅ Yes | ✅ Yes |
| Cold starts | ⚠️ Yes (can fix) | ✅ No | ⚠️ Yes |
| Setup | ⚠️ Medium | ✅ Easy | ✅ Easy |
| Monitoring | ✅ Excellent | ✅ Good | ✅ Good |

## Recommended: Firebase Cloud Run

**Best for:**
- ✅ Free tier is generous
- ✅ Scales automatically
- ✅ Google Cloud infrastructure
- ✅ Integrates with Firebase services
- ✅ Professional monitoring

**Use Railway/Render if:**
- You want simpler setup
- You don't need Firebase features
- You prefer always-on (no cold starts)

## Next Steps

1. ✅ Deploy Socket.IO server to Cloud Run
2. ✅ Update `NEXT_PUBLIC_SOCKET_URL` in Vercel
3. ✅ Test game flow
4. ✅ Monitor logs for a few days
5. ✅ Optimize instance settings if needed
6. 🎉 Enjoy reliable game progression!
