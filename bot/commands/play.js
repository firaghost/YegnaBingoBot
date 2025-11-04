import { getUserByTelegramId } from '../services/paymentService.js';
import { getActiveGame, joinGame, getGamePlayersCount } from '../services/gameService.js';
import { formatBingoCard } from '../utils/bingoEngine.js';

const MIN_PLAYERS = 2; // Minimum players to start a game
const GAME_ENTRY_FEE = 10;

export async function handlePlay(ctx) {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('❌ You need to register first. Use /start');
    }

    if (user.balance < GAME_ENTRY_FEE) {
      return ctx.reply(
        `❌ Insufficient balance!\n\n` +
        `💰 Your balance: ${user.balance} Birr\n` +
        `🎮 Required: ${GAME_ENTRY_FEE} Birr\n\n` +
        `Please deposit funds using /receipt`
      );
    }

    // Get or create active game
    const game = await getActiveGame();
    if (!game) {
      return ctx.reply('❌ Error creating game. Please try again.');
    }

    // Check if game is already active
    if (game.status === 'active') {
      return ctx.reply(
        `🎮 A game is currently in progress!\n\n` +
        `Please wait for it to finish.\n` +
        `Use /status to check game status.`
      );
    }

    // Join the game
    const result = await joinGame(game.id, user.id, user.balance);

    if (!result.success) {
      return ctx.reply(`❌ ${result.error}`);
    }

    // Get current players count
    const playersCount = await getGamePlayersCount(game.id);

    // Format and send the Bingo card
    const cardDisplay = formatBingoCard(result.card);
    
    let message = `🎉 You've joined the game!\n\n`;
    message += `💰 Entry fee: ${GAME_ENTRY_FEE} Birr\n`;
    message += `💵 New balance: ${user.balance - GAME_ENTRY_FEE} Birr\n`;
    message += `👥 Players in game: ${playersCount}\n\n`;
    message += `🎲 Your Bingo Card:\n\n`;
    message += `\`\`\`\n${cardDisplay}\`\`\`\n`;
    
    if (playersCount < MIN_PLAYERS) {
      message += `\n⏳ Waiting for more players (${MIN_PLAYERS - playersCount} more needed)...\n`;
      message += `The game will start automatically when enough players join.`;
    } else {
      message += `\n✅ Game is ready to start!\n`;
      message += `Waiting for admin to begin...`;
    }

    return ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in play command:', error);
    return ctx.reply('❌ Error joining game. Please try again.');
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
