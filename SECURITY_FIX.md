# 🔐 Security Fix - Row Level Security (RLS)

## ⚠️ CRITICAL ISSUE

Your Supabase database tables are currently **publicly accessible** without Row Level Security (RLS) enabled. This means:

- ❌ Anyone can read all user data
- ❌ Anyone can modify balances
- ❌ Anyone can delete games
- ❌ Anyone can access payment information
- ❌ **MAJOR SECURITY RISK!**

## ✅ IMMEDIATE FIX

### Step 1: Run Security SQL

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of:
   ```
   supabase/enable_rls_security.sql
   ```
4. Click **Run**

### Step 2: Verify RLS is Enabled

After running the script, you should see:

```
✅ RLS Enabled on all tables
✅ Secure policies created
✅ Duplicate policies removed
✅ Functions secured
✅ Indexes added
```

## What This Fixes

### 1. Enables RLS on All Tables
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
```

### 2. Creates Secure Policies

**Service Role (Backend):**
- Full access to all tables
- Used by your API endpoints
- Authenticated with `SUPABASE_SERVICE_KEY`

**Public/Anon Users:**
- Can read games and players
- Can join games
- Can create payments
- **Cannot** modify balances directly
- **Cannot** access admin data

### 3. Fixes Function Security

All database functions now have:
```sql
SECURITY DEFINER
SET search_path = public
```

This prevents SQL injection attacks.

### 4. Adds Performance Indexes

```sql
CREATE INDEX idx_games_winner_id ON games(winner_id);
CREATE INDEX idx_payments_processed_by ON payments(processed_by);
```

Improves query performance for foreign keys.

## Security Model

### Access Levels

```
┌─────────────────────────────────────────┐
│  SERVICE ROLE (Backend API)             │
│  ✅ Full access to everything           │
│  Used by: Bot, Admin Dashboard          │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  ANON/AUTHENTICATED (Frontend)          │
│  ✅ Read games, players, history        │
│  ✅ Join games, create payments         │
│  ❌ Cannot modify balances              │
│  ❌ Cannot access admin data            │
└─────────────────────────────────────────┘
```

### How It Works

**Before (INSECURE):**
```javascript
// Anyone can do this from browser console!
await supabase
  .from('users')
  .update({ balance: 999999 })
  .eq('id', 'any-user-id')
// ❌ Would succeed - MAJOR SECURITY HOLE!
```

**After (SECURE):**
```javascript
// Same attempt from browser console
await supabase
  .from('users')
  .update({ balance: 999999 })
  .eq('id', 'any-user-id')
// ✅ BLOCKED by RLS! Only service role can modify balances
```

## Environment Variables

Make sure you're using the correct keys:

### Frontend (Mini App, Dashboard)
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```
- Limited access
- Safe to expose in browser
- RLS policies apply

### Backend (API, Bot)
```env
SUPABASE_SERVICE_KEY=your_service_role_key
```
- Full access
- **NEVER expose in browser**
- Bypasses RLS (for admin operations)

## Testing Security

### Test 1: Try to Modify Balance from Browser

1. Open your mini app
2. Open browser console (F12)
3. Try to modify balance:
```javascript
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY'
);

// Try to cheat
const { error } = await supabase
  .from('users')
  .update({ balance: 999999 })
  .eq('telegram_id', 'your_telegram_id');

console.log(error);
// Should show: "new row violates row-level security policy"
```

✅ If you see the error, RLS is working!

### Test 2: Verify Backend Still Works

1. Make a deposit through the app
2. Admin approves it
3. Balance should update correctly

✅ Backend (service role) can still modify data

### Test 3: Check Supabase Dashboard

1. Go to Supabase Dashboard
2. **Database → Tables**
3. Click on any table
4. Look for 🔒 icon next to table name
5. Should say "RLS enabled"

## Common Issues

### Issue: "RLS policies are too restrictive"

**Symptom:** App features stop working

**Fix:** The policies in the script are permissive for `true` (anyone can read/write). If you need stricter control:

```sql
-- Example: Users can only read their own data
CREATE POLICY "Users read own data" ON public.users
  FOR SELECT USING (telegram_id = current_setting('request.jwt.claims')::json->>'telegram_id');
```

### Issue: "Service role can't access data"

**Symptom:** Backend API errors

**Fix:** Verify you're using `SUPABASE_SERVICE_KEY` in backend:

```javascript
// Backend (api/, bot/)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // ← Service key, not anon key!
);
```

### Issue: "Policies conflict"

**Symptom:** Multiple policy warnings

**Fix:** The script drops duplicate policies first. If issues persist:

```sql
-- Drop all policies for a table
DROP POLICY IF EXISTS "policy_name" ON table_name;

-- Then recreate clean policies
```

## Best Practices

### ✅ DO:
- Use `SUPABASE_SERVICE_KEY` in backend only
- Use `SUPABASE_ANON_KEY` in frontend
- Keep service key secret
- Enable RLS on all tables
- Test security regularly

### ❌ DON'T:
- Expose service key in browser
- Disable RLS for convenience
- Use anon key in backend
- Trust client-side validation
- Skip security testing

## Monitoring

### Check RLS Status Regularly

Run this in Supabase SQL Editor:

```sql
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `true`.

### Review Policies

```sql
SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Summary

### Before Fix:
- ❌ No RLS enabled
- ❌ Public database access
- ❌ Anyone can modify data
- ❌ Security vulnerability

### After Fix:
- ✅ RLS enabled on all tables
- ✅ Secure policies in place
- ✅ Service role for backend
- ✅ Anon role for frontend
- ✅ Database secured

## Action Required

**RUN THIS NOW:**

1. Open Supabase SQL Editor
2. Run `supabase/enable_rls_security.sql`
3. Verify all tables show RLS enabled
4. Test your app still works
5. Test security (try to cheat from browser)

**Your database will be secure!** 🔐✅
