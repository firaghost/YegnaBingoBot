-- Ensure transactions.type supports new wallet v2 event types
DO $$
BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
EXCEPTION WHEN undefined_table THEN
  RETURN;
END $$;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (
    type IN (
      'stake',
      'win',
      'deposit',
      'withdrawal',
      'conversion',
      'referral_bonus',
      'tournament_prize',
      -- wallet v2 specific types
      'win_real',
      'win_bonus_locked',
      'unlock_bonus_full',
      -- legacy / bonus-credit type used elsewhere
      'bonus'
    )
  );
