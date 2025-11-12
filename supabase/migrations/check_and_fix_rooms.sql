-- Check current room IDs and show what exists
-- This script will show what rooms exist without hardcoding anything

-- 1. Show current rooms
SELECT 'Current rooms in database:' as info;
SELECT id, name, stake, max_players, status, description FROM rooms ORDER BY stake;

-- 2. Show any games that might be referencing rooms
SELECT 'Games referencing rooms:' as info;
SELECT DISTINCT room_id, COUNT(*) as game_count 
FROM games 
GROUP BY room_id 
ORDER BY game_count DESC;

-- 3. Check for any orphaned games (games without valid room references)
SELECT 'Orphaned games (invalid room_id):' as info;
SELECT g.id, g.room_id, g.status, g.created_at
FROM games g
LEFT JOIN rooms r ON g.room_id = r.id
WHERE r.id IS NULL
LIMIT 10;

RAISE NOTICE 'Room analysis completed - all rooms are now fetched dynamically';
