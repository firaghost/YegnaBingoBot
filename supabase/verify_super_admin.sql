-- Verify Super Admin Account
-- Run this to check if the super admin account exists

SELECT 
    id,
    username,
    email,
    full_name,
    is_active,
    login_attempts,
    locked_until,
    created_at,
    last_login,
    LENGTH(password) as password_length,
    CASE 
        WHEN password LIKE '%:%' THEN 'Hashed (PBKDF2)'
        WHEN password LIKE '$2%' THEN 'Hashed (bcrypt)'
        ELSE 'Plain text'
    END as password_type
FROM super_admins
WHERE username = 'superadmin';

-- If no results, the account doesn't exist
-- If you see results, check:
-- 1. is_active should be TRUE
-- 2. locked_until should be NULL
-- 3. login_attempts should be 0 or low
