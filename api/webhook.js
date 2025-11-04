import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import { handleStart, handleRegister, handleContact } from '../bot/commands/start.js';
import { handleBalance } from '../bot/commands/balance.js';
import { handleReceipt, handleReceiptPhoto } from '../bot/commands/receipt.js';
import { handlePlay, handleStatus } from '../bot/commands/play.js';
import { handleHelp } from '../bot/commands/help.js';
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
} from '../bot/commands/menu.js';

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

bot.on('text', (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) {
    ctx.reply('❌ Unknown command. Use /help to see available commands.');
  }
});

// Vercel serverless function handler
export default async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else {
      res.status(200).json({ status: 'Bot is running' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
