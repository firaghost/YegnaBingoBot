# 🔍 Debug Auto-Complete Issue

## Problem:
Games are being marked as "completed" when the 2nd player joins, with:
- Prize Pool: 0 Birr
- Numbers Called: 0
- No winner

## Debugging Steps:

### 1. Check Supabase Database Triggers

Go to Supabase Dashboard → Database → Triggers

Look for any triggers on the `games` table that might be auto-updating status to 'completed'.

**SQL to check:**
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'games';
```

### 2. Check Supabase Functions

Go to Supabase Dashboard → Database → Functions

Look for any functions that update game status.

**SQL to check:**
```sql
SELECT 
  routine_name, 
  routine_definition
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
AND routine_schema = 'public';
```

### 3. Check RLS Policies

Go to Supabase Dashboard → Authentication → Policies

Look at policies on `games` table.

**SQL to check:**
```sql
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies
WHERE tablename = 'games';
```

### 4. Add Logging to Track Updates

Run this SQL to see what's updating games:

```sql
-- Create audit log table
CREATE TABLE IF NOT EXISTS game_status_audit (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID,
  old_status TEXT,
  new_status TEXT,
  changed_at TIMESTAMP DEFAULT NOW(),
  changed_by TEXT
);

-- Create trigger function
CREATE OR REPLACE FUNCTION log_game_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO game_status_audit (game_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, current_user);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS game_status_change_trigger ON games;
CREATE TRIGGER game_status_change_trigger
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION log_game_status_change();
```

### 5. Check Logs After 2nd Player Joins

After a player joins and game is marked completed, run:

```sql
SELECT * FROM game_status_audit 
ORDER BY changed_at DESC 
LIMIT 10;
```

This will show WHO/WHAT is changing the status.

### 6. Temporary Fix - Prevent Status Change

While debugging, prevent games from being marked completed unless there's a winner:

```sql
-- Create validation function
CREATE OR REPLACE FUNCTION prevent_invalid_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow completion if there's a winner and prize pool
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.winner_id IS NULL THEN
      RAISE EXCEPTION 'Cannot complete game without a winner';
    END IF;
    IF NEW.prize_pool IS NULL OR NEW.prize_pool = 0 THEN
      RAISE EXCEPTION 'Cannot complete game with 0 prize pool';
    END IF;
    IF NEW.called_numbers IS NULL OR array_length(NEW.called_numbers, 1) = 0 THEN
      RAISE EXCEPTION 'Cannot complete game without calling numbers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_invalid_completion_trigger ON games;
CREATE TRIGGER prevent_invalid_completion_trigger
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invalid_completion();
```

### 7. Check Application Logs

Look at Vercel logs for miniapp when 2nd player joins:

1. Go to Vercel Dashboard
2. Select miniapp project
3. Go to Deployments → Latest → View Function Logs
4. Filter for "completed" or "endGame"

### 8. Test Locally with Logging

1. Copy `.env.local.example` to `.env.local` in miniapp
2. Run miniapp locally: `cd miniapp && npm run dev`
3. Open browser console
4. Join game with 2 players
5. Watch console for:
   - "checkBingo called"
   - "Game not active"
   - "endGame"
   - Any errors

## Expected Behavior:

When 2nd player joins:
1. ✅ Game status should change to 'countdown' (if auto-start enabled)
2. ✅ Game status should stay 'waiting' (if manual start)
3. ❌ Game status should NEVER be 'completed'

## Likely Causes:

1. **Database trigger** auto-completing games
2. **Supabase function** being called on insert/update
3. **RLS policy** with side effects
4. **Race condition** in check-countdown API
5. **Bug in endGame** being called with invalid data

## Next Steps:

1. Run SQL queries above in Supabase SQL Editor
2. Check for triggers/functions
3. Add audit logging
4. Test locally with console logging
5. Report findings

---

**Status**: Investigating
**Priority**: CRITICAL
