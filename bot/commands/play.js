import { Markup } from 'telegraf';
import { getUserByTelegramId } from '../services/paymentService.js';
import { getActiveGame, joinGame, getGamePlayersCount } from '../services/gameService.js';
import { formatBingoCard } from '../utils/bingoEngine.js';

const MIN_PLAYERS = 2; // Minimum players to start a game
const GAME_ENTRY_FEE = 5;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-mini-app.vercel.app';

export async function handlePlay(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply(
        '❌ እባክዎን መጀመሪያ ይመዝገቡ።\n\nየመመዝገብ ቁልፍን ይጫኑ 📝',
        Markup.keyboard([
          [{ text: '📝 Register' }]
        ]).resize()
      );
    }

    // Show game options with Mini App button
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.webApp('🎮 Launch Game', `${MINI_APP_URL}?userId=${user.id}`)],
      [Markup.button.callback('💰 Check Balance', 'check_balance')]
    ]);

    return ctx.reply(
      `🎮 ቢንጎ ጨዋታ\n\n` +
      `💰 ቀሪ ሂሳብ: ${user.balance} ብር\n` +
      `🎯 የመግቢያ ክፍያ: 5-100 ብር\n\n` +
      `ጨዋታውን ለመጀመር ከታች ያለውን ቁልፍ ይጫኑ 👇`,
      keyboard
    );
  } catch (error) {
    console.error('Error in play command:', error);
    return ctx.reply('❌ ስህተት ተከስቷል። እባክዎን እንደገና ይሞክሩ።');
  }
}

export async function handleStatus(ctx) {
  try {
    const game = await getActiveGame();
    
    if (!game) {
      return ctx.reply('📊 No active game at the moment.\n\nUse /play to start a new game!');
    }

    const playersCount = await getGamePlayersCount(game.id);
    
    let message = `📊 Current Game Status\n\n`;
    message += `🎮 Status: ${game.status === 'waiting' ? '⏳ Waiting for players' : '🎲 In Progress'}\n`;
    message += `👥 Players: ${playersCount}\n`;
    message += `💰 Prize Pool: ${game.prize_pool} Birr\n`;
    
    if (game.status === 'active' && game.called_numbers) {
      const calledNumbers = game.called_numbers;
      message += `🔢 Numbers called: ${calledNumbers.length}\n`;
      if (calledNumbers.length > 0) {
        const lastFive = calledNumbers.slice(-5);
        message += `📍 Last numbers: ${lastFive.join(', ')}\n`;
      }
    }

    return ctx.reply(message);
  } catch (error) {
    console.error('Error in status command:', error);
    return ctx.reply('❌ Error fetching game status.');
  }
}
