# 🚨 CRITICAL: 406 Error Fix

## The Problem
`GET https://mrayxghardqswonihwjs.supabase.co/rest/v1/game_players?select=id&game_id=eq...&user_id=eq... 406 (Not Acceptable)`

## Root Cause
The 406 error happens when Supabase API cannot return data in the requested format. This is usually caused by:
1. Missing environment variables in Vercel
2. RLS policies blocking the request
3. Missing columns in the database

## Solution Steps

### Step 1: Verify Environment Variables in Vercel
Go to: https://vercel.com/dashboard → Select `miniapp` project → Settings → Environment Variables

**Required Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` = `https://mrayxghardqswonihwjs.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `[Your Anon Key]`

**If missing, add them and redeploy!**

### Step 2: Disable RLS in Supabase
Run this in Supabase SQL Editor:

```sql
-- Disable RLS completely
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
```

### Step 3: Add Missing Column
```sql
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS selected_numbers jsonb DEFAULT '[]'::jsonb;
```

### Step 4: Verify Table Structure
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'game_players';
```

Should show:
- id
- game_id
- user_id
- card
- marked_numbers
- selected_numbers ← **MUST EXIST**
- paid
- created_at

### Step 5: Test Direct API Call
Open browser console and run:

```javascript
fetch('https://mrayxghardqswonihwjs.supabase.co/rest/v1/game_players?select=id&limit=1', {
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log)
```

If this returns 406, the issue is with Supabase configuration, not the code.

### Step 6: Alternative - Use Service Role Key
If nothing works, temporarily use the service role key (DANGEROUS - only for testing):

In `/miniapp/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[SERVICE_ROLE_KEY]
```

⚠️ **WARNING**: Service role key bypasses ALL security. Only use for testing!

## Most Likely Issue
**Environment variables are missing in Vercel deployment.**

Check: https://vercel.com/dashboard → miniapp → Settings → Environment Variables

If they're missing, add them and click "Redeploy" on the latest deployment.
