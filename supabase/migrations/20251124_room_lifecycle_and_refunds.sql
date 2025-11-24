-- Room lifecycle + auto-end + refunds
-- Date: 2025-11-24

-- 1) Extend rooms table for lifecycle tracking
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS countdown_seconds INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NULL;

-- status, min_players, countdown_started_at are created by waiting_room_schema.sql
-- This migration only adds what is missing and never changes existing definitions.

-- 2) Extend room_players for staking metadata
ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS stake_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stake_source TEXT DEFAULT 'real',
  ADD COLUMN IF NOT EXISTS has_refund BOOLEAN DEFAULT FALSE;

-- 3) Room audit logs table
CREATE TABLE IF NOT EXISTS room_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  actor UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_audit_logs_room_id
  ON room_audit_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_room_audit_logs_created_at
  ON room_audit_logs(created_at);

-- 4) Allow stake_refund transaction type
DO $$
BEGIN
  BEGIN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
  EXCEPTION WHEN undefined_table THEN
    RETURN;
  END;
END $$;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (
    type IN (
      'stake',
      'stake_refund',
      'win',
      'deposit',
      'withdrawal',
      'conversion',
      'referral_bonus',
      'tournament_prize',
      'win_real',
      'win_bonus_locked',
      'unlock_bonus_full',
      'bonus'
    )
  );

-- 5) Stake refund helpers (real and bonus) + room_refund_player_stake
DROP FUNCTION IF EXISTS wallet_refund_stake_real(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION wallet_refund_stake_real(
  p_user_id UUID,
  p_game_id UUID,
  p_amount  NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_real_before NUMERIC;
  v_real_after  NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  SELECT COALESCE(balance,0)
    INTO v_real_before
    FROM users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_real_after := v_real_before + p_amount;

  UPDATE users
     SET balance   = v_real_after,
         updated_at = NOW()
   WHERE id = p_user_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_user_id,
      'stake_refund',
      p_amount,
      'completed',
      p_game_id,
      jsonb_build_object(
        'wallet_type',  'real',
        'real_before',  v_real_before,
        'real_after',   v_real_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS wallet_refund_stake_bonus(UUID, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION wallet_refund_stake_bonus(
  p_user_id UUID,
  p_game_id UUID,
  p_amount  NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_bonus_before NUMERIC;
  v_bonus_after  NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN TRUE;
  END IF;

  SELECT COALESCE(bonus_balance,0)
    INTO v_bonus_before
    FROM users
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_bonus_after := v_bonus_before + p_amount;

  UPDATE users
     SET bonus_balance = v_bonus_after,
         updated_at    = NOW()
   WHERE id = p_user_id;

  BEGIN
    INSERT INTO transactions(user_id, type, amount, status, game_id, metadata)
    VALUES (
      p_user_id,
      'stake_refund',
      p_amount,
      'completed',
      p_game_id,
      jsonb_build_object(
        'wallet_type',   'bonus',
        'bonus_before',  v_bonus_before,
        'bonus_after',   v_bonus_after
      )
    );
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS room_refund_player_stake(TEXT, UUID, UUID, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION room_refund_player_stake(
  p_room_id TEXT,
  p_user_id UUID,
  p_game_id UUID,
  p_stake_source TEXT,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_existing_refund INT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_existing_refund
  FROM transactions
  WHERE user_id = p_user_id
    AND game_id = p_game_id
    AND type = 'stake_refund';

  IF v_existing_refund > 0 THEN
    RETURN FALSE;
  END IF;

  IF p_stake_source = 'bonus' THEN
    PERFORM wallet_refund_stake_bonus(p_user_id, p_game_id, p_amount);
  ELSE
    PERFORM wallet_refund_stake_real(p_user_id, p_game_id, p_amount);
  END IF;

  INSERT INTO room_audit_logs(room_id, action, details, actor)
  VALUES (
    p_room_id,
    'refund_processed',
    jsonb_build_object(
      'user_id', p_user_id,
      'game_id', p_game_id,
      'stake_source', p_stake_source,
      'amount', p_amount
    ),
    NULL
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
