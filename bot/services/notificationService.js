import bot from '../index.js';
import { supabase } from '../utils/supabaseClient.js';

/**
 * Send notification to user via Telegram
 */
export async function sendNotification(telegramId, message) {
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    console.log(`✅ Notification sent to ${telegramId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send notification to ${telegramId}:`, error);
    return false;
  }
}

/**
 * Notify user about deposit approval
 */
export async function notifyDepositApproved(userId, amount) {
  try {
    // Get user's telegram ID
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, balance')
      .eq('id', userId)
      .single();
    
    if (!user || !user.telegram_id) {
      console.error('User not found or no telegram_id');
      return false;
    }
    
    const message = 
      `✅ *Deposit Approved!*\n\n` +
      `💰 Amount: *${amount} Birr*\n` +
      `💳 New Balance: *${user.balance} Birr*\n\n` +
      `Your deposit has been successfully processed.\n` +
      `You can now play games!\n\n` +
      `Use /play to start playing.`;
    
    return await sendNotification(user.telegram_id, message);
  } catch (error) {
    console.error('Error notifying deposit approval:', error);
    return false;
  }
}

/**
 * Notify user about deposit rejection
 */
export async function notifyDepositRejected(userId, amount, reason = 'Invalid transaction proof') {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single();
    
    if (!user || !user.telegram_id) return false;
    
    const message = 
      `❌ *Deposit Rejected*\n\n` +
      `💰 Amount: ${amount} Birr\n` +
      `📋 Reason: ${reason}\n\n` +
      `Please contact support if you believe this is an error.\n` +
      `Or try submitting again with correct details.`;
    
    return await sendNotification(user.telegram_id, message);
  } catch (error) {
    console.error('Error notifying deposit rejection:', error);
    return false;
  }
}

/**
 * Notify user about withdrawal approval
 */
export async function notifyWithdrawalApproved(userId, amount, method, accountNumber) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, balance')
      .eq('id', userId)
      .single();
    
    if (!user || !user.telegram_id) return false;
    
    const methodName = method === 'telebirr' ? 'Telebirr' : 'CBE Bank';
    
    const message = 
      `✅ *Withdrawal Approved!*\n\n` +
      `💸 Amount: *${amount} Birr*\n` +
      `📱 Method: ${methodName}\n` +
      `🔢 Account: ${accountNumber}\n` +
      `💳 Remaining Balance: *${user.balance} Birr*\n\n` +
      `Your withdrawal has been processed.\n` +
      `You should receive the money within 24 hours.`;
    
    return await sendNotification(user.telegram_id, message);
  } catch (error) {
    console.error('Error notifying withdrawal approval:', error);
    return false;
  }
}

/**
 * Notify user about withdrawal rejection
 */
export async function notifyWithdrawalRejected(userId, amount, reason = 'Invalid account details') {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, balance')
      .eq('id', userId)
      .single();
    
    if (!user || !user.telegram_id) return false;
    
    const message = 
      `❌ *Withdrawal Rejected*\n\n` +
      `💸 Amount: ${amount} Birr\n` +
      `📋 Reason: ${reason}\n\n` +
      `💳 Your Balance: *${user.balance} Birr*\n\n` +
      `Your balance has been restored.\n` +
      `Please contact support if you need assistance.`;
    
    return await sendNotification(user.telegram_id, message);
  } catch (error) {
    console.error('Error notifying withdrawal rejection:', error);
    return false;
  }
}

/**
 * Notify user about game win
 */
export async function notifyGameWin(userId, gameId, prizeAmount) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, balance')
      .eq('id', userId)
      .single();
    
    if (!user || !user.telegram_id) return false;
    
    const message = 
      `🎉 *BINGO! YOU WON!*\n\n` +
      `🏆 Congratulations!\n` +
      `💰 Prize: *${prizeAmount.toFixed(2)} Birr*\n` +
      `💳 New Balance: *${user.balance.toFixed(2)} Birr*\n\n` +
      `🎮 Game ID: ${gameId.substring(0, 8)}\n\n` +
      `Amazing! Keep playing to win more!\n` +
      `Use /play to join another game.`;
    
    return await sendNotification(user.telegram_id, message);
  } catch (error) {
    console.error('Error notifying game win:', error);
    return false;
  }
}

/**
 * Notify user about game loss
 */
export async function notifyGameLoss(userId, gameId, winnerId) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id, balance')
      .eq('id', userId)
      .single();
    
    if (!user || !user.telegram_id) return false;
    
    // Get winner's username
    const { data: winner } = await supabase
      .from('users')
      .select('username')
      .eq('id', winnerId)
      .single();
    
    const winnerName = winner?.username || 'Another player';
    
    const message = 
      `😔 *Game Over*\n\n` +
      `Better luck next time!\n` +
      `🏆 Winner: ${winnerName}\n` +
      `💳 Your Balance: *${user.balance.toFixed(2)} Birr*\n\n` +
      `🎮 Game ID: ${gameId.substring(0, 8)}\n\n` +
      `Don't give up! Try again!\n` +
      `Use /play to join another game.`;
    
    return await sendNotification(user.telegram_id, message);
  } catch (error) {
    console.error('Error notifying game loss:', error);
    return false;
  }
}

/**
 * Notify all players when game starts
 */
export async function notifyGameStart(gameId) {
  try {
    const { data: players } = await supabase
      .from('game_players')
      .select('user_id, users(telegram_id)')
      .eq('game_id', gameId);
    
    if (!players || players.length === 0) return false;
    
    const message = 
      `🎮 *Game Started!*\n\n` +
      `The game has begun!\n` +
      `👥 Players: ${players.length}\n\n` +
      `Open the Mini App to play!\n` +
      `Good luck! 🍀`;
    
    for (const player of players) {
      if (player.users?.telegram_id) {
        await sendNotification(player.users.telegram_id, message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error notifying game start:', error);
    return false;
  }
}
