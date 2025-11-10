# Testing Guide

## Current Issues & Solutions

### Issue 1: "Login with Telegram" showing for logged-in users

**Cause:** The app checks `isAuthenticated` which relies on localStorage. If you're testing in production, you need to actually log in first.

**Solution:**
1. Go to `/login` page
2. Click "Login with Telegram"
3. In development, it will create a test user automatically
4. You'll be redirected to `/lobby` with authentication

### Issue 2: Telegram WebSocket Errors

**These errors are NORMAL and can be ignored:**
```
WebSocket connection to 'wss://zws4.web.telegram.org/apiws' failed
```

**Why:** These are from Telegram's SDK trying to connect. They don't affect your bingo game functionality. The errors appear because:
- You're testing in a regular browser (not Telegram WebApp)
- Telegram SDK is loaded but can't connect outside Telegram
- Your game uses Supabase Realtime, NOT these WebSockets

**To hide these errors:** Open browser DevTools → Console → Filter out "telegram.org"

### Issue 3: Page Refreshes When Clicking "Join Room"

**Cause:** You're not logged in yet, or the authentication state hasn't loaded.

**Solution:**
1. First, go to `/login` and log in
2. Wait for redirect to `/lobby`
3. You should see your username and balance at the top
4. Now "Join Room" will work

## Testing Flow

### Step 1: Login
```
1. Navigate to: http://localhost:3000/login
2. Click "Login with Telegram"
3. In dev mode, it creates a test user automatically
4. You'll be redirected to /lobby
```

### Step 2: Join a Room
```
1. You should see your username and balance
2. Click "Join Room" on any room card
3. You'll be taken to /game/[roomId]
```

### Step 3: Test Minimum Players (Need 2 browsers)

**Browser 1:**
```
1. Login as TestUser_123
2. Join "Classic Room"
3. You should see: "Waiting for Players 1/2"
```

**Browser 2 (Incognito):**
```
1. Login (creates TestUser_456)
2. Join "Classic Room"
3. Both browsers should now show: "Game Starting In 10s"
```

### Step 4: Test Queue System

**Browser 3:**
```
1. Try to join while game is active
2. Should see: "You're in the queue"
3. Will join next game when current one ends
```

## Development vs Production

### Development (localhost)
- ✅ Auto-creates test users
- ✅ No Telegram required
- ✅ Can test with multiple browsers
- ⚠️ Telegram WebSocket errors (ignore them)

### Production (Telegram WebApp)
- ✅ Real Telegram users
- ✅ No WebSocket errors
- ✅ Proper authentication
- ❌ Can't test without Telegram bot

## Common Issues

### "Please open this app through Telegram"
- **In dev:** Shouldn't happen (we added test user support)
- **In prod:** Expected - must use Telegram bot

### User balance not showing
- Check browser console for errors
- Verify Supabase connection
- Check localStorage has `user_id`

### Game not starting with 2 players
- Run `supabase/update_games_table.sql`
- Check `min_players` column exists
- Verify Realtime is enabled

### Can't join room
- Check user balance >= room stake
- Verify user is authenticated
- Check browser console for errors

## Debugging Commands

### Check if logged in:
```javascript
// In browser console
localStorage.getItem('user_id')
```

### Check Supabase connection:
```javascript
// In browser console
await supabase.from('users').select('count')
```

### Check Realtime subscription:
```javascript
// Look for in console:
"📡 Subscription status: SUBSCRIBED"
```

## Next Steps After Testing

1. ✅ Verify login works
2. ✅ Test with 2 browsers (minimum players)
3. ✅ Test queue system (3rd browser)
4. ✅ Deploy to production
5. ✅ Test in actual Telegram WebApp
6. ✅ Share bot link with users

## Production Deployment Checklist

- [ ] Run `supabase/update_games_table.sql`
- [ ] Enable Realtime on games table
- [ ] Deploy Edge Function (optional)
- [ ] Update environment variables
- [ ] Remove `NEXT_PUBLIC_SOCKET_URL`
- [ ] Test in Telegram WebApp
- [ ] Monitor Supabase logs
