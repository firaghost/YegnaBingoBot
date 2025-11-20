-- Backfill balance snapshots for referral_bonus transactions
-- Date: 2025-11-20

DO $$
DECLARE
  _updated_count INTEGER := 0;
BEGIN
  WITH calc AS (
    SELECT
      t.id,
      t.user_id,
      t.type,
      t.amount::NUMERIC AS amount,
      t.created_at,
      -- delta to REAL balance for all relevant types including referral_bonus
      (
        CASE t.type
          WHEN 'deposit' THEN t.amount::NUMERIC
          WHEN 'withdrawal' THEN t.amount::NUMERIC
          WHEN 'win' THEN CASE WHEN COALESCE(t.metadata->>'credited_to','real') IN ('real','balance') THEN t.amount::NUMERIC ELSE 0::NUMERIC END
          WHEN 'stake' THEN COALESCE(NULLIF(t.metadata->>'main_deducted','')::NUMERIC, t.amount::NUMERIC)
          WHEN 'referral_bonus' THEN t.amount::NUMERIC
          ELSE 0::NUMERIC
        END
      ) AS delta_real,
      SUM(
        CASE t.type
          WHEN 'deposit' THEN t.amount::NUMERIC
          WHEN 'withdrawal' THEN t.amount::NUMERIC
          WHEN 'win' THEN CASE WHEN COALESCE(t.metadata->>'credited_to','real') IN ('real','balance') THEN t.amount::NUMERIC ELSE 0::NUMERIC END
          WHEN 'stake' THEN COALESCE(NULLIF(t.metadata->>'main_deducted','')::NUMERIC, t.amount::NUMERIC)
          WHEN 'referral_bonus' THEN t.amount::NUMERIC
          ELSE 0::NUMERIC
        END
      ) OVER (PARTITION BY t.user_id ORDER BY t.created_at, t.id) AS running_delta,
      SUM(
        CASE t.type
          WHEN 'deposit' THEN t.amount::NUMERIC
          WHEN 'withdrawal' THEN t.amount::NUMERIC
          WHEN 'win' THEN CASE WHEN COALESCE(t.metadata->>'credited_to','real') IN ('real','balance') THEN t.amount::NUMERIC ELSE 0::NUMERIC END
          WHEN 'stake' THEN COALESCE(NULLIF(t.metadata->>'main_deducted','')::NUMERIC, t.amount::NUMERIC)
          WHEN 'referral_bonus' THEN t.amount::NUMERIC
          ELSE 0::NUMERIC
        END
      ) OVER (PARTITION BY t.user_id) AS total_delta,
      u.balance AS current_balance
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.status = 'completed'
      AND t.type IN ('deposit','withdrawal','stake','win','referral_bonus')
  ), base AS (
    SELECT user_id, (current_balance - total_delta) AS base_balance
    FROM calc
    GROUP BY user_id, current_balance, total_delta
  ), final AS (
    SELECT c.id,
           (b.base_balance + c.running_delta - c.delta_real) AS real_before,
           (b.base_balance + c.running_delta) AS real_after
    FROM calc c
    JOIN base b ON b.user_id = c.user_id
  )
  UPDATE transactions t
  SET metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
    'real_balance_before', ROUND(final.real_before::NUMERIC, 2),
    'real_balance_after', ROUND(final.real_after::NUMERIC, 2)
  )
  FROM final
  WHERE t.id = final.id
    AND t.status = 'completed'
    AND t.type IN ('referral_bonus')
    AND (t.metadata->>'real_balance_before') IS NULL;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % referral transaction(s) with real balance snapshots', _updated_count;
END $$;
