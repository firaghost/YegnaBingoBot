-- Force Supabase to refresh its schema cache
-- Run this after creating the withdrawals table

-- First, verify the foreign key exists
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='withdrawals';

-- If the above query shows the foreign key, then run this to refresh:
NOTIFY pgrst, 'reload schema';

-- Alternative: You can also go to Supabase Dashboard → Settings → API → "Reload Schema Cache"
