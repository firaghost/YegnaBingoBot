-- Migration: Add bot autofill function for games table
-- Date: 2025-11-15
-- Purpose: Automatically add bots to fill empty slots in games

-- Function to autofill bots in a game
CREATE OR REPLACE FUNCTION autofill_bots_in_game(
  p_game_id uuid,
  p_room_id uuid,
  p_max_players integer DEFAULT 8
)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_current_players integer;
  v_bots_needed integer;
  v_bot record;
  v_bots_added integer := 0;
BEGIN
  -- Get current player count
  SELECT COUNT(*) INTO v_current_players
  FROM game_players
  WHERE session_id = p_game_id AND status = 'active';
  
  -- Calculate bots needed
  v_bots_needed := p_max_players - v_current_players;
  
  IF v_bots_needed <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Add bots to fill the game
  FOR v_bot IN
    SELECT id, name
    FROM bots
    WHERE active = true
    ORDER BY random()
    LIMIT v_bots_needed
  LOOP
    -- Insert bot as a game player
    INSERT INTO game_players (
      id,
      session_id,
      username,
      socket_id,
      status,
      board,
      score,
      is_bot,
      bot_id
    ) VALUES (
      gen_random_uuid(),
      p_game_id,
      v_bot.name,
      'bot_' || v_bot.id::text,
      'active',
      ARRAY[
        ARRAY[1, 2, 3, 4, 5],
        ARRAY[16, 17, 18, 19, 20],
        ARRAY[31, 32, 0, 34, 35],
        ARRAY[46, 47, 48, 49, 50],
        ARRAY[61, 62, 63, 64, 65]
      ]::integer[][],
      0,
      true,
      v_bot.id
    );
    
    v_bots_added := v_bots_added + 1;
  END LOOP;
  
  -- Update game player count
  UPDATE games
  SET players = players + v_bots_added
  WHERE id = p_game_id;
  
  RETURN v_bots_added;
END;
$$;

-- Function to be called after join_game to autofill bots
CREATE OR REPLACE FUNCTION ensure_game_has_bots(
  p_game_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_room record;
  v_bots_added integer;
BEGIN
  -- Get room info
  SELECT max_players INTO v_room
  FROM rooms
  WHERE id = p_room_id;
  
  IF v_room IS NULL THEN
    RETURN;
  END IF;
  
  -- Autofill bots
  SELECT autofill_bots_in_game(p_game_id, p_room_id, v_room.max_players) INTO v_bots_added;
  
  IF v_bots_added > 0 THEN
    RAISE NOTICE 'Added % bots to game %', v_bots_added, p_game_id;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION autofill_bots_in_game(uuid, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION ensure_game_has_bots(uuid, uuid) TO anon, authenticated;
