# Game Status Migration Guide

## Overview
This migration adds intelligent game status tracking to properly categorize all games in the system. It analyzes each game's state and assigns the correct status.

## New Game Status Values

| Status | Meaning | Conditions |
|--------|---------|-----------|
| `waiting` | Waiting for players to join | status='waiting' |
| `countdown` | Countdown before game starts | status='countdown' |
| `active` | Game is currently running | status='active' |
| `finished` | Game completed with a winner | Has winner_id + started_at + ended_at |
| `canceled` | Game canceled before starting | No players, no numbers called, no winner, no times |
| `no_winner` | Game played but no winner claimed | Has players + numbers called + times, but no winner |

## Status Detection Logic

### CANCELED Games
```
Conditions:
- status = 'finished'
- started_at IS NULL OR ended_at IS NULL
- players array is empty (0 players)
- called_numbers array is empty (0 numbers)
- winner_id IS NULL

Example: User joins waiting room, then exits before game starts
```

### NO_WINNER Games
```
Conditions:
- status = 'finished'
- started_at IS NOT NULL
- ended_at IS NOT NULL
- players array has items (> 0 players)
- called_numbers array has items (> 0 numbers)
- winner_id IS NULL

Example: Game runs, numbers are called, but no one claims bingo
```

### FINISHED Games
```
Conditions:
- status = 'finished'
- started_at IS NOT NULL
- ended_at IS NOT NULL
- winner_id IS NOT NULL

Example: Game completed with a winner
```

### ACTIVE/COUNTDOWN/WAITING Games
```
Keep original status as-is
```

## How to Run the Migration

### Step 1: Backup Your Database
```bash
# In Supabase dashboard, create a backup before running migration
```

### Step 2: Run the Migration Script
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the entire contents of `migrate_game_status.sql`
4. Click "Run" button
5. Wait for completion

### Step 3: Verify Results
The script will show:
- ✅ Statistics of games by status
- ✅ Examples of each status type
- ✅ Data integrity checks
- ✅ Migration completion summary

### Step 4: Update Frontend (Already Done!)
The Games page now uses `game_status` to display:
- 🟠 **Canceled** badge (orange)
- 🔴 **No Winner** badge (red)
- 🟢 **Active** badge (emerald, pulsing)
- 🔵 **Finished** badge (cyan)
- 🟡 **Waiting** badge (yellow)

## What Gets Updated

### Games Table Changes
```sql
-- New column added
ALTER TABLE games ADD COLUMN game_status TEXT DEFAULT 'active';

-- Index created for performance
CREATE INDEX idx_games_game_status ON games(game_status);
```

### Data Transformation
- All existing games are analyzed
- Correct status is assigned based on game state
- No data is deleted or lost
- Original `status` column remains unchanged

## Verification Checks

The migration includes integrity checks for:
1. ✅ Games with status=finished but no game_status set
2. ✅ Games with winner but game_status != finished
3. ✅ Canceled games that have players (should be 0)
4. ✅ No_winner games without start/end times

## Rollback (If Needed)

If you need to rollback:
```sql
-- Remove the new column
ALTER TABLE games DROP COLUMN IF EXISTS game_status;

-- Remove the index
DROP INDEX IF EXISTS idx_games_game_status;

-- Remove the function
DROP FUNCTION IF EXISTS determine_game_status;
```

## Expected Results

After migration, you should see:
- **Canceled games**: Games that were created but never started (0 players)
- **No_winner games**: Games that ran but no one won
- **Finished games**: Games with a winner
- **Active games**: Currently running games
- **Countdown games**: Games in countdown phase
- **Waiting games**: Games waiting for players

## Performance Impact

- ✅ Minimal impact: Migration runs once
- ✅ New index improves query performance
- ✅ No ongoing performance penalty
- ✅ Queries using game_status will be faster

## Next Steps

1. ✅ Run migration script
2. ✅ Verify results in Supabase dashboard
3. ✅ Check Games page in admin portal
4. ✅ Confirm all statuses display correctly

## Support

If you encounter issues:
1. Check the integrity check results in the migration output
2. Verify the function was created: `SELECT * FROM pg_proc WHERE proname = 'determine_game_status';`
3. Check the index was created: `SELECT * FROM pg_indexes WHERE tablename = 'games';`
4. Review the migration script comments for detailed logic
