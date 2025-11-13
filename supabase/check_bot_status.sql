-- ============================================
-- CHECK BOT STATUS AND GAMES
-- ============================================

-- 1. Check bot players
SELECT 'BOT PLAYERS:' as info;
SELECT 
    name,
    username,
    is_enabled,
    auto_join_enabled
FROM bot_players 
ORDER BY name;

-- 2. Check bot users
SELECT 'BOT USERS:' as info;
SELECT 
    u.username,
    u.is_bot,
    bp.name as bot_name
FROM users u
LEFT JOIN bot_players bp ON u.bot_id = bp.id
WHERE u.is_bot = true
ORDER BY u.username;

-- 3. Check waiting games (including bots)
SELECT 'WAITING GAMES:' as info;
SELECT 
    g.room_id,
    r.name as room_name,
    u.username,
    u.is_bot,
    g.status,
    g.created_at
FROM games g
JOIN rooms r ON g.room_id = r.id
LEFT JOIN users u ON g.user_id = u.id
WHERE g.status = 'waiting'
ORDER BY r.name, u.is_bot DESC, u.username;

-- 4. Count waiting players per room
SELECT 'WAITING PLAYERS COUNT:' as info;
SELECT 
    r.name as room_name,
    COUNT(g.id) as total_waiting,
    COUNT(CASE WHEN u.is_bot = true THEN 1 END) as bot_count,
    COUNT(CASE WHEN u.is_bot = false THEN 1 END) as real_player_count
FROM rooms r
LEFT JOIN games g ON r.id = g.room_id AND g.status = 'waiting'
LEFT JOIN users u ON g.user_id = u.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- 5. Update rooms table with correct waiting_players count
UPDATE rooms 
SET waiting_players = (
    SELECT COUNT(*) 
    FROM games 
    WHERE games.room_id = rooms.id AND games.status = 'waiting'
)
WHERE id IS NOT NULL;

-- 6. Show updated room status
SELECT 'UPDATED ROOM STATUS:' as info;
SELECT 
    name,
    waiting_players,
    stake,
    max_players
FROM rooms 
ORDER BY name;
