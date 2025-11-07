import { Markup } from 'telegraf';
import { supabase } from '../utils/supabaseClient.js';

const ADMIN_IDS = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];

/**
 * Check if user is admin
 */
export function isAdmin(telegramId) {
  return ADMIN_IDS.includes(telegramId.toString());
}

/**
 * Admin panel command
 */
export async function handleAdminPanel(ctx) {
  const telegramId = ctx.from.id.toString();
  
  if (!isAdmin(telegramId)) {
    return ctx.reply('❌ Unauthorized. Admin access only.');
  }
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Statistics', 'admin_stats'),
      Markup.button.callback('👥 Users', 'admin_users')
    ],
    [
      Markup.button.callback('💰 Pending Deposits', 'admin_deposits'),
      Markup.button.callback('💸 Pending Withdrawals', 'admin_withdrawals')
    ],
    [
      Markup.button.callback('🎮 Active Games', 'admin_games'),
      Markup.button.callback('📢 Broadcast', 'admin_broadcast')
    ],
    [
      Markup.button.callback('⚙️ Settings', 'admin_settings'),
      Markup.button.callback('🔄 Refresh', 'admin_panel')
    ]
  ]);
  
  return ctx.reply(
    `🔐 Admin Panel\n\n` +
    `Welcome, Admin!\n` +
    `Select an option below:`,
    keyboard
  );
}

/**
 * Show statistics
 */
export async function handleAdminStats(ctx) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  try {
    // Get user count
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Get pending payments
    const { count: pendingDeposits } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'deposit')
      .eq('status', 'pending');
    
    const { count: pendingWithdrawals } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'withdrawal')
      .eq('status', 'pending');
    
    // Get active games
    const { count: activeGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // Get total balance
    const { data: balanceData } = await supabase
      .from('users')
      .select('balance');
    
    const totalBalance = balanceData?.reduce((sum, u) => sum + (u.balance || 0), 0) || 0;
    
    await ctx.answerCbQuery();
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('« Back', 'admin_panel')]
    ]);
    
    return ctx.editMessageText(
      `📊 System Statistics\n\n` +
      `👥 Total Users: ${userCount || 0}\n` +
      `💰 Total Balance: ${totalBalance.toFixed(2)} Birr\n\n` +
      `📥 Pending Deposits: ${pendingDeposits || 0}\n` +
      `📤 Pending Withdrawals: ${pendingWithdrawals || 0}\n` +
      `🎮 Active Games: ${activeGames || 0}\n\n` +
      `⏰ Updated: ${new Date().toLocaleString()}`,
      keyboard
    );
  } catch (error) {
    console.error('Admin stats error:', error);
    await ctx.answerCbQuery('❌ Error loading stats');
  }
}

/**
 * Show pending deposits
 */
export async function handleAdminDeposits(ctx) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  try {
    const { data: deposits, error } = await supabase
      .from('payments')
      .select(`
        *,
        users (
          username,
          telegram_id
        )
      `)
      .eq('type', 'deposit')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    await ctx.answerCbQuery();
    
    if (!deposits || deposits.length === 0) {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'admin_panel')]
      ]);
      
      return ctx.editMessageText(
        `💰 Pending Deposits\n\n` +
        `No pending deposits.`,
        keyboard
      );
    }
    
    let message = `💰 Pending Deposits (${deposits.length})\n\n`;
    
    const buttons = [];
    deposits.forEach((deposit, index) => {
      message += `${index + 1}. ${deposit.amount} Birr\n`;
      message += `   User: ${deposit.users?.username || 'Unknown'}\n`;
      message += `   Ref: ${deposit.transaction_proof}\n`;
      message += `   ID: ${deposit.id.substring(0, 8)}\n\n`;
      
      buttons.push([
        Markup.button.callback(`✅ Approve #${index + 1}`, `approve_deposit_${deposit.id}`),
        Markup.button.callback(`❌ Reject #${index + 1}`, `reject_deposit_${deposit.id}`)
      ]);
    });
    
    buttons.push([Markup.button.callback('« Back', 'admin_panel')]);
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    return ctx.editMessageText(message, keyboard);
  } catch (error) {
    console.error('Admin deposits error:', error);
    await ctx.answerCbQuery('❌ Error loading deposits');
  }
}

/**
 * Show pending withdrawals
 */
export async function handleAdminWithdrawals(ctx) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  try {
    const { data: withdrawals, error } = await supabase
      .from('payments')
      .select(`
        *,
        users (
          username,
          telegram_id,
          balance
        )
      `)
      .eq('type', 'withdrawal')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    await ctx.answerCbQuery();
    
    if (!withdrawals || withdrawals.length === 0) {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('« Back', 'admin_panel')]
      ]);
      
      return ctx.editMessageText(
        `💸 Pending Withdrawals\n\n` +
        `No pending withdrawals.`,
        keyboard
      );
    }
    
    let message = `💸 Pending Withdrawals (${withdrawals.length})\n\n`;
    
    const buttons = [];
    withdrawals.forEach((withdrawal, index) => {
      message += `${index + 1}. ${withdrawal.amount} Birr\n`;
      message += `   User: ${withdrawal.users?.username || 'Unknown'}\n`;
      message += `   Method: ${withdrawal.payment_method}\n`;
      message += `   Account: ${withdrawal.account_number}\n`;
      message += `   Balance: ${withdrawal.users?.balance || 0} Birr\n`;
      message += `   ID: ${withdrawal.id.substring(0, 8)}\n\n`;
      
      buttons.push([
        Markup.button.callback(`✅ Approve #${index + 1}`, `approve_withdrawal_${withdrawal.id}`),
        Markup.button.callback(`❌ Reject #${index + 1}`, `reject_withdrawal_${withdrawal.id}`)
      ]);
    });
    
    buttons.push([Markup.button.callback('« Back', 'admin_panel')]);
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    return ctx.editMessageText(message, keyboard);
  } catch (error) {
    console.error('Admin withdrawals error:', error);
    await ctx.answerCbQuery('❌ Error loading withdrawals');
  }
}

/**
 * Broadcast message
 */
export async function handleAdminBroadcast(ctx) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  await ctx.answerCbQuery();
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('« Back', 'admin_panel')]
  ]);
  
  return ctx.editMessageText(
    `📢 Broadcast Message\n\n` +
    `To send a message to all users:\n\n` +
    `Use command: /broadcast <message>\n\n` +
    `Example:\n` +
    `/broadcast Welcome bonus: 10 Birr for all players today!`,
    keyboard
  );
}

/**
 * Send broadcast message
 */
export async function handleBroadcastCommand(ctx) {
  const telegramId = ctx.from.id.toString();
  
  if (!isAdmin(telegramId)) {
    return ctx.reply('❌ Unauthorized. Admin access only.');
  }
  
  const message = ctx.message.text.replace('/broadcast', '').trim();
  
  if (!message) {
    return ctx.reply('❌ Please provide a message to broadcast.\n\nUsage: /broadcast <message>');
  }
  
  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('telegram_id');
    
    if (error) throw error;
    
    await ctx.reply(`📢 Broadcasting to ${users.length} users...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(
          user.telegram_id,
          `📢 Announcement from Yegna Bingo\n\n${message}`
        );
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failCount++;
        console.error(`Failed to send to ${user.telegram_id}:`, error.message);
      }
    }
    
    return ctx.reply(
      `✅ Broadcast complete!\n\n` +
      `✓ Sent: ${successCount}\n` +
      `✗ Failed: ${failCount}`
    );
  } catch (error) {
    console.error('Broadcast error:', error);
    return ctx.reply('❌ Failed to broadcast message.');
  }
}

/**
 * Approve deposit
 */
export async function approveDeposit(ctx, paymentId) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  try {
    // Get payment details
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        users (
          telegram_id,
          username,
          balance
        )
      `)
      .eq('id', paymentId)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (payment.status !== 'pending') {
      return ctx.answerCbQuery('❌ Payment already processed');
    }
    
    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    if (updateError) throw updateError;
    
    // Update user balance
    const newBalance = (payment.users.balance || 0) + payment.amount;
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', payment.user_id);
    
    if (balanceError) throw balanceError;
    
    // Log transaction
    await supabase.from('transaction_history').insert({
      user_id: payment.user_id,
      type: 'deposit',
      amount: payment.amount,
      balance_before: payment.users.balance || 0,
      balance_after: newBalance,
      description: `Deposit approved`
    });
    
    // Notify user
    try {
      await ctx.telegram.sendMessage(
        payment.users.telegram_id,
        `✅ Deposit Approved!\n\n` +
        `💰 Amount: ${payment.amount} Birr\n` +
        `💳 New Balance: ${newBalance} Birr\n\n` +
        `Thank you for playing Yegna Bingo! 🎮`
      );
    } catch (notifyError) {
      console.error('Failed to notify user:', notifyError);
    }
    
    await ctx.answerCbQuery('✅ Deposit approved!');
    
    // Refresh the list
    return handleAdminDeposits(ctx);
  } catch (error) {
    console.error('Approve deposit error:', error);
    return ctx.answerCbQuery('❌ Error approving deposit');
  }
}

/**
 * Approve withdrawal
 */
export async function approveWithdrawal(ctx, paymentId) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  try {
    // Get payment details
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        users (
          telegram_id,
          username,
          balance
        )
      `)
      .eq('id', paymentId)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (payment.status !== 'pending') {
      return ctx.answerCbQuery('❌ Payment already processed');
    }
    
    // Check balance
    if (payment.users.balance < payment.amount) {
      return ctx.answerCbQuery('❌ Insufficient user balance');
    }
    
    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    if (updateError) throw updateError;
    
    // Update user balance
    const newBalance = payment.users.balance - payment.amount;
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', payment.user_id);
    
    if (balanceError) throw balanceError;
    
    // Log transaction
    await supabase.from('transaction_history').insert({
      user_id: payment.user_id,
      type: 'withdrawal',
      amount: -payment.amount,
      balance_before: payment.users.balance,
      balance_after: newBalance,
      description: `Withdrawal approved to ${payment.payment_method}: ${payment.account_number}`
    });
    
    // Notify user
    try {
      await ctx.telegram.sendMessage(
        payment.users.telegram_id,
        `✅ Withdrawal Approved!\n\n` +
        `💸 Amount: ${payment.amount} Birr\n` +
        `📱 Method: ${payment.payment_method}\n` +
        `🔢 Account: ${payment.account_number}\n` +
        `💳 New Balance: ${newBalance} Birr\n\n` +
        `Money will be transferred within 24 hours.`
      );
    } catch (notifyError) {
      console.error('Failed to notify user:', notifyError);
    }
    
    await ctx.answerCbQuery('✅ Withdrawal approved! Transfer money to user.');
    
    // Refresh the list
    return handleAdminWithdrawals(ctx);
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    return ctx.answerCbQuery('❌ Error approving withdrawal');
  }
}

/**
 * Reject payment
 */
export async function rejectPayment(ctx, paymentId, type) {
  if (!isAdmin(ctx.from.id.toString())) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  try {
    // Get payment details
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        users (
          telegram_id,
          username
        )
      `)
      .eq('id', paymentId)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (payment.status !== 'pending') {
      return ctx.answerCbQuery('❌ Payment already processed');
    }
    
    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        admin_note: 'Rejected by admin'
      })
      .eq('id', paymentId);
    
    if (updateError) throw updateError;
    
    // Notify user
    try {
      await ctx.telegram.sendMessage(
        payment.users.telegram_id,
        `❌ ${type === 'deposit' ? 'Deposit' : 'Withdrawal'} Rejected\n\n` +
        `💰 Amount: ${payment.amount} Birr\n\n` +
        `Please contact support for more information.`
      );
    } catch (notifyError) {
      console.error('Failed to notify user:', notifyError);
    }
    
    await ctx.answerCbQuery('✅ Payment rejected');
    
    // Refresh the list
    return type === 'deposit' ? handleAdminDeposits(ctx) : handleAdminWithdrawals(ctx);
  } catch (error) {
    console.error('Reject payment error:', error);
    return ctx.answerCbQuery('❌ Error rejecting payment');
  }
}
