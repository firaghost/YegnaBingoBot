import { getUserByTelegramId, submitPayment } from '../services/paymentService.js';

export async function handleReceipt(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('❌ You need to register first. Use /start');
    }

    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
      return ctx.reply(
        '📝 How to submit a receipt:\n\n' +
        'Usage: /receipt <receipt_number> [amount]\n\n' +
        'Example: /receipt REC123456 100\n' +
        'Or: /receipt REC123456\n\n' +
        'You can also send a photo of your receipt with the caption:\n' +
        '/receipt <receipt_number>'
      );
    }

    const receiptNumber = parts[1];
    const amount = parts[2] ? parseFloat(parts[2]) : null;

    // Check if there's a photo
    let imageUrl = null;
    if (ctx.message.photo && ctx.message.photo.length > 0) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      imageUrl = photo.file_id; // Store file_id for later retrieval
    }

    const result = await submitPayment(user.id, receiptNumber, imageUrl, amount);

    if (!result.success) {
      return ctx.reply('❌ Error submitting receipt. Please try again.');
    }

    return ctx.reply(
      `✅ Receipt submitted successfully!\n\n` +
      `📄 Receipt Number: ${receiptNumber}\n` +
      `${amount ? `💵 Amount: ${amount} Birr\n` : ''}` +
      `⏳ Status: Pending approval\n\n` +
      `Your payment will be reviewed by an admin shortly.\n` +
      `Use /balance to check your status.`
    );
  } catch (error) {
    console.error('Error in receipt command:', error);
    return ctx.reply('❌ Error submitting receipt. Please try again.');
  }
}

export async function handleReceiptPhoto(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('❌ You need to register first. Use /start');
    }

    const caption = ctx.message.caption || '';
    const parts = caption.split(' ');

    if (parts[0] !== '/receipt' || parts.length < 2) {
      return ctx.reply(
        '📸 To submit a receipt photo, use:\n\n' +
        'Send the photo with caption:\n' +
        '/receipt <receipt_number> [amount]\n\n' +
        'Example: /receipt REC123456 100'
      );
    }

    const receiptNumber = parts[1];
    const amount = parts[2] ? parseFloat(parts[2]) : null;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const imageUrl = photo.file_id;

    const result = await submitPayment(user.id, receiptNumber, imageUrl, amount);

    if (!result.success) {
      return ctx.reply('❌ Error submitting receipt. Please try again.');
    }

    return ctx.reply(
      `✅ Receipt photo submitted successfully!\n\n` +
      `📄 Receipt Number: ${receiptNumber}\n` +
      `${amount ? `💵 Amount: ${amount} Birr\n` : ''}` +
      `⏳ Status: Pending approval\n\n` +
      `Your payment will be reviewed by an admin shortly.`
    );
  } catch (error) {
    console.error('Error in receipt photo handler:', error);
    return ctx.reply('❌ Error submitting receipt. Please try again.');
  }
}
