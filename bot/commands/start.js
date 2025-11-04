import { getUserByTelegramId, createUser } from '../services/paymentService.js';

export async function handleStart(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name || 'User';

    // Check if user exists
    let user = await getUserByTelegramId(telegramId);

    if (!user) {
      // Create new user
      const result = await createUser(telegramId, username);
      if (!result.success) {
        return ctx.reply('❌ Error creating account. Please try again.');
      }
      user = result.user;

      return ctx.reply(
        `🎮 Welcome to Bingo Vault, ${username}!\n\n` +
        `Your account has been created.\n` +
        `Current balance: 💰 ${user.balance} Birr\n\n` +
        `📝 To get started:\n` +
        `1. Send a payment receipt using /receipt <receipt_number>\n` +
        `2. Wait for admin approval\n` +
        `3. Play Bingo with /play\n\n` +
        `Use /help to see all commands.`
      );
    }

    // Existing user
    return ctx.reply(
      `👋 Welcome back, ${username}!\n\n` +
      `💰 Balance: ${user.balance} Birr\n` +
      `📊 Status: ${user.status}\n\n` +
      `Use /help to see available commands.`
    );
  } catch (error) {
    console.error('Error in start command:', error);
    return ctx.reply('❌ An error occurred. Please try again.');
  }
}
