import { getUserByTelegramId, getPendingPayments } from '../services/paymentService.js';

export async function handleBalance(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('❌ You need to register first. Use /start');
    }

    const pendingPayments = await getPendingPayments(user.id);
    const pendingCount = pendingPayments.length;

    let message = `💰 Your Balance: ${user.balance} Birr\n`;
    message += `📊 Account Status: ${user.status}\n\n`;

    if (pendingCount > 0) {
      message += `⏳ Pending Payments: ${pendingCount}\n`;
      message += `Waiting for admin approval...\n\n`;
    }

    message += `💡 Tip: Each game costs 10 Birr to play.`;

    return ctx.reply(message);
  } catch (error) {
    console.error('Error in balance command:', error);
    return ctx.reply('❌ Error fetching balance. Please try again.');
  }
}
