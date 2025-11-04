import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { handleStart, handleRegister, handleContact } from './commands/start.js';
import { handleBalance } from './commands/balance.js';
import { handleReceipt, handleReceiptPhoto } from './commands/receipt.js';
import { handlePlay, handleStatus } from './commands/play.js';
import { handleHelp } from './commands/help.js';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined in environment variables');
}

const bot = new Telegraf(BOT_TOKEN);

// Middleware for logging
bot.use((ctx, next) => {
  const user = ctx.from;
  const message = ctx.message?.text || ctx.message?.caption || 'non-text message';
  console.log(`[${new Date().toISOString()}] User ${user.id} (${user.username}): ${message}`);
  return next();
});

// Command handlers
bot.start(handleStart);
bot.command('balance', handleBalance);
bot.command('receipt', handleReceipt);
bot.command('play', handlePlay);
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
