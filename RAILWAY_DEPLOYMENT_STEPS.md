# 🚀 Railway Deployment Guide - BingoX Waiting Room System

## 🎯 **Issue**: Railway is running old socket server instead of new waiting room system

## ✅ **Solution**: Deploy the new integrated system

### **Step 1: Update Database Schema**

Run these SQL scripts in your **Supabase SQL Editor** (in order):

```sql
-- 1. First run: supabase/levels_system_simple.sql
-- 2. Then run: supabase/waiting_room_schema.sql  
-- 3. Then run: supabase/ingame_synchronization_schema.sql
-- 4. Finally run: supabase/fix_foreign_key_constraints.sql
```

### **Step 2: Deploy to Railway**

1. **Commit and push your changes**:
   ```bash
   git add .
   git commit -m "Add waiting room + in-game synchronization system"
   git push origin main
   ```

2. **Railway will automatically redeploy** with the new `start:socket` command that now uses `railway-production-server.ts`

### **Step 3: Verify Deployment**

1. **Check Railway logs** for the new startup message:
   ```
   🎮 BINGOX PRODUCTION SERVER STARTED!
   🏠 Waiting Room System (Phase 1)
   🎮 In-Game Synchronization (Phase 2)
   ```

2. **Test the health endpoint**:
   ```
   https://your-railway-domain.railway.app/health
   ```

3. **Check waiting rooms endpoint**:
   ```
   https://your-railway-domain.railway.app/api/rooms/waiting
   ```

### **Step 4: Test the New System**

1. **Open your frontend** (https://yegnagame.vercel.app)
2. **Join a game** - you should see the new waiting room behavior:
   - Players matched by difficulty level
   - 10-second countdown when 2+ players
   - Seamless transition to in-game mode
   - Real-time number calling
   - Spectator mode available

### **What Changed**

**Before (Old System)**:
- Single socket server with basic game logic
- No waiting room matchmaking
- No spectator mode
- No reconnect handling

**After (New System)**:
- ✅ **Waiting Room System** - Smart matchmaking by level
- ✅ **In-Game Synchronization** - Real-time number calling  
- ✅ **Spectator Mode** - Watch ongoing games
- ✅ **Reconnect Handling** - 30-second grace period
- ✅ **Database Persistence** - Full game state tracking

### **Expected Railway Logs**

```
🚀 BingoX Production Server Starting...
🌐 Frontend URL: https://yegnagame.vercel.app
🎮 ========================================
🎮 BINGOX PRODUCTION SERVER STARTED!
🎮 ========================================

🚀 Server running on port 3001
🌐 Health check: https://your-domain.railway.app/health
📊 Admin stats: https://your-domain.railway.app/api/admin/stats

🔌 Socket.IO Features Available:
   🏠 Waiting Room System (Phase 1)
   🎮 In-Game Synchronization (Phase 2)
   👁️ Spectator Mode
   🔄 Reconnect Handling (30s grace)
   📢 Real-time Number Calling

✅ Ready for multiplayer BingoX games!
```

### **Troubleshooting**

**If Railway still shows old logs**:
1. Check that your `package.json` has the updated `start:socket` command
2. Force redeploy in Railway dashboard
3. Check Railway environment variables are set correctly

**If database errors occur**:
1. Ensure all SQL scripts ran successfully in Supabase
2. Check Supabase connection string in Railway environment variables
3. Verify RLS policies are enabled

**If frontend can't connect**:
1. Check CORS settings include your Vercel domain
2. Verify Railway service is running on correct port
3. Test Socket.IO connection directly

### **Environment Variables Needed**

```env
# Railway Environment Variables
NODE_ENV=production
PORT=3001
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=https://yegnagame.vercel.app
```

---

## 🎉 **After Deployment**

Your BingoX game will have:

- 🏠 **Smart Waiting Rooms** - Players matched by skill level
- ⏰ **Automatic Game Start** - 10s countdown when ready
- 🎮 **Real-Time Gameplay** - Live number calling and synchronization
- 👁️ **Spectator Mode** - Watch games in progress
- 🔄 **Reconnect Support** - 30-second grace period for disconnects
- 🏆 **Bingo Validation** - Server-side claim verification
- 📊 **Admin Dashboard** - Monitor active games and players

**Your multiplayer BingoX experience is now complete!** 🎮🚀
