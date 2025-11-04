import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { handleStart, handleRegister, handleContact } from './commands/start.js';
import { handleBalance } from './commands/balance.js';
import { handleReceipt, handleReceiptPhoto } from './commands/receipt.js';
import { handlePlay, handleStatus } from './commands/play.js';
import { handleHelp } from './commands/help.js';
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
} from './commands/menu.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined in environment variables');
}

const bot = new Telegraf(BOT_TOKEN);

// Set bot commands menu
setBotCommands(bot).catch(console.error);

// Middleware for logging
bot.use((ctx, next) => {
  const user = ctx.from;
  const message = ctx.message?.text || ctx.message?.caption || 'non-text message';
  console.log(`[${new Date().toISOString()}] User ${user.id} (${user.username}): ${message}`);
  return next();
});

// Command handlers
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

// Handle contact sharing
bot.on('contact', handleContact);

// Handle photo messages with /receipt caption
bot.on('photo', async (ctx) => {
  const caption = ctx.message.caption || '';
  if (caption.startsWith('/receipt')) {
    return handleReceiptPhoto(ctx);
  }
});

// Handle button clicks (keyboard buttons)
bot.hears('📝 Register', handleRegister);
bot.hears('🎮 Play', handlePlay);
bot.hears('💰 Deposit', (ctx) => ctx.reply('💰 የክፍያ መመሪያዎች:\n\nእባክዎን /receipt ይጠቀሙ'));
bot.hears('💸 Withdraw', (ctx) => ctx.reply('💸 የመውጣት ጥያቄ በቅርቡ ይመጣል...'));
bot.hears('📊 Transfer', (ctx) => ctx.reply('📊 የማስተላለፍ ባህሪ በቅርቡ ይመጣል...'));
bot.hears('📢 Join Channel', (ctx) => ctx.reply('📢 የቴሌግራም ቻናላችንን ይቀላቀሉ: @YourChannel'));
bot.hears('❌ Cancel', handleStart);

// Handle callback queries (inline buttons)
bot.action('check_balance', async (ctx) => {
  await ctx.answerCbQuery();
  return handleBalance(ctx);
});

bot.action('withdraw_telebirr', async (ctx) => {
  await ctx.answerCbQuery();
  const user = await import('./services/paymentService.js').then(m => m.getUserByTelegramId(ctx.from.id.toString()));
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
  const user = await import('./services/paymentService.js').then(m => m.getUserByTelegramId(ctx.from.id.toString()));
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

// Handle unknown commands
bot.on('text', (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) {
    ctx.reply('❌ Unknown command. Use /help to see available commands.');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again later.');
});

// Start the bot
console.log('🤖 Starting Bingo Vault Bot...');

// For development (polling)
if (process.env.NODE_ENV !== 'production') {
  bot.launch({
    dropPendingUpdates: true
  });
  console.log('✅ Bot started in polling mode');
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  // For production (webhook)
  // This will be handled by Vercel serverless function
  console.log('✅ Bot configured for webhook mode');
}

export default bot;
