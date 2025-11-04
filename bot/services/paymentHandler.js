import { supabase } from '../utils/supabaseClient.js';
import { getUserByTelegramId } from './paymentService.js';

// Store user states for multi-step processes
const userStates = new Map();

/**
 * Handle withdrawal request - Step 1: Select method
 */
export async function handleWithdrawalMethod(ctx, method) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ User not found. Please /start first.');
  }
  
  if (user.balance < 50) {
    return ctx.reply(
      `❌ Insufficient balance!\n\n` +
      `💰 Your balance: ${user.balance} Birr\n` +
      `📊 Minimum withdrawal: 50 Birr`
    );
  }
  
  // Store state
  userStates.set(telegramId, {
    action: 'withdrawal',
    method: method,
    userId: user.id,
    balance: user.balance
  });
  
  const methodName = method === 'telebirr' ? 'Telebirr' : 'CBE Bank';
  
  return ctx.reply(
    `💸 ${methodName} Withdrawal\n\n` +
    `💰 Available balance: ${user.balance} Birr\n` +
    `📊 Minimum: 50 Birr\n\n` +
    `Please send:\n` +
    `1. Amount to withdraw\n` +
    `2. Your ${method === 'telebirr' ? 'phone number' : 'account number'}\n\n` +
    `Format: amount account_number\n` +
    `Example: 100 0912345678\n\n` +
    `Or send /cancel to cancel.`
  );
}

/**
 * Handle deposit request
 */
export async function handleDepositRequest(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ User not found. Please /start first.');
  }
  
  // Store state
  userStates.set(telegramId, {
    action: 'deposit',
    userId: user.id
  });
  
  return ctx.reply(
    `💰 Deposit Request\n\n` +
    `📱 Our Payment Details:\n\n` +
    `**Telebirr:**\n` +
    `Phone: 0912345678\n` +
    `Name: Yegna Bingo\n\n` +
    `**CBE Bank:**\n` +
    `Account: 1000123456789\n` +
    `Name: Yegna Bingo\n\n` +
    `After payment, send:\n` +
    `amount transaction_reference\n\n` +
    `Example: 100 TXN123456\n\n` +
    `Or send /cancel to cancel.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Process user text input based on current state
 */
export async function processUserInput(ctx) {
  const telegramId = ctx.from.id.toString();
  const state = userStates.get(telegramId);
  
  if (!state) {
    return; // No active state, ignore
  }
  
  const text = ctx.message.text.trim();
  const parts = text.split(/\s+/);
  
  if (parts.length < 2) {
    return ctx.reply('❌ Invalid format. Please provide both amount and account/reference number.');
  }
  
  const amount = parseFloat(parts[0]);
  const reference = parts.slice(1).join(' ');
  
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please enter a valid number.');
  }
  
  if (state.action === 'withdrawal') {
    return await processWithdrawal(ctx, state, amount, reference);
  } else if (state.action === 'deposit') {
    return await processDeposit(ctx, state, amount, reference);
  }
}

/**
 * Process withdrawal
 */
async function processWithdrawal(ctx, state, amount, accountNumber) {
  const telegramId = ctx.from.id.toString();
  
  if (amount < 50) {
    return ctx.reply('❌ Minimum withdrawal is 50 Birr.');
  }
  
  if (amount > state.balance) {
    return ctx.reply(`❌ Insufficient balance! You have ${state.balance} Birr.`);
  }
  
  try {
    // Create withdrawal request
    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: state.userId,
        amount: amount,
        payment_method: state.method,
        account_number: accountNumber,
        type: 'withdrawal',
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Clear state
    userStates.delete(telegramId);
    
    // Notify admin (you'll need to add admin notification logic)
    await notifyAdmin(ctx, 'withdrawal', data);
    
    return ctx.reply(
      `✅ Withdrawal Request Submitted!\n\n` +
      `💰 Amount: ${amount} Birr\n` +
      `📱 Method: ${state.method}\n` +
      `🔢 Account: ${accountNumber}\n` +
      `📋 Request ID: ${data.id.substring(0, 8)}\n\n` +
      `⏱ Processing time: Up to 24 hours\n` +
      `📊 Status: Pending approval\n\n` +
      `You'll be notified once approved!`
    );
  } catch (error) {
    console.error('Withdrawal error:', error);
    userStates.delete(telegramId);
    return ctx.reply('❌ Failed to submit withdrawal request. Please try again later.');
  }
}

/**
 * Process deposit
 */
async function processDeposit(ctx, state, amount, transactionProof) {
  const telegramId = ctx.from.id.toString();
  
  if (amount < 50) {
    return ctx.reply('❌ Minimum deposit is 50 Birr.');
  }
  
  try {
    // Create deposit request
    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: state.userId,
        amount: amount,
        transaction_proof: transactionProof,
        type: 'deposit',
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Clear state
    userStates.delete(telegramId);
    
    // Notify admin
    await notifyAdmin(ctx, 'deposit', data);
    
    return ctx.reply(
      `✅ Deposit Request Submitted!\n\n` +
      `💰 Amount: ${amount} Birr\n` +
      `🔖 Reference: ${transactionProof}\n` +
      `📋 Request ID: ${data.id.substring(0, 8)}\n\n` +
      `⏱ Processing time: Up to 24 hours\n` +
      `📊 Status: Pending verification\n\n` +
      `You'll be notified once approved!`
    );
  } catch (error) {
    console.error('Deposit error:', error);
    userStates.delete(telegramId);
    return ctx.reply('❌ Failed to submit deposit request. Please try again later.');
  }
}

/**
 * Notify admin about new payment request
 */
async function notifyAdmin(ctx, type, payment) {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return;
  
  const emoji = type === 'deposit' ? '💰' : '💸';
  const action = type === 'deposit' ? 'Deposit' : 'Withdrawal';
  
  try {
    await ctx.telegram.sendMessage(
      adminId,
      `${emoji} New ${action} Request\n\n` +
      `📋 ID: ${payment.id.substring(0, 8)}\n` +
      `👤 User: ${payment.user_id.substring(0, 8)}\n` +
      `💰 Amount: ${payment.amount} Birr\n` +
      `📊 Status: Pending\n\n` +
      `Use admin dashboard to approve/reject.`
    );
  } catch (error) {
    console.error('Failed to notify admin:', error);
  }
}

/**
 * Cancel current action
 */
export function cancelUserAction(telegramId) {
  userStates.delete(telegramId);
}

/**
 * Get user state
 */
export function getUserState(telegramId) {
  return userStates.get(telegramId);
}
