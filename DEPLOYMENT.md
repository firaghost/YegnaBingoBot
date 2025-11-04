# 🚀 Deployment Guide

Complete guide for deploying Bingo Vault to production.

## 🎯 Deployment Options

### Option 1: Vercel (Recommended)
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Easy deployment
- ✅ Built-in CI/CD

### Option 2: Railway
- ✅ Free tier available
- ✅ Good for Node.js apps
- ✅ Simple setup

### Option 3: Heroku
- ✅ Well documented
- ⚠️ No longer has free tier

## 📦 Vercel Deployment (Detailed)

### Prerequisites
- Vercel account (free)
- GitHub account (optional, for auto-deploy)
- All environment variables ready

### Step 1: Prepare Project

1. Ensure all dependencies are in `package.json`
2. Test locally first
3. Commit all changes to git

### Step 2: Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name? bingo-vault
# - Directory? ./
# - Override settings? No
```

### Step 3: Configure Environment Variables

**Via CLI:**
```bash
vercel env add BOT_TOKEN
# Paste your token when prompted

vercel env add SUPABASE_URL
# Paste your URL

vercel env add SUPABASE_KEY
# Paste your key

vercel env add ADMIN_PASSWORD
# Paste your password

vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste your URL

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste your anon key
```

**Via Dashboard:**
1. Go to vercel.com
2. Select your project
3. Settings > Environment Variables
4. Add each variable for all environments (Production, Preview, Development)

### Step 4: Set Telegram Webhook

```bash
# Replace <TOKEN> and <YOUR_VERCEL_URL>
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<YOUR_VERCEL_URL>/api/webhook",
    "allowed_updates": ["message", "callback_query"]
  }'
```

**Verify:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app.vercel.app/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Step 5: Deploy Dashboard

```bash
cd dashboard
vercel --prod
```

Your dashboard will be at a separate URL.

### Step 6: Test Production

1. **Test Bot:**
   - Send `/start` to your bot
   - Try all commands
   - Submit a test receipt

2. **Test Dashboard:**
   - Login at `https://your-dashboard.vercel.app/login`
   - Check all pages load
   - Try approving a payment

## 🔄 Continuous Deployment

### Connect to GitHub

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/bingo-vault.git
git push -u origin main
```

2. Connect in Vercel:
   - Go to vercel.com
   - Import Project
   - Select your GitHub repo
   - Configure settings
   - Deploy

Now every push to `main` will auto-deploy!

## 🌍 Custom Domain (Optional)

### Add Domain to Vercel

1. Go to Project Settings > Domains
2. Add your domain (e.g., `bingo.yourdomain.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (~24 hours)

### Update Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://bingo.yourdomain.com/api/webhook"}'
```

## 📊 Monitoring & Logs

### View Logs

**Real-time:**
```bash
vercel logs --follow
```

**Recent logs:**
```bash
vercel logs
```

**Filter by function:**
```bash
vercel logs api/webhook
```

### Set Up Alerts

1. Go to Vercel Dashboard
2. Project Settings > Integrations
3. Add monitoring tools:
   - Sentry (error tracking)
   - LogDNA (log management)
   - Better Uptime (uptime monitoring)

## 🔐 Security Best Practices

### Environment Variables
- ✅ Never commit `.env` to git
- ✅ Use different keys for dev/prod
- ✅ Rotate keys periodically
- ✅ Use Vercel's encrypted storage

### Webhook Security
- ✅ Always use HTTPS
- ✅ Validate webhook requests
- ✅ Implement rate limiting

### Database Security
- ✅ Enable Supabase RLS
- ✅ Use service_role key only server-side
- ✅ Regular backups
- ✅ Monitor for suspicious activity

## 🔧 Production Configuration

### Optimize Performance

**1. Enable caching:**
```javascript
// In vercel.json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

**2. Optimize database queries:**
```javascript
// Use select() to get only needed fields
const { data } = await supabase
  .from('users')
  .select('id, balance')  // Not select('*')
  .eq('telegram_id', id);
```

**3. Add database indexes:**
```sql
-- Already in schema.sql
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_payments_status ON payments(status);
```

### Error Handling

**1. Add global error handler:**
```javascript
// In api/webhook.js
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  // Send to error tracking service
  // Sentry.captureException(err);
});
```

**2. Implement retry logic:**
```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

## 📈 Scaling Considerations

### Database
- Monitor query performance
- Add indexes as needed
- Consider read replicas for high traffic
- Implement connection pooling

### Bot
- Use webhook (not polling) in production
- Implement message queue for high volume
- Cache frequently accessed data
- Use Vercel Edge Functions for lower latency

### Dashboard
- Enable Next.js ISR (Incremental Static Regeneration)
- Use CDN for static assets
- Implement pagination for large lists
- Add loading states

## 🔄 Update & Rollback

### Deploy New Version

```bash
# Make changes
git add .
git commit -m "Update feature"
git push

# Or manually
vercel --prod
```

### Rollback

**Via CLI:**
```bash
vercel rollback
```

**Via Dashboard:**
1. Go to Deployments
2. Find previous working deployment
3. Click "Promote to Production"

## 🧪 Testing in Production

### Smoke Tests

```bash
# Test bot webhook
curl https://your-app.vercel.app/api/webhook

# Test dashboard
curl https://your-dashboard.vercel.app

# Test database connection
# Use Supabase dashboard to run test queries
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create test script (test.yml)
# Run load test
artillery run test.yml
```

## 📋 Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] Webhook URL set correctly
- [ ] Admin password is strong
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Backups enabled
- [ ] Monitoring set up
- [ ] Documentation updated

## 🆘 Troubleshooting

### Deployment Fails

**Check build logs:**
```bash
vercel logs --since 1h
```

**Common issues:**
- Missing dependencies in package.json
- Environment variables not set
- Build script errors
- Node version mismatch

### Webhook Not Working

**Debug steps:**
1. Check webhook info:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

2. Check Vercel logs:
```bash
vercel logs api/webhook --follow
```

3. Test endpoint:
```bash
curl https://your-app.vercel.app/api/webhook
```

### Database Connection Issues

**Solutions:**
1. Verify Supabase URL and key
2. Check if project is paused (free tier)
3. Review RLS policies
4. Check connection limits

## 🎉 Post-Deployment

### Announce Launch
1. Test all features thoroughly
2. Prepare user documentation
3. Announce to your community
4. Monitor closely for first 24 hours

### Regular Maintenance
- Check logs daily
- Monitor error rates
- Review user feedback
- Update dependencies monthly
- Backup database weekly

---

**Congratulations! Your Bingo Vault is now live! 🎮**
