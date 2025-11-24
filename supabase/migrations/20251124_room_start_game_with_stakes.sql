-- Deduct stakes for all active players in a room when a game session starts
-- Uses wallet_v2 functions and records stake metadata on room_players
-- Date: 2025-11-24

DROP FUNCTION IF EXISTS room_start_game_with_stakes(TEXT, UUID);

CREATE OR REPLACE FUNCTION room_start_game_with_stakes(
  p_room_id    TEXT,
  p_session_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_room           RECORD;
  v_stake          NUMERIC;
  v_stake_source   TEXT;
  v_count          INTEGER := 0;
  v_player         RECORD;
  v_existing_stake INT;
BEGIN
  -- Lock the room row so concurrent starts cannot race
  SELECT id, stake, stake_source
    INTO v_room
    FROM rooms
   WHERE id = p_room_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room % not found', p_room_id;
  END IF;

  v_stake := COALESCE(v_room.stake, 0);
  v_stake_source := COALESCE(v_room.stake_source, 'real');
  IF v_stake <= 0 THEN
    -- No stake configured, nothing to deduct
    RETURN 0;
  END IF;

  -- Iterate all active players in the room that have a linked user_id
  FOR v_player IN
    SELECT user_id
      FROM room_players
     WHERE room_id = p_room_id
       AND status = 'active'
       AND user_id IS NOT NULL
  LOOP
    -- Idempotency: if a stake transaction already exists for this user/session, skip
    BEGIN
      SELECT COUNT(*) INTO v_existing_stake
        FROM transactions
       WHERE user_id = v_player.user_id
         AND game_id = p_session_id
         AND type = 'stake';
    EXCEPTION WHEN undefined_table THEN
      v_existing_stake := 0;
    END;

    IF v_existing_stake > 0 THEN
      CONTINUE;
    END IF;

    -- Attempt to deduct stake using wallet_v2 functions based on room stake_source
    BEGIN
      IF v_stake_source = 'bonus' THEN
        PERFORM wallet_game_start_bonus(v_player.user_id, p_session_id, v_stake);
      ELSE
        PERFORM wallet_game_start_real(v_player.user_id, p_session_id, v_stake);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log failure and continue with other players (do not abort whole room)
      BEGIN
        INSERT INTO room_audit_logs(room_id, action, details, actor)
        VALUES (
          p_room_id,
          'stake_deduction_failed',
          jsonb_build_object(
            'user_id', v_player.user_id,
            'game_session_id', p_session_id,
            'stake', v_stake,
            'stake_source', v_stake_source,
            'error', SQLERRM
          ),
          v_player.user_id
        );
      EXCEPTION
        WHEN undefined_table THEN NULL;
        WHEN undefined_column THEN NULL;
      END;
      CONTINUE;
    END;

    -- On success, update room_players metadata for this user
    UPDATE room_players
       SET stake_amount = v_stake,
           stake_source = v_stake_source,
           has_refund   = FALSE
     WHERE room_id = p_room_id
       AND user_id = v_player.user_id;

    -- Audit log for successful stake deduction
    BEGIN
      INSERT INTO room_audit_logs(room_id, action, details, actor)
      VALUES (
        p_room_id,
        'stake_deducted',
        jsonb_build_object(
          'user_id', v_player.user_id,
          'game_session_id', p_session_id,
          'stake', v_stake,
          'stake_source', v_stake_source
        ),
        v_player.user_id
      );
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
