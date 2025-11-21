-- ============================================
-- WALLET V2 MIGRATION & DIAGNOSTIC TOOLS (SAFE)
-- NOTE: This file is meant to be run manually in Supabase,
-- NOT as an automatic migration. It does NOT move any money.
-- ============================================

-- 1) View: high-level wallet and deposit snapshot per user
DROP VIEW IF EXISTS wallet_v2_migration_report;
CREATE OR REPLACE VIEW wallet_v2_migration_report AS
SELECT
  u.id                                    AS user_id,
  u.username,
  u.telegram_id,
  COALESCE(u.balance, 0)                 AS real_balance,
  COALESCE(u.bonus_balance, 0)           AS bonus_balance,
  COALESCE(u.bonus_win_balance, 0)       AS bonus_locked_balance,
  COALESCE(u.has_made_deposit, FALSE)    AS has_made_deposit,
  COALESCE((
    SELECT SUM(t.amount)
    FROM transactions t
    WHERE t.user_id = u.id
      AND t.type = 'deposit'
      AND t.status = 'completed'
  ), 0)                                   AS total_real_deposits,
  COALESCE((
    SELECT SUM(CASE WHEN t.type = 'win' THEN t.amount ELSE 0 END)
    FROM transactions t
    WHERE t.user_id = u.id
  ), 0)                                   AS total_win_amount,
  COALESCE((
    SELECT SUM(CASE WHEN t.type = 'win' AND (t.metadata->>'credited_to') = 'bonus_win' THEN t.amount ELSE 0 END)
    FROM transactions t
    WHERE t.user_id = u.id
  ), 0)                                   AS total_bonus_win_amount
FROM users u;

COMMENT ON VIEW wallet_v2_migration_report IS 'Diagnostic view for wallet v2 rollout: per-user balances and deposits. Read-only; does not modify data.';

-- 2) Function: list users who appear to be "bonus only" (no real deposits)
DROP FUNCTION IF EXISTS wallet_v2_list_bonus_only_users();
CREATE OR REPLACE FUNCTION wallet_v2_list_bonus_only_users()
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  telegram_id TEXT,
  real_balance NUMERIC,
  bonus_balance NUMERIC,
  bonus_locked_balance NUMERIC,
  total_real_deposits NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.user_id,
    r.username,
    r.telegram_id::TEXT,
    r.real_balance,
    r.bonus_balance,
    r.bonus_locked_balance,
    r.total_real_deposits
  FROM wallet_v2_migration_report r
  WHERE COALESCE(r.total_real_deposits,0) <= 0
    AND (COALESCE(r.real_balance,0) > 0 OR COALESCE(r.bonus_locked_balance,0) > 0 OR COALESCE(r.bonus_balance,0) > 0)
  ORDER BY (r.real_balance + r.bonus_balance + r.bonus_locked_balance) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION wallet_v2_list_bonus_only_users() IS 'Returns users with no completed deposits but non-zero wallet balances (for manual review).';

-- 3) Function: list users with deposits and significant locked bonus
DROP FUNCTION IF EXISTS wallet_v2_list_locked_with_deposits(NUMERIC);
CREATE OR REPLACE FUNCTION wallet_v2_list_locked_with_deposits(
  p_min_locked NUMERIC DEFAULT 1
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  telegram_id TEXT,
  real_balance NUMERIC,
  bonus_balance NUMERIC,
  bonus_locked_balance NUMERIC,
  total_real_deposits NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.user_id,
    r.username,
    r.telegram_id::TEXT,
    r.real_balance,
    r.bonus_balance,
    r.bonus_locked_balance,
    r.total_real_deposits
  FROM wallet_v2_migration_report r
  WHERE COALESCE(r.total_real_deposits,0) > 0
    AND COALESCE(r.bonus_locked_balance,0) >= COALESCE(p_min_locked,1)
  ORDER BY r.bonus_locked_balance DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION wallet_v2_list_locked_with_deposits(NUMERIC) IS 'Returns users who have both real deposits and non-trivial locked bonus balances, for potential unlock review.';

-- 4) Usage notes (for Supabase SQL editor)
--
--   -- Overview of all users
--   SELECT * FROM wallet_v2_migration_report ORDER BY total_real_deposits DESC;
--
--   -- Users with no deposits but some balance (bonus-only candidates)
--   SELECT * FROM wallet_v2_list_bonus_only_users();
--
--   -- Users with deposits and large locked bonus (e.g. >= 1000 ETB)
--   SELECT * FROM wallet_v2_list_locked_with_deposits(1000);
--
-- These helpers are READ-ONLY. Any corrective actions should be taken
-- manually by admins (e.g. via existing admin tools) after reviewing
-- the data and notifying affected users.
-- ============================================
