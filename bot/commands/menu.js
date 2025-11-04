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
      `📱 Phone: ${user.username}\n` +
      `🎁 Referral Code: ${user.id.substring(0, 8)}\n\n` +
      `Use /play to start playing!`
    );
  }
  
  return ctx.reply(
    '📝 Registration Required\n\n' +
    'Please use /start to register and get your 5 Birr welcome bonus!'
  );
}

export async function handleWithdraw(ctx) {
  const { Markup } = await import('telegraf');
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  if (user.balance < 50) {
    return ctx.reply(
      `💸 Withdrawal\n\n` +
      `❌ Insufficient balance!\n\n` +
      `💰 Your balance: ${user.balance} Birr\n` +
      `📊 Minimum withdrawal: 50 Birr\n\n` +
      `Play more games to increase your balance!`
    );
  }
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📱 Telebirr', 'withdraw_telebirr'),
      Markup.button.callback('🏦 CBE', 'withdraw_cbe')
    ],
    [Markup.button.callback('❌ Cancel', 'withdraw_cancel')]
  ]);
  
  return ctx.reply(
    `💸 Withdrawal Request\n\n` +
    `💰 Available balance: ${user.balance} Birr\n` +
    `📊 Minimum: 50 Birr\n` +
    `⏱ Processing time: 24 hours\n\n` +
    `Please select your withdrawal method:`,
    keyboard
  );
}

export async function handleDeposit(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // Use the new payment handler
  const { handleDepositRequest } = await import('../services/paymentHandler.js');
  return handleDepositRequest(ctx);
}

export async function handleTransfer(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  return ctx.reply(
    `📊 Transfer Funds\n\n` +
    `💰 Your balance: ${user.balance} Birr\n\n` +
    `Transfer to another player:\n` +
    `Format: /transfer <phone> <amount>\n\n` +
    `Example:\n` +
    `/transfer 0912345678 50\n\n` +
    `📝 Rules:\n` +
    `• Minimum: 10 Birr\n` +
    `• Fee: 2% of amount\n` +
    `• Instant transfer\n\n` +
    `⚠️ Coming soon!`
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
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // TODO: Fetch actual game history from database
  return ctx.reply(
    `🎮 Game History\n\n` +
    `📊 Your Stats:\n` +
    `• Total games: 0\n` +
    `• Games won: 0\n` +
    `• Total winnings: 0 Birr\n` +
    `• Win rate: 0%\n\n` +
    `Last 10 games:\n` +
    `No games played yet.\n\n` +
    `Start playing with /play!`
  );
}

export async function handleDepositHistory(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // TODO: Fetch actual deposit history
  return ctx.reply(
    `💰 Deposit History\n\n` +
    `📊 Summary:\n` +
    `• Total deposits: 0\n` +
    `• Total amount: 0 Birr\n` +
    `• Pending: 0\n` +
    `• Approved: 0\n\n` +
    `Last 10 deposits:\n` +
    `No deposits yet.\n\n` +
    `Deposit now with /deposit!`
  );
}

export async function handleWithdrawalHistory(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // TODO: Fetch actual withdrawal history
  return ctx.reply(
    `💸 Withdrawal History\n\n` +
    `📊 Summary:\n` +
    `• Total withdrawals: 0\n` +
    `• Total amount: 0 Birr\n` +
    `• Pending: 0\n` +
    `• Completed: 0\n\n` +
    `Last 10 withdrawals:\n` +
    `No withdrawals yet.\n\n` +
    `Withdraw with /withdraw!`
  );
}

export async function handleTryYourLuck(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // Simple random bonus (1-10 Birr)
  const bonus = Math.floor(Math.random() * 10) + 1;
  
  // TODO: Check if already claimed today
  // TODO: Update user balance
  
  return ctx.reply(
    `🎰 Daily Luck Bonus\n\n` +
    `🎉 Congratulations!\n` +
    `You won: ${bonus} Birr\n\n` +
    `💰 New balance: ${user.balance + bonus} Birr\n\n` +
    `Come back tomorrow for another chance!`
  );
}

export async function handleHighStakeGameLuck(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  if (user.balance < 20) {
    return ctx.reply(
      `🎲 High Stake Daily Luck\n\n` +
      `❌ Insufficient balance!\n\n` +
      `💰 Your balance: ${user.balance} Birr\n` +
      `📊 Required: 20 Birr\n\n` +
      `Win between 10-100 Birr!\n` +
      `Play games to increase your balance.`
    );
  }
  
  // Random bonus (10-100 Birr) or loss
  const won = Math.random() > 0.5;
  const amount = won ? Math.floor(Math.random() * 91) + 10 : -20;
  
  // TODO: Check if already played today
  // TODO: Update user balance
  
  if (won) {
    return ctx.reply(
      `🎲 High Stake Daily Luck\n\n` +
      `🎉 BIG WIN!\n` +
      `You won: ${amount} Birr\n\n` +
      `💰 New balance: ${user.balance + amount} Birr\n\n` +
      `Amazing! Come back tomorrow!`
    );
  } else {
    return ctx.reply(
      `🎲 High Stake Daily Luck\n\n` +
      `😔 Better luck next time!\n` +
      `You lost: 20 Birr\n\n` +
      `💰 New balance: ${user.balance - 20} Birr\n\n` +
      `Try again tomorrow!`
    );
  }
}

export async function handleReferralLeaderboard(ctx) {
  // TODO: Fetch actual leaderboard data
  return ctx.reply(
    `🏆 Referral Leaderboard\n\n` +
    `Top Referrers This Month:\n\n` +
    `🥇 1. Player1 - 25 referrals\n` +
    `🥈 2. Player2 - 18 referrals\n` +
    `🥉 3. Player3 - 15 referrals\n` +
    `4. Player4 - 12 referrals\n` +
    `5. Player5 - 10 referrals\n\n` +
    `🎁 Prizes:\n` +
    `• 1st place: 500 Birr\n` +
    `• 2nd place: 300 Birr\n` +
    `• 3rd place: 200 Birr\n\n` +
    `Share your referral link with /referral!`
  );
}

export async function handleConvertBonusBalance(ctx) {
  const telegramId = ctx.from.id.toString();
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // TODO: Implement bonus balance system
  const bonusBalance = 0;
  
  if (bonusBalance === 0) {
    return ctx.reply(
      `💱 Convert Bonus Balance\n\n` +
      `💰 Main balance: ${user.balance} Birr\n` +
      `🎁 Bonus balance: ${bonusBalance} Birr\n\n` +
      `No bonus balance to convert.\n\n` +
      `Earn bonus from:\n` +
      `• Daily luck (/tryyourluck)\n` +
      `• Referrals (/referral)\n` +
      `• Special promotions`
    );
  }
  
  return ctx.reply(
    `💱 Convert Bonus Balance\n\n` +
    `💰 Main balance: ${user.balance} Birr\n` +
    `🎁 Bonus balance: ${bonusBalance} Birr\n\n` +
    `Conversion rate: 1:1\n` +
    `No fees!\n\n` +
    `Convert now? (Coming soon)`
  );
}

export async function handleCancel(ctx) {
  const { cancelUserAction } = await import('../services/paymentHandler.js');
  cancelUserAction(ctx.from.id.toString());
  
  return ctx.reply(
    `❌ All operations cancelled.\n\n` +
    `Use /start to begin again.`
  );
}
