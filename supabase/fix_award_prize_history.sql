-- Fix award_prize function to create transaction history
CREATE OR REPLACE FUNCTION award_prize(winner_user_id uuid, game_id uuid)
RETURNS void AS $$
DECLARE
  prize_amount numeric;
  winner_prize numeric;
BEGIN
  -- Get prize pool
  SELECT prize_pool INTO prize_amount FROM games WHERE id = game_id;
  
  -- Winner gets 90% (10% commission)
  winner_prize := prize_amount * 0.9;
  
  -- Update winner's balance
  UPDATE users
  SET balance = balance + winner_prize
  WHERE id = winner_user_id;
  
  -- Create transaction history for winner
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    winner_user_id,
    'game_win',
    winner_prize,
    'Won game ' || game_id || ' - Prize: ' || winner_prize || ' Birr'
  );
  
  -- Update game status
  UPDATE games
  SET winner_id = winner_user_id,
      status = 'completed',
      ended_at = now()
  WHERE id = game_id;
END;
$$ LANGUAGE plpgsql;
