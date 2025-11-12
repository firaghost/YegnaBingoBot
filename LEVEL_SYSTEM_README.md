# 🎮 BingoX Dynamic Level System & XP Leaderboard

## Overview

This implementation adds a comprehensive **dynamic game level system** and **real-time XP-based leaderboard** to your BingoX Telegram betting game. Players can now choose difficulty levels, earn XP based on performance, and compete on weekly/monthly leaderboards with automatic rank progression.

## 🎯 Features Implemented

### 🎮 Dynamic Game Levels
- **Easy**: 1-second intervals, 3 matches to win, 10 XP reward
- **Medium**: 2-second intervals, 5 matches to win, 25 XP reward  
- **Hard**: 3-second intervals, 7 matches to win, 50 XP reward

### 🏆 XP & Ranking System
- **Beginner** (0-100 XP): 🌱 New players starting their journey
- **Skilled** (101-300 XP): 💪 Developing players with some wins
- **Expert** (301-600 XP): ⭐ Experienced players with consistent performance
- **Master** (601-1000 XP): 🔥 Elite players with high skill
- **Legend** (1000+ XP): 👑 Top-tier players with exceptional performance

### 📊 Leaderboard System
- **Weekly Rankings**: Reset every week, track short-term performance
- **Monthly Rankings**: Reset every month, track long-term consistency
- **Historical Archives**: Previous rankings are preserved
- **Real-time Updates**: Ranks recalculated after each game

## 📁 Files Created/Modified

### Database Schema
- `supabase/levels_and_leaderboard_system.sql` - Complete database setup

### Bot Handlers
- `lib/level-handlers.ts` - New level system and leaderboard commands
- `bot/telegram-bot.ts` - Updated to include level handlers
- `lib/gameSimulator.ts` - Enhanced with difficulty level support

### API Endpoints
- `app/api/game/complete/route.ts` - Handle game completion with XP rewards
- `app/api/leaderboard/route.ts` - Enhanced leaderboard data and admin operations

### Setup & Documentation
- `setup-levels-system.ps1` - PowerShell setup script
- `LEVEL_SYSTEM_README.md` - This documentation file

## 🚀 Installation Steps

### 1. Database Setup
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase/levels_and_leaderboard_system.sql`
4. Execute the SQL script

### 2. Environment Configuration
Add to your `.env.local` file:
```env
ADMIN_API_KEY=your_secure_admin_key_here
```

### 3. Bot Restart
Restart your bot application to load the new handlers and commands.

## 🎮 New Bot Commands

### Player Commands
- `/levels` - View available difficulty levels and their rewards
- `/leaderboard` - View weekly leaderboard rankings
- `/mystats` - View personal XP, rank, and statistics

### Admin Commands
- `/setxp <level> <amount>` - Update XP reward for a difficulty level
  - Example: `/setxp hard 75`
- `/resetleaderboard <period>` - Reset weekly or monthly leaderboard
  - Example: `/resetleaderboard weekly`

## 🔧 API Endpoints

### Game Completion
```http
POST /api/game/complete
Content-Type: application/json

{
  "userId": "telegram_user_id",
  "result": "win|lose",
  "levelName": "easy|medium|hard",
  "gameId": "optional_game_id"
}
```

### Leaderboard Data
```http
GET /api/leaderboard?period=weekly&limit=10&userId=123456789
```

### Admin Operations
```http
POST /api/leaderboard
Content-Type: application/json

{
  "action": "reset|recalculate",
  "period": "weekly|monthly",
  "adminKey": "your_admin_key"
}
```

## 🗄️ Database Schema

### New Tables

#### `levels`
```sql
- id (serial, primary key)
- name (text, unique) - 'easy', 'medium', 'hard'
- call_interval (integer) - milliseconds between calls
- win_threshold (integer) - matches needed to win
- xp_reward (integer) - XP awarded on win
- description (text) - level description
- created_at (timestamp)
```

#### `leaderboard`
```sql
- id (serial, primary key)
- user_id (uuid, foreign key to users)
- period (text) - 'weekly' or 'monthly'
- wins (integer) - wins in this period
- xp (integer) - XP earned in this period
- rank (integer) - calculated position
- updated_at (timestamp)
```

#### `leaderboard_history`
```sql
- id (serial, primary key)
- user_id (uuid, foreign key to users)
- period (text) - period type
- period_start (date) - period start date
- period_end (date) - period end date
- final_rank (integer) - final position
- final_wins (integer) - final win count
- final_xp (integer) - final XP earned
- archived_at (timestamp)
```

### Extended Tables

#### `users` (new columns)
```sql
- xp (integer, default 0) - lifetime XP
- total_wins (integer, default 0) - lifetime wins
- level_progress (text, default 'Beginner') - current rank
```

#### `games` (new column)
```sql
- level_name (text, default 'medium') - difficulty level
```

## 🔧 Key Functions

### Supabase RPC Functions

#### `update_player_stats(user_id, xp)`
Updates user XP and leaderboard entries when a player wins.

#### `calculate_leaderboard_ranks(period)`
Recalculates all ranks for a given period (weekly/monthly).

#### `reset_leaderboard(period)`
Archives current rankings and resets leaderboard for new period.

#### `get_level_settings(level_name)`
Retrieves configuration for a specific difficulty level.

### TypeScript Functions

#### `handleGameCompletion(userId, result, levelName)`
Processes game completion and awards XP for wins.

#### `getRankEmoji(rank)` & `getNextRank(currentXP)`
Helper functions for displaying ranks and progression.

## 🎯 Game Flow Integration

### 1. Level Selection
Players choose difficulty when starting a game:
- Easy games finish faster but give less XP
- Hard games take longer but give more XP

### 2. Game Completion
When a game ends:
- Winners receive XP based on difficulty level
- Leaderboards are updated in real-time
- Rank progression is checked and applied
- Players are notified of XP gain and rank changes

### 3. Leaderboard Updates
- Weekly and monthly leaderboards track separate periods
- Ranks are recalculated after each game
- Historical data is preserved when periods reset

## 📊 Admin Management

### Monitoring
- View current leaderboard standings
- Check player progression and engagement
- Monitor XP distribution across difficulty levels

### Configuration
- Adjust XP rewards for different difficulty levels
- Reset leaderboards manually if needed
- Archive and review historical performance data

### Analytics
- Track which difficulty levels are most popular
- Monitor player retention through rank progression
- Analyze competitive engagement through leaderboard participation

## 🔒 Security Considerations

### Admin Access
- Admin commands require verification through `admin_users` table
- API admin operations require `ADMIN_API_KEY`
- All database operations use Row Level Security (RLS)

### Data Integrity
- XP and leaderboard updates are atomic operations
- Historical data is preserved during resets
- Rank calculations are consistent and deterministic

## 🚀 Future Enhancements

### Potential Additions
- **Seasonal Events**: Special XP multipliers during events
- **Achievement System**: Badges for milestones (100 wins, 1000 XP, etc.)
- **Clan System**: Team-based leaderboards and competitions
- **Daily Challenges**: Special objectives for bonus XP
- **Tournament Mode**: Bracket-style competitions with entry fees

### Performance Optimizations
- Implement caching for leaderboard queries
- Add database indexes for common query patterns
- Consider materialized views for complex leaderboard calculations

## 🐛 Troubleshooting

### Common Issues

#### Bot Commands Not Working
- Ensure `setupLevelHandlers(bot)` is called in `startBot()`
- Check that database migration completed successfully
- Verify bot token and Supabase credentials

#### XP Not Updating
- Check that `update_player_stats` RPC function exists
- Verify user exists in database
- Ensure game completion API is being called correctly

#### Leaderboard Empty
- Confirm players have played games and earned XP
- Check that `calculate_leaderboard_ranks` is being called
- Verify leaderboard view permissions

### Database Debugging
```sql
-- Check if levels exist
SELECT * FROM levels;

-- Check user XP data
SELECT username, xp, total_wins, level_progress FROM users WHERE xp > 0;

-- Check leaderboard entries
SELECT * FROM current_leaderboard WHERE period = 'weekly';

-- Check RPC functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%player%' OR routine_name LIKE '%leaderboard%';
```

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all files were created correctly
3. Ensure database migration completed successfully
4. Check bot and application logs for errors

## 🎉 Conclusion

Your BingoX Telegram bot now features a complete dynamic level system with XP-based progression and competitive leaderboards. Players can choose their challenge level, earn XP based on performance, and compete for weekly and monthly rankings with automatic rank progression.

The system is designed to increase player engagement through:
- **Progressive Difficulty**: Players can challenge themselves at their skill level
- **Competitive Elements**: Leaderboards create friendly competition
- **Achievement Recognition**: Rank system provides status and progression goals
- **Retention Mechanics**: Weekly/monthly resets keep competition fresh

Enjoy your enhanced BingoX gaming experience! 🎮🏆
