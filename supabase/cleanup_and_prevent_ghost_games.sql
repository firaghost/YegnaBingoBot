-- Cleanup and prevention of ghost games (never started, no players, no calls)
-- Run this in Supabase SQL editor.

-- 1) One-time cleanup: delete already-created ghost games
DELETE FROM games g
WHERE g.status = 'finished'
  AND (g.started_at IS NULL OR g.started_at = 'epoch'::timestamp)
  AND (g.winner_id IS NULL)
  AND (COALESCE(array_length(g.players, 1), 0) = 0)
  AND (COALESCE(array_length(g.called_numbers, 1), 0) = 0);

-- 2) Trigger function: if a waiting/countdown game becomes finished without starting and with no players/calls, delete it instead of storing it
CREATE OR REPLACE FUNCTION delete_empty_prestart_game()
RETURNS TRIGGER AS $$
BEGIN
  -- If transitioning to finished (or staying finished) without ever starting and no players/calls, delete row
  IF (NEW.status = 'finished')
     AND (NEW.started_at IS NULL)
     AND (NEW.winner_id IS NULL)
     AND (COALESCE(array_length(NEW.players, 1), 0) = 0)
     AND (COALESCE(array_length(NEW.called_numbers, 1), 0) = 0) THEN
    DELETE FROM games WHERE id = NEW.id;
    RETURN NULL; -- cancel update; row deleted
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Create trigger: fire before update on status/players/called_numbers/started_at
DROP TRIGGER IF EXISTS trg_delete_empty_prestart_game ON games;
CREATE TRIGGER trg_delete_empty_prestart_game
BEFORE UPDATE OF status, players, called_numbers, started_at ON games
FOR EACH ROW
EXECUTE FUNCTION delete_empty_prestart_game();

-- 4) Optional: periodically purge old waiting/countdown games with zero players
CREATE OR REPLACE FUNCTION purge_old_waiting_games()
RETURNS INTEGER AS $$
DECLARE
  removed INT;
BEGIN
  DELETE FROM games
  WHERE status IN ('waiting','countdown')
    AND COALESCE(array_length(players,1),0) = 0
    AND created_at < NOW() - INTERVAL '30 minutes';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$ LANGUAGE plpgsql;
