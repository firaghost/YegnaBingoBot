-- ============================================
-- ENABLE REALTIME FOR GAMES TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable Realtime for the games table
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Verify it's enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- You should see 'games' in the results
