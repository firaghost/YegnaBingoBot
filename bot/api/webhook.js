import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import { handleStart, handleRegister, handleContact } from '../commands/start.js';
import { handleBalance } from '../commands/balance.js';
import { handleReceipt, handleReceiptPhoto } from '../commands/receipt.js';
import { handlePlay, handleStatus } from '../commands/play.js';
import { handleHelp } from '../commands/help.js';
import {
  setBotCommands,
  handleWithdraw,
  handleDeposit,
  handleTransfer,
  handleCheckBalance,
  handleReferral,
  handleChangeName,
  handleJoinChannel,
  handleGameHistory,
  handleDepositHistory,
  handleWithdrawalHistory,
  handleTryYourLuck,
  handleHighStakeGameLuck,
  handleReferralLeaderboard,
  handleConvertBonusBalance,
  handleCancel
} from '../commands/menu.js';
import {
  handleAdminPanel,
  handleAdminStats,
  handleAdminDeposits,
  handleAdminWithdrawals,
  handleAdminBroadcast,
  handleBroadcastCommand,
  approveDeposit,
  approveWithdrawal,
  rejectPayment
} from '../commands/admin.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Set bot commands menu
setBotCommands(bot).catch(console.error);

// Set up commands
bot.start(handleStart);
bot.command('register', handleRegister);
bot.command('play', handlePlay);
bot.command('balance', handleBalance);
bot.command('checkbalance', handleCheckBalance);
bot.command('receipt', handleReceipt);
bot.command('deposit', handleDeposit);
bot.command('withdraw', handleWithdraw);
bot.command('transfer', handleTransfer);
bot.command('referral', handleReferral);
bot.command('changename', handleChangeName);
bot.command('joinchannel', handleJoinChannel);
bot.command('gamehistory', handleGameHistory);
bot.command('deposithistory', handleDepositHistory);
bot.command('withdrawalhistory', handleWithdrawalHistory);
bot.command('tryyourluck', handleTryYourLuck);
bot.command('highstakegameluck', handleHighStakeGameLuck);
bot.command('referralleaderboard', handleReferralLeaderboard);
bot.command('convertbonusbalance', handleConvertBonusBalance);
bot.command('cancel', handleCancel);
bot.command('status', handleStatus);
bot.command('help', handleHelp);

// Admin commands
bot.command('admin', handleAdminPanel);
bot.command('broadcast', handleBroadcastCommand);

// Handle contact sharing
bot.on('contact', handleContact);

bot.on('photo', async (ctx) => {
  const caption = ctx.message.caption || '';
  if (caption.startsWith('/receipt')) {
    return handleReceiptPhoto(ctx);
  }
});

// Handle button clicks
bot.hears('📝 Register', handleRegister);
bot.hears('🎮 Play', handlePlay);
bot.hears('💰 Deposit', (ctx) => ctx.reply('💰 የክፍያ መመሪያዎች:\n\nእባክዎን /receipt ይጠቀሙ'));
bot.hears('💸 Withdraw', (ctx) => ctx.reply('💸 የመውጣት ጥያቄ በቅርቡ ይመጣል...'));
bot.hears('📊 Transfer', (ctx) => ctx.reply('📊 የማስተላለፍ ባህሪ በቅርቡ ይመጣል...'));
bot.hears('📢 Join Channel', (ctx) => ctx.reply('📢 የቴሌግራም ቻናላችንን ይቀላቀሉ: @YourChannel'));
bot.hears('❌ Cancel', handleStart);

// Handle callback queries
bot.action('check_balance', async (ctx) => {
  await ctx.answerCbQuery();
  return handleBalance(ctx);
});

bot.action('withdraw_telebirr', async (ctx) => {
  await ctx.answerCbQuery();
  const { getUserByTelegramId } = await import('../services/paymentService.js');
  const user = await getUserByTelegramId(ctx.from.id.toString());
  if (!user) {
    return ctx.reply('❌ User not found');
  }
  return ctx.reply(
    `📱 Telebirr Withdrawal\n\n` +
    `💰 Amount to withdraw: ${user.balance} Birr\n\n` +
    `Please provide your Telebirr number:\n` +
    `Format: 09XXXXXXXX\n\n` +
    `Send your number and we'll process your withdrawal within 24 hours.\n\n` +
    `Contact admin: @YourAdminUsername`
  );
});

bot.action('withdraw_cbe', async (ctx) => {
  await ctx.answerCbQuery();
  const { getUserByTelegramId } = await import('../services/paymentService.js');
  const user = await getUserByTelegramId(ctx.from.id.toString());
  if (!user) {
    return ctx.reply('❌ User not found');
  }
  return ctx.reply(
    `🏦 CBE (Commercial Bank of Ethiopia) Withdrawal\n\n` +
    `💰 Amount to withdraw: ${user.balance} Birr\n\n` +
    `Please provide:\n` +
    `1. CBE Account Number\n` +
    `2. Account Holder Name\n\n` +
    `Send this information and we'll process your withdrawal within 24 hours.\n\n` +
    `Contact admin: @YourAdminUsername`
  );
});

bot.action('withdraw_cancel', async (ctx) => {
  await ctx.answerCbQuery('Withdrawal cancelled');
  return ctx.reply('❌ Withdrawal cancelled.\n\nUse /withdraw to try again.');
});

// Admin callback queries
bot.action('admin_panel', handleAdminPanel);
bot.action('admin_stats', handleAdminStats);
bot.action('admin_deposits', handleAdminDeposits);
bot.action('admin_withdrawals', handleAdminWithdrawals);
bot.action('admin_broadcast', handleAdminBroadcast);

// Approve/Reject deposits
bot.action(/^approve_deposit_(.+)$/, async (ctx) => {
  const paymentId = ctx.match[1];
  return approveDeposit(ctx, paymentId);
});

bot.action(/^reject_deposit_(.+)$/, async (ctx) => {
  const paymentId = ctx.match[1];
  return rejectPayment(ctx, paymentId, 'deposit');
});

// Approve/Reject withdrawals
bot.action(/^approve_withdrawal_(.+)$/, async (ctx) => {
  const paymentId = ctx.match[1];
  return approveWithdrawal(ctx, paymentId);
});

bot.action(/^reject_withdrawal_(.+)$/, async (ctx) => {
  const paymentId = ctx.match[1];
  return rejectPayment(ctx, paymentId, 'withdrawal');
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // Check if user has an active state (withdrawal/deposit in progress)
  const { getUserState, processUserInput } = await import('../services/paymentHandler.js');
  const state = getUserState(ctx.from.id.toString());
  
  if (state) {
    // User is in the middle of withdrawal/deposit process
    return processUserInput(ctx);
  }
  
  // Handle unknown commands
  if (text.startsWith('/')) {
    ctx.reply('❌ Unknown command. Use /help to see available commands.');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  console.error('Context:', ctx.update);
  ctx.reply('❌ An error occurred. Please try again later.').catch(console.error);
});

// Vercel serverless function handler
export default async (req, res) => {
  try {
    console.log('Webhook called:', req.method);
    
    if (req.method === 'POST') {
      console.log('Processing update:', JSON.stringify(req.body, null, 2));
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else {
      res.status(200).json({ status: 'Bot is running', timestamp: new Date().toISOString() });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
