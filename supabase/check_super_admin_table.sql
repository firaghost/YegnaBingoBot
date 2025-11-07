-- Check if super_admins table exists and its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'super_admins'
ORDER BY 
    ordinal_position;

-- If the table doesn't exist or has wrong structure, run this:
-- DROP TABLE IF EXISTS super_admins CASCADE;
