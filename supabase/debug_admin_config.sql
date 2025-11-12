-- Debug admin_config table and functions

-- 1. Check if admin_config table exists and has data
SELECT 'admin_config table check' as test;
SELECT COUNT(*) as total_records FROM admin_config;
SELECT * FROM admin_config LIMIT 10;

-- 2. Check if functions exist
SELECT 'Functions check' as test;
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('get_config', 'set_admin_config');

-- 3. Test get_config function
SELECT 'Testing get_config function' as test;
SELECT get_config('app_name') as app_name_result;

-- 4. Test set_admin_config function
SELECT 'Testing set_admin_config function' as test;
SELECT set_admin_config('test_key', '"test_value"', NULL) as set_result;

-- 5. Verify the test insert worked
SELECT 'Verify test insert' as test;
SELECT * FROM admin_config WHERE config_key = 'test_key';

-- 6. Check table permissions
SELECT 'Table permissions check' as test;
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasinserts,
    hasselects,
    hasupdates,
    hasdeletes
FROM pg_tables 
WHERE tablename = 'admin_config';

-- 7. Check RLS (Row Level Security) policies
SELECT 'RLS policies check' as test;
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
WHERE tablename = 'admin_config';
