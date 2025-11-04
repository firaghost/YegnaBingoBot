import { getUserByTelegramId } from '../services/paymentService.js';

// Set bot commands (menu)
export async function setBotCommands(bot) {
  const commands = [
    { command: 'start', description: 'Start The Bot' },
    { command: 'play', description: 'Play Game' },
    { command: 'register', description: 'Register to Play' },
    { command: 'withdraw', description: 'Make a Withdrawal' },
    { command: 'deposit', description: 'Make a Deposit' },
    { command: 'transfer', description: 'Transfer for a Friend' },
    { command: 'checkbalance', description: 'Check Wallet Balance' },
    { command: 'referral', description: 'Get Your Referral Link' },
    { command: 'changename', description: 'Change Your Game Name' },
    { command: 'joinchannel', description: 'Join Cheers Channel' },
    { command: 'gamehistory', description: 'Your Last 10 Game History' },
    { command: 'deposithistory', description: 'Your Last 10 Deposit History' },
    { command: 'withdrawalhistory', description: 'Your Last 10 Withdrawal History' },
    { command: 'tryyourluck', description: 'Try Your Daily Luck Bonus' },
    { command: 'highstakegameluck', description: 'Try Your Daily High Stake Luck' },
    { command: 'referralleaderboard', description: 'Refer & Win X' },
    { command: 'convertbonusbalance', description: 'Convert Your Bonus' },
    { command: 'cancel', description: 'Cancel All Started Commands' }
  ];

  await bot.telegram.setMyCommands(commands);
}

// Command handlers
export async function handleRegister(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (user) {
    return ctx.reply(
      `✅ You are already registered!\n\n` +
      `💰 Balance: ${user.balance} Birr\n` +
      `📱 Phone: ${user.username}\n\n` +
      `Use /play to start playing!`
    );
  }
  
  return ctx.reply('Please use /start to register.');
}

export async function handleWithdraw(ctx) {
  return ctx.reply(
    `💸 Withdrawal Request\n\n` +
    `To withdraw funds:\n` +
    `1. Minimum withdrawal: 50 Birr\n` +
    `2. Processing time: 24 hours\n` +
    `3. Contact admin with your withdrawal request\n\n` +
    `Coming soon: Automated withdrawals!`
  );
}

export async function handleDeposit(ctx) {
  return ctx.reply(
    `💰 Deposit Instructions\n\n` +
    `To deposit funds, use:\n` +
    `/receipt <receipt_number> <amount>\n\n` +
    `Example:\n` +
    `/receipt REC123456 100\n\n` +
    `You can also send a photo of your receipt with the /receipt command in the caption.`
  );
}

export async function handleTransfer(ctx) {
  return ctx.reply(
    `📊 Transfer Funds\n\n` +
    `Transfer funds to another player:\n` +
    `Format: /transfer <username> <amount>\n\n` +
    `Example:\n` +
    `/transfer @friend 50\n\n` +
    `Coming soon!`
  );
}

export async function handleCheckBalance(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ You need to register first. Use /start');
  }
  
  return ctx.reply(
    `💰 Your Balance\n\n` +
    `Main Balance: ${user.balance} Birr\n` +
    `Bonus Balance: 0 Birr\n` +
    `Total: ${user.balance} Birr\n\n` +
    `📊 Account Status: ${user.status}`
  );
}

export async function handleReferral(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ You need to register first. Use /start');
  }
  
  const referralCode = user.id.substring(0, 8);
  const botUsername = ctx.botInfo.username;
  const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;
  
  return ctx.reply(
    `🎁 Your Referral Link\n\n` +
    `Share this link with friends:\n` +
    `${referralLink}\n\n` +
    `Your Referral Code: ${referralCode}\n\n` +
    `Earn 5 Birr for each friend who registers!`
  );
}

export async function handleChangeName(ctx) {
  return ctx.reply(
    `✏️ Change Game Name\n\n` +
    `To change your display name:\n` +
    `Format: /changename <new_name>\n\n` +
    `Example:\n` +
    `/changename Lucky Player\n\n` +
    `Coming soon!`
  );
}

export async function handleJoinChannel(ctx) {
  return ctx.reply(
    `📢 Join Our Channel\n\n` +
    `Stay updated with:\n` +
    `• Game announcements\n` +
    `• Special bonuses\n` +
    `• Tournaments\n` +
    `• Winners\n\n` +
    `Join now: @YourChannelName`
  );
}

export async function handleGameHistory(ctx) {
  return ctx.reply(
    `🎮 Game History\n\n` +
    `Your last 10 games:\n\n` +
    `Coming soon! This will show:\n` +
    `• Game date & time\n` +
    `• Entry fee\n` +
    `• Result (Win/Loss)\n` +
    `• Prize won`
  );
}

export async function handleDepositHistory(ctx) {
  return ctx.reply(
    `💰 Deposit History\n\n` +
    `Your last 10 deposits:\n\n` +
    `Coming soon! This will show:\n` +
    `• Date & time\n` +
    `• Amount\n` +
    `• Status\n` +
    `• Receipt number`
  );
}

export async function handleWithdrawalHistory(ctx) {
  return ctx.reply(
    `💸 Withdrawal History\n\n` +
    `Your last 10 withdrawals:\n\n` +
    `Coming soon! This will show:\n` +
    `• Date & time\n` +
    `• Amount\n` +
    `• Status\n` +
    `• Transaction ID`
  );
}

export async function handleTryYourLuck(ctx) {
  return ctx.reply(
    `🎰 Daily Luck Bonus\n\n` +
    `Try your luck once per day!\n` +
    `Win between 1-10 Birr\n\n` +
    `Coming soon!`
  );
}

export async function handleHighStakeGameLuck(ctx) {
  return ctx.reply(
    `🎲 High Stake Daily Luck\n\n` +
    `Try your high stake luck once per day!\n` +
    `Win between 10-100 Birr\n\n` +
    `Coming soon!`
  );
}

export async function handleReferralLeaderboard(ctx) {
  return ctx.reply(
    `🏆 Referral Leaderboard\n\n` +
    `Top referrers this month:\n\n` +
    `Coming soon! Compete to win prizes!`
  );
}

export async function handleConvertBonusBalance(ctx) {
  return ctx.reply(
    `💱 Convert Bonus Balance\n\n` +
    `Convert your bonus balance to main balance\n` +
    `Conversion rate: 1:1\n\n` +
    `Coming soon!`
  );
}

export async function handleCancel(ctx) {
  return ctx.reply(
    `❌ All operations cancelled.\n\n` +
    `Use /start to begin again.`
  );
}
