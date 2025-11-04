import { Markup } from 'telegraf';
import { getUserByTelegramId, createUser } from '../services/paymentService.js';

const STARTING_BONUS = 5; // Starting bonus in Birr

export async function handleStart(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username;
    const firstName = ctx.from.first_name || 'User';

    // Check if user exists
    let user = await getUserByTelegramId(telegramId);

    // Welcome message with image and buttons
    const welcomeMessage = user 
      ? `👋 እንኳን ደህና መጡ ${firstName}!\n\n💰 ቀሪ ሂሳብ: ${user.balance} ብር\n📊 ሁኔታ: ${user.status === 'active' ? 'ንቁ' : 'በመጠባበቅ ላይ'}\n\nየቢንጎ ጨዋታዎችን ለመጫወት ዝግጁ ነዎት!`
      : `👋 እንኳን ደህና መጡ ወደ ቢንጎ ቫልት!\n\n🎮 የኢትዮጵያ #1 የቢንጎ መድረክ\n💰 ይመዝገቡ እና 5 ብር ነፃ ቦነስ ያግኙ!\n\nለመጀመር እባክዎን ይመዝገቡ 👇`;

    const keyboard = user
      ? Markup.keyboard([
          [{ text: '🎮 Play' }, { text: '💰 Deposit' }],
          [{ text: '💸 Withdraw' }, { text: '📊 Transfer' }],
          [{ text: '📢 Join Channel' }]
        ]).resize()
      : Markup.keyboard([
          [{ text: '📝 Register' }, { text: '🎮 Play' }],
          [{ text: '💰 Deposit' }, { text: '📢 Join Channel' }],
          [{ text: '💸 Withdraw' }, { text: '📊 Transfer' }]
        ]).resize();

    return ctx.reply(welcomeMessage, keyboard);
  } catch (error) {
    console.error('Error in start command:', error);
    return ctx.reply('❌ ስህተት ተከስቷል። እባክዎን እንደገና ይሞክሩ።');
  }
}

// Handle registration button
export async function handleRegister(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    
    // Check if already registered
    const user = await getUserByTelegramId(telegramId);
    if (user) {
      return ctx.reply(
        `✅ እርስዎ ቀድሞውኑ ተመዝግበዋል!\n\n` +
        `💰 ቀሪ ሂሳብ: ${user.balance} ብር\n` +
        `📱 ስልክ: ${user.username}\n\n` +
        `ለመጫወት /play ይጫኑ!`
      );
    }

    // Request contact sharing
    return ctx.reply(
      'እባክዎን የእርስዎን የእውቂያ መረጃ ለመመዝገብ ያጋሩ።',
      Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Contact')],
        [{ text: '❌ Cancel' }]
      ]).resize().oneTime()
    );
  } catch (error) {
    console.error('Error in register:', error);
    return ctx.reply('❌ ስህተት ተከስቷል። እባክዎን እንደገና ይሞክሩ።');
  }
}

// Handle contact sharing
export async function handleContact(ctx) {
  try {
    const contact = ctx.message.contact;
    const telegramId = ctx.from.id.toString();
    
    // Verify it's their own contact
    if (contact.user_id.toString() !== telegramId) {
      return ctx.reply('❌ እባክዎን የራስዎን የእውቂያ መረጃ ያጋሩ።');
    }

    const phoneNumber = contact.phone_number;
    const firstName = contact.first_name;
    const lastName = contact.last_name || '';

    // Create user with starting bonus
    const result = await createUser(telegramId, phoneNumber, STARTING_BONUS);
    
    if (!result.success) {
      return ctx.reply('❌ መመዝገብ አልተሳካም። እባክዎን እንደገና ይሞክሩ።');
    }

    const user = result.user;

    // Success message
    const keyboard = Markup.keyboard([
      [{ text: '🎮 Play' }, { text: '💰 Deposit' }],
      [{ text: '💸 Withdraw' }, { text: '📊 Transfer' }],
      [{ text: '📢 Join Channel' }]
    ]).resize();

    return ctx.reply(
      `✅ መመዝገብ ተሳክቷል!\n\n` +
      `ስም: ${firstName} ${lastName}\n` +
      `ስልክ: ${phoneNumber}\n` +
      `ቀሪ ሂሳብ: ${user.balance} ብር\n` +
      `የማስተዋወቂያ ኮድ: ${user.id.substring(0, 8)}\n\n` +
      `🎁 እንኳን ደስ አለዎት! ${STARTING_BONUS} ብር ቦነስ ተቀብለዋል!\n\n` +
      `አሁን ለመጫወት ዝግጁ ነዎት! 🎮`,
      keyboard
    );
  } catch (error) {
    console.error('Error handling contact:', error);
    return ctx.reply('❌ ስህተት ተከስቷል። እባክዎን እንደገና ይሞክሩ።');
  }
}
