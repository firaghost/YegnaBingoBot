import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import { supabase } from '../lib/supabase.js'

const BOT_TOKEN = process.env.BOT_TOKEN!
const MINI_APP_URL = process.env.MINI_APP_URL || 'http://localhost:3000'

const bot = new Telegraf(BOT_TOKEN)

// Start command
bot.command('start', async (ctx) => {
  const userId = ctx.from.id
  const username = ctx.from.username || ctx.from.first_name

  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .single()

    if (!existingUser) {
      // Create new user
      await supabase
        .from('users')
        .insert({
          telegram_id: userId.toString(),
          username: username,
          balance: 0,
          status: 'active'
        })
    }

    await ctx.reply(
      `🎰 *Welcome to Bingo Royale!*\n\n` +
      `Hello ${username}! 👋\n\n` +
      `Get ready for exciting bingo games with real prizes!\n\n` +
      `✨ *Features:*\n` +
      `💰 Win ETB prizes\n` +
      `🎮 Multiple game rooms\n` +
      `⚡ Real-time gameplay\n` +
      `🏆 Leaderboard rankings\n` +
      `💸 Easy deposit & withdrawal\n\n` +
      `Tap the button below to start playing!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.callback('💰 Balance', 'balance')],
          [Markup.button.callback('🏆 Leaderboard', 'leaderboard')],
          [Markup.button.callback('❓ Help', 'help')]
        ])
      }
    )
  } catch (error) {
    console.error('Error in start command:', error)
    await ctx.reply('Sorry, something went wrong. Please try again later.')
  }
})

// Balance command
bot.command('balance', async (ctx) => {
  const userId = ctx.from.id

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance, games_played, games_won')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.reply('You need to /start first!')
      return
    }

    await ctx.reply(
      `💰 *Your Account*\n\n` +
      `Balance: *${user.balance} ETB*\n` +
      `Games Played: ${user.games_played || 0}\n` +
      `Games Won: ${user.games_won || 0}\n` +
      `Win Rate: ${user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : 0}%`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('💸 Deposit', `${MINI_APP_URL}/deposit`)],
          [Markup.button.webApp('💰 Withdraw', `${MINI_APP_URL}/withdraw`)],
          [Markup.button.webApp('🎮 Play Game', MINI_APP_URL)]
        ])
      }
    )
  } catch (error) {
    console.error('Error in balance command:', error)
    await ctx.reply('Failed to fetch balance. Please try again.')
  }
})

// Play command
bot.command('play', async (ctx) => {
  const userId = ctx.from.id

  try {
    // Fetch available rooms from Supabase
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'active')
      .order('stake', { ascending: true })

    if (!rooms || rooms.length === 0) {
      await ctx.reply('No game rooms available at the moment. Please try again later.')
      return
    }

    let message = '🎮 *Choose Your Game Room:*\n\n'
    
    const buttons = rooms.map(room => {
      const emoji = room.stake <= 10 ? '🎯' : room.stake <= 50 ? '⚡' : '💎'
      return [Markup.button.webApp(`${emoji} ${room.name} (${room.stake} ETB)`, `${MINI_APP_URL}/lobby`)]
    })

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    })
  } catch (error) {
    console.error('Error in play command:', error)
    await ctx.reply('Failed to fetch game rooms. Please try again.')
  }
})

// Leaderboard command
bot.command('leaderboard', async (ctx) => {
  try {
    const { data: leaderboard } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(10)

    if (!leaderboard || leaderboard.length === 0) {
      await ctx.reply('No leaderboard data yet. Be the first to play!')
      return
    }

    let message = '🏆 *Top 10 Players*\n\n'
    leaderboard.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
      message += `${medal} ${player.username}\n`
      message += `   💰 ${player.total_winnings} ETB | 🎯 ${player.total_wins} wins\n\n`
    })

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 View Full Leaderboard', `${MINI_APP_URL}/leaderboard`)]
      ])
    })
  } catch (error) {
    console.error('Error in leaderboard command:', error)
    await ctx.reply('Failed to fetch leaderboard. Please try again.')
  }
})

// Help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 *Bingo Royale Help*\n\n` +
    `*Commands:*\n` +
    `/start - Start the bot\n` +
    `/play - Join a game\n` +
    `/balance - Check your balance\n` +
    `/leaderboard - View top players\n` +
    `/help - Show this help message\n\n` +
    `*How to Play:*\n` +
    `1. Deposit funds to your account\n` +
    `2. Choose a game room\n` +
    `3. Mark numbers as they're called\n` +
    `4. Complete a row, column, or diagonal to win!\n\n` +
    `*Need Support?*\n` +
    `Contact @YourSupportUsername`,
    { parse_mode: 'Markdown' }
  )
})

// Callback query handlers
bot.action('balance', async (ctx) => {
  await ctx.answerCbQuery()
  const userId = ctx.from.id

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', userId.toString())
      .single()

    await ctx.reply(`💰 Your balance: *${user?.balance || 0} ETB*`, { parse_mode: 'Markdown' })
  } catch (error) {
    await ctx.reply('Failed to fetch balance.')
  }
})

bot.action('leaderboard', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply(
    'View the leaderboard:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🏆 Leaderboard', `${MINI_APP_URL}/leaderboard`)]
    ])
  )
})

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply(
    `📖 *Bingo Royale Help*\n\n` +
    `*Commands:*\n` +
    `/start - Start the bot\n` +
    `/play - Join a game\n` +
    `/balance - Check your balance\n` +
    `/deposit - Deposit funds\n` +
    `/withdraw - Withdraw winnings\n` +
    `/leaderboard - View top players\n` +
    `/help - Show this help message\n\n` +
    `*How to Play:*\n` +
    `1. Deposit funds to your account\n` +
    `2. Choose a game room\n` +
    `3. Mark numbers as they're called\n` +
    `4. Complete a row, column, or diagonal to win!\n\n` +
    `*Need Support?*\n` +
    `Contact @YourSupportUsername`,
    { parse_mode: 'Markdown' }
  )
})

// Deposit command
bot.command('deposit', async (ctx) => {
  await ctx.reply(
    '💸 *Deposit Funds*\n\n' +
    'Click the button below to deposit funds to your account:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('💰 Deposit Now', `${MINI_APP_URL}/deposit`)]
      ])
    }
  )
})

// Withdraw command
bot.command('withdraw', async (ctx) => {
  const userId = ctx.from.id

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user || user.balance < 100) {
      await ctx.reply(
        '⚠️ *Insufficient Balance*\n\n' +
        `Your balance: ${user?.balance || 0} ETB\n` +
        'Minimum withdrawal: 100 ETB',
        { parse_mode: 'Markdown' }
      )
      return
    }

    await ctx.reply(
      '💰 *Withdraw Funds*\n\n' +
      `Available balance: ${user.balance} ETB\n\n` +
      'Click the button below to request a withdrawal:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('💸 Withdraw Now', `${MINI_APP_URL}/withdraw`)]
        ])
      }
    )
  } catch (error) {
    console.error('Error in withdraw command:', error)
    await ctx.reply('Failed to process withdrawal request. Please try again.')
  }
})

// Account/Profile command
bot.command('account', async (ctx) => {
  await ctx.reply(
    '👤 *Your Account*\n\n' +
    'View your complete profile and statistics:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 View Profile', `${MINI_APP_URL}/account`)]
      ])
    }
  )
})

// Rooms command
bot.command('rooms', async (ctx) => {
  try {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'active')
      .order('stake', { ascending: true })

    if (!rooms || rooms.length === 0) {
      await ctx.reply('No game rooms available at the moment.')
      return
    }

    let message = '🎮 *Available Game Rooms:*\n\n'
    
    rooms.forEach(room => {
      const emoji = room.stake <= 10 ? '🎯' : room.stake <= 50 ? '⚡' : '💎'
      message += `${emoji} *${room.name}*\n`
      message += `   Entry: ${room.stake} ETB\n`
      message += `   Max Players: ${room.max_players}\n`
      message += `   Current: ${room.current_players || 0} players\n\n`
    })

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Join Game', `${MINI_APP_URL}/lobby`)]
      ])
    })
  } catch (error) {
    console.error('Error in rooms command:', error)
    await ctx.reply('Failed to fetch game rooms.')
  }
})

// Inline query handler
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query.toLowerCase()
  
  try {
    const results = []

    // Game rooms inline results
    if (query.includes('room') || query.includes('game') || query === '') {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'active')
        .order('stake', { ascending: true })

      if (rooms) {
        rooms.forEach((room, index) => {
          const emoji = room.stake <= 10 ? '🎯' : room.stake <= 50 ? '⚡' : '💎'
          results.push({
            type: 'article',
            id: `room_${room.id}`,
            title: `${emoji} ${room.name}`,
            description: `Entry: ${room.stake} ETB | Players: ${room.current_players}/${room.max_players}`,
            input_message_content: {
              message_text: `🎮 *${room.name}*\n\nEntry Fee: ${room.stake} ETB\nPlayers: ${room.current_players}/${room.max_players}\nPrize Pool: ${room.prize_pool} ETB\n\n${room.description}`,
              parse_mode: 'Markdown'
            },
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 Join Game', web_app: { url: `${MINI_APP_URL}/game/${room.id}` } }]
              ]
            }
          })
        })
      }
    }

    // Balance inline result
    if (query.includes('balance') || query.includes('account')) {
      const userId = ctx.inlineQuery.from.id
      const { data: user } = await supabase
        .from('users')
        .select('balance, games_played, games_won')
        .eq('telegram_id', userId.toString())
        .single()

      if (user) {
        results.push({
          type: 'article',
          id: 'balance',
          title: '💰 My Balance',
          description: `${user.balance} ETB | ${user.games_won}/${user.games_played} wins`,
          input_message_content: {
            message_text: `💰 *My Account*\n\nBalance: ${user.balance} ETB\nGames Played: ${user.games_played}\nGames Won: ${user.games_won}\nWin Rate: ${user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : 0}%`,
            parse_mode: 'Markdown'
          }
        })
      }
    }

    // Leaderboard inline result
    if (query.includes('leader') || query.includes('top')) {
      const { data: leaderboard } = await supabase
        .from('users')
        .select('username, total_winnings, games_won')
        .order('total_winnings', { ascending: false })
        .limit(5)

      if (leaderboard && leaderboard.length > 0) {
        let leaderText = '🏆 *Top Players*\n\n'
        leaderboard.forEach((player, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
          leaderText += `${medal} ${player.username} - ${player.total_winnings} ETB\n`
        })

        results.push({
          type: 'article',
          id: 'leaderboard',
          title: '🏆 Leaderboard',
          description: 'View top players',
          input_message_content: {
            message_text: leaderText,
            parse_mode: 'Markdown'
          },
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Full Leaderboard', web_app: { url: `${MINI_APP_URL}/leaderboard` } }]
            ]
          }
        })
      }
    }

    // Help inline result
    if (query.includes('help') || query.includes('command')) {
      results.push({
        type: 'article',
        id: 'help',
        title: '📖 Help & Commands',
        description: 'View all available commands',
        input_message_content: {
          message_text: `📖 *Bingo Royale Commands*\n\n/start - Start the bot\n/play - Join a game\n/balance - Check balance\n/deposit - Deposit funds\n/withdraw - Withdraw winnings\n/leaderboard - View rankings\n/rooms - View game rooms\n/account - View profile\n/help - Show help`,
          parse_mode: 'Markdown'
        }
      })
    }

    // Default: Show play option
    if (results.length === 0) {
      results.push({
        type: 'article',
        id: 'play',
        title: '🎮 Play Bingo Royale',
        description: 'Start playing now!',
        input_message_content: {
          message_text: '🎰 *Bingo Royale*\n\nJoin exciting bingo games and win real prizes!',
          parse_mode: 'Markdown'
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Play Now', web_app: { url: MINI_APP_URL } }]
          ]
        }
      })
    }

    await ctx.answerInlineQuery(results, {
      cache_time: 10,
      is_personal: true
    })
  } catch (error) {
    console.error('Inline query error:', error)
    await ctx.answerInlineQuery([])
  }
})

// History command
bot.command('history', async (ctx) => {
  await ctx.reply(
    '📜 *Game History*\n\n' +
    'View your complete game and transaction history:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 View History', `${MINI_APP_URL}/history`)]
      ])
    }
  )
})

// Stats command
bot.command('stats', async (ctx) => {
  const userId = ctx.from.id

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.reply('You need to /start first!')
      return
    }

    const winRate = user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : '0.0'

    await ctx.reply(
      `📊 *Your Statistics*\n\n` +
      `💰 Balance: ${user.balance} ETB\n` +
      `🎮 Games Played: ${user.games_played}\n` +
      `🏆 Games Won: ${user.games_won}\n` +
      `📈 Win Rate: ${winRate}%\n` +
      `💵 Total Winnings: ${user.total_winnings} ETB\n\n` +
      `Keep playing to improve your stats!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Game', MINI_APP_URL)],
          [Markup.button.webApp('📊 Full Stats', `${MINI_APP_URL}/account`)]
        ])
      }
    )
  } catch (error) {
    console.error('Error in stats command:', error)
    await ctx.reply('Failed to fetch statistics.')
  }
})

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err)
})

// Launch bot
export function startBot() {
  bot.launch()
  console.log('✅ Telegram bot started successfully')
  console.log('📱 Inline mode enabled')
  console.log('🎮 All commands registered')

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

export default bot
