import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import { supabase } from '../lib/supabase'
import { getConfig } from '../lib/admin-config'

const BOT_TOKEN = process.env.BOT_TOKEN!
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yegnagame.vercel.app'

const bot = new Telegraf(BOT_TOKEN)

// Helper function to get level badge
function getLevelBadge(level: number): string {
  if (level <= 10) return 'Beginner'
  if (level <= 25) return 'Intermediate'
  if (level <= 50) return 'Advanced'
  if (level <= 75) return 'Expert'
  return 'Legend'
}

// ============================================
// MAIN COMMANDS (Organized & Clean)
// ============================================

// 1. START - Register & get 3 ETB bonus
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id
  const username = ctx.from?.username || ctx.from?.first_name || 'Player'
  const firstName = ctx.from?.first_name || 'Player'

  if (!userId) return

  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .maybeSingle()

    if (!existingUser) {
      // New user - Show registration button
      await ctx.reply(
        `🎰 *Welcome to BingoX!*\n\n` +
        `Hello ${firstName}! 👋\n\n` +
        `To get started, please register by clicking the button below.\n` +
        `You'll receive *3 ETB bonus* just for joining!\n\n` +
        `✨ *What you'll get:*\n` +
        `🎁 3 ETB registration bonus\n` +
        `💰 Win real ETB prizes\n` +
        `🎮 Multiple game rooms\n` +
        `⚡ Real-time gameplay\n` +
        `🏆 Leaderboard rankings\n` +
        `🔥 Daily streak bonuses\n\n` +
        `📢 *Join our official channel for updates:*\n` +
        `https://t.me/BingoXofficial\n\n` +
        `Click "Register Now" to begin!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Register Now', 'register')],
            [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')],
            [Markup.button.callback('❓ Help', 'help')]
          ])
        }
      )
    } else {
      // Existing user
      await ctx.reply(
        `👋 *Welcome back, ${username}!*\n\n` +
        `Ready to play some bingo?\n\n` +
        `💰 Balance: ${existingUser.balance.toFixed(2)} ETB\n` +
        `🎁 Bonus: ${(existingUser.bonus_balance || 0).toFixed(2)} ETB\n` +
        `🎮 Games Played: ${existingUser.games_played}\n` +
        `🏆 Games Won: ${existingUser.games_won}\n` +
        `🔥 Daily Streak: ${existingUser.daily_streak || 0} days\n\n` +
        `📢 *Join our channel:* https://t.me/BingoXofficial\n\n` +
        `Tap the button below to start playing!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
            [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')],
            [Markup.button.callback('💰 Balance', 'balance')]
          ])
        }
      )
    }
  } catch (error) {
    console.error('Error in start command:', error)
    await ctx.reply('❌ An error occurred. Please try again later.')
  }
})

// 2. PLAY - Join a game room
bot.command('play', async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance, bonus_balance')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.reply('❌ User not found. Please use /start to register first.')
      return
    }

    const totalBalance = user.balance + (user.bonus_balance || 0)

    await ctx.reply(
      `🎮 *Ready to Play?*\n\n` +
      `💰 Available Balance: ${totalBalance.toFixed(2)} ETB\n\n` +
      `Choose your game room and start playing!\n\n` +
      `📢 *Join our channel:* https://t.me/BingoXofficial`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
        ])
      }
    )
  } catch (error) {
    console.error('Error in play command:', error)
    await ctx.reply('❌ Error loading game. Please try again.')
  }
})

// 3. ROOMS - View all available rooms
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

    message += `📢 *Join our channel:* https://t.me/BingoXofficial`

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Join Game', `${MINI_APP_URL}/lobby`)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    })
  } catch (error) {
    console.error('Error in rooms command:', error)
    await ctx.reply('Failed to fetch game rooms.')
  }
})

// 4. BALANCE - Check your balance
bot.command('balance', async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance, bonus_balance, games_played, games_won, total_winnings')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.reply('❌ User not found. Please use /start to register first.')
      return
    }

    const totalBalance = user.balance + (user.bonus_balance || 0)

    await ctx.reply(
      `💰 *Your Balance*\n\n` +
      `💵 Main Balance: ${user.balance.toFixed(2)} ETB\n` +
      `🎁 Bonus Balance: ${(user.bonus_balance || 0).toFixed(2)} ETB\n` +
      `📊 Total: ${totalBalance.toFixed(2)} ETB\n\n` +
      `🎮 Games Played: ${user.games_played || 0}\n` +
      `🏆 Games Won: ${user.games_won || 0}\n` +
      `💸 Total Winnings: ${(user.total_winnings || 0).toFixed(2)} ETB\n\n` +
      `📢 *Join our channel:* https://t.me/BingoXofficial`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
        ])
      }
    )
  } catch (error) {
    console.error('Error fetching balance:', error)
    await ctx.reply('❌ Error fetching balance. Please try again.')
  }
})

// 5. ACCOUNT - View your profile
bot.command('account', async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.reply('❌ User not found. Please use /start to register first.')
      return
    }

    const totalBalance = user.balance + (user.bonus_balance || 0)
    const winRate = user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : '0'
    
    // Calculate level from XP
    const level = Math.floor((user.xp || 0) / 100) + 1
    const xpInCurrentLevel = (user.xp || 0) % 100
    const xpForNextLevel = 100 - xpInCurrentLevel

    await ctx.reply(
      `👤 *Your Account Profile*\n\n` +
      `🏷️ **${user.username}**\n` +
      `🎯 Level ${level} ${getLevelBadge(level)}\n` +
      `⚡ XP: ${user.xp || 0} (${xpForNextLevel} to next level)\n\n` +
      `💰 **Balance**\n` +
      `💵 Main: ${user.balance.toFixed(2)} ETB\n` +
      `🎁 Bonus: ${(user.bonus_balance || 0).toFixed(2)} ETB\n` +
      `📊 Total: ${totalBalance.toFixed(2)} ETB\n\n` +
      `🎮 **Game Stats**\n` +
      `🎯 Games Played: ${user.games_played || 0}\n` +
      `🏆 Games Won: ${user.games_won || 0}\n` +
      `📈 Win Rate: ${winRate}%\n` +
      `💸 Total Winnings: ${(user.total_winnings || 0).toFixed(2)} ETB\n` +
      `🔥 Daily Streak: ${user.daily_streak || 0} days\n\n` +
      `📢 *Join our channel:* https://t.me/BingoXofficial`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('📊 Full Profile', `${MINI_APP_URL}/account`)],
          [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
        ])
      }
    )
  } catch (error) {
    console.error('Error in account command:', error)
    await ctx.reply('❌ Error loading account. Please try again.')
  }
})

// 6. LEVELS - View game difficulty levels
bot.command('levels', async (ctx) => {
  await ctx.reply(
    `🎯 *Game Difficulty Levels*\n\n` +
    `**Easy** 🟢\n` +
    `   • Speed: 1 second intervals\n` +
    `   • XP Reward: 10 XP per win\n` +
    `   • Perfect for beginners\n\n` +
    `**Medium** 🟡\n` +
    `   • Speed: 2 second intervals\n` +
    `   • XP Reward: 25 XP per win\n` +
    `   • Balanced risk/reward\n\n` +
    `**Hard** 🔴\n` +
    `   • Speed: 3 second intervals\n` +
    `   • XP Reward: 50 XP per win\n` +
    `   • Higher stakes, bigger wins\n\n` +
    `💡 *Tip: Higher levels give more XP!*\n\n` +
    `📢 *Join our channel:* https://t.me/BingoXofficial`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// 7. MYSTATS - View your XP and statistics
bot.command('mystats', async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.reply('❌ User not found. Please use /start to register first.')
      return
    }

    const level = Math.floor((user.xp || 0) / 100) + 1
    const xpInCurrentLevel = (user.xp || 0) % 100
    const xpForNextLevel = 100 - xpInCurrentLevel
    const winRate = user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : '0'

    await ctx.reply(
      `📊 *Your XP & Statistics*\n\n` +
      `🎯 **Level Progress**\n` +
      `🏷️ Current Level: ${level} ${getLevelBadge(level)}\n` +
      `⚡ Total XP: ${user.xp || 0}\n` +
      `📈 Progress: ${xpInCurrentLevel}/100 XP\n` +
      `🎯 Next Level: ${xpForNextLevel} XP needed\n\n` +
      `🎮 **Game Performance**\n` +
      `🎯 Games Played: ${user.games_played || 0}\n` +
      `🏆 Games Won: ${user.games_won || 0}\n` +
      `💔 Games Lost: ${(user.games_played || 0) - (user.games_won || 0)}\n` +
      `📊 Win Rate: ${winRate}%\n\n` +
      `💰 **Earnings**\n` +
      `💸 Total Winnings: ${(user.total_winnings || 0).toFixed(2)} ETB\n` +
      `🔥 Daily Streak: ${user.daily_streak || 0} days\n` +
      `📅 Member Since: ${new Date(user.created_at).toLocaleDateString()}\n\n` +
      `📢 *Join our channel:* https://t.me/BingoXofficial`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('📈 Detailed Stats', `${MINI_APP_URL}/account`)],
          [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
        ])
      }
    )
  } catch (error) {
    console.error('Error in mystats command:', error)
    await ctx.reply('❌ Error loading statistics. Please try again.')
  }
})

// 8. LEADERBOARD - View leaderboard rankings
bot.command('leaderboard', async (ctx) => {
  await ctx.reply(
    '🏆 *Leaderboard*\n\n' +
    'View top players and rankings:\n\n' +
    '📢 *Join our channel:* https://t.me/BingoXofficial',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🏆 View Leaderboard', `${MINI_APP_URL}/leaderboard`)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// 9. HISTORY - View game & transaction history
bot.command('history', async (ctx) => {
  await ctx.reply(
    `📜 *Your Game & Transaction History*\n\n` +
    `View your complete history including:\n\n` +
    `🎮 **Game History**\n` +
    `• All games played\n` +
    `• Win/loss records\n` +
    `• Prize winnings\n` +
    `• XP earned\n\n` +
    `💰 **Transaction History**\n` +
    `• Deposits & withdrawals\n` +
    `• Bonus earnings\n` +
    `• Game stakes\n` +
    `• Balance changes\n\n` +
    `📢 *Join our channel:* https://t.me/BingoXofficial`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📜 View History', `${MINI_APP_URL}/history`)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// 10. DEPOSIT - Add funds to your account
bot.command('deposit', async (ctx) => {
  await ctx.reply(
    '💸 *Deposit Funds*\n\n' +
    'Add money to your account to play more games!\n\n' +
    '📢 *Join our channel:* https://t.me/BingoXofficial',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('💸 Deposit', `${MINI_APP_URL}/deposit`)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// 11. WITHDRAW - Withdraw your winnings
bot.command('withdraw', async (ctx) => {
  await ctx.reply(
    '💰 *Withdraw Winnings*\n\n' +
    'Cash out your winnings to your account!\n\n' +
    '📢 *Join our channel:* https://t.me/BingoXofficial',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('💰 Withdraw', `${MINI_APP_URL}/withdraw`)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// 12. HELP - Show help & commands
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 *BingoX Commands & Help*\n\n` +
    `🎮 **Game Commands**\n` +
    `/start - Register & get 3 ETB bonus\n` +
    `/play - Join a game room\n` +
    `/rooms - View all available rooms\n` +
    `/levels - View game difficulty levels\n\n` +
    `📊 **Account & Stats**\n` +
    `/balance - Check your balance\n` +
    `/account - View your profile\n` +
    `/mystats - View your XP and statistics\n` +
    `/leaderboard - View leaderboard rankings\n` +
    `/history - View game & transaction history\n\n` +
    `💰 **Financial**\n` +
    `/deposit - Add funds to your account\n` +
    `/withdraw - Withdraw your winnings\n\n` +
    `❓ **Support & Community**\n` +
    `/help - Show help & commands\n` +
    `/channel - Join our official channel\n\n` +
    `🎯 **How to Play:**\n` +
    `1. Register with /start (3 ETB bonus!)\n` +
    `2. Choose your difficulty level\n` +
    `3. Join a game room\n` +
    `4. Mark numbers as they're called\n` +
    `5. Complete a line to win!\n` +
    `6. Earn XP and level up!\n\n` +
    `📢 *Join our channel:* https://t.me/BingoXofficial\n` +
    `*Need Support?* Contact: @bingox_support`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// 13. CHANNEL - Join our official channel
bot.command('channel', async (ctx) => {
  await ctx.reply(
    `📢 *Join Our Official Channel*\n\n` +
    `Stay updated with:\n` +
    `🎯 Game announcements\n` +
    `🏆 Tournament updates\n` +
    `💰 Special bonuses\n` +
    `🎮 New features\n` +
    `📊 Platform statistics\n\n` +
    `Click the button below to join!`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 Join BingoX Official', 'https://t.me/BingoXofficial')],
        [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)]
      ])
    }
  )
})

// ============================================
// CALLBACK HANDLERS
// ============================================

// Handle registration callback
bot.action('register', async (ctx) => {
  const userId = ctx.from?.id
  const username = ctx.from?.username || ctx.from?.first_name || 'Player'
  const firstName = ctx.from?.first_name || 'Player'

  if (!userId) return

  try {
    // Check if already registered
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .maybeSingle()

    if (existingUser) {
      await ctx.answerCbQuery('You are already registered!')
      await ctx.editMessageText(
        `✅ You're already registered!\n\n` +
        `💰 Balance: ${existingUser.balance.toFixed(2)} ETB\n` +
        `🎁 Bonus: ${(existingUser.bonus_balance || 0).toFixed(2)} ETB\n\n` +
        `📢 *Join our channel:* https://t.me/BingoXofficial\n\n` +
        `Tap "Play Now" to start!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
            [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
          ])
        }
      )
      return
    }

    // Get registration bonus from admin config
    const registrationBonus = (await getConfig('welcome_bonus')) || 3.00

    // Create new user with registration bonus
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        telegram_id: userId.toString(),
        username: username,
        balance: 0,
        bonus_balance: registrationBonus,
        games_played: 0,
        games_won: 0,
        total_winnings: 0,
        referral_code: userId.toString(),
        daily_streak: 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    await ctx.answerCbQuery('✅ Registration successful!')
    await ctx.editMessageText(
      `🎉 *Registration Successful!*\n\n` +
      `Welcome to BingoX, ${firstName}! 🎰\n\n` +
      `🎁 You've received ${registrationBonus.toFixed(2)} ETB bonus!\n\n` +
      `✨ *Your Account:*\n` +
      `💰 Balance: 0.00 ETB\n` +
      `🎁 Bonus: ${registrationBonus.toFixed(2)} ETB\n` +
      `📊 Total: ${registrationBonus.toFixed(2)} ETB\n\n` +
      `📢 *Don't forget to join our channel:*\n` +
      `https://t.me/BingoXofficial\n\n` +
      `You can start playing right away!\n` +
      `Tap "Play Now" to choose a room! 🎮`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')],
          [Markup.button.callback('💰 Balance', 'balance')],
          [Markup.button.callback('❓ Help', 'help')]
        ])
      }
    )
  } catch (error: any) {
    console.error('Error in registration:', error)
    await ctx.answerCbQuery(`❌ Registration failed: ${error.message || 'Please try again'}`)
  }
})

// Handle balance callback
bot.action('balance', async (ctx) => {
  const userId = ctx.from.id

  try {
    const { data: user } = await supabase
      .from('users')
      .select('balance, bonus_balance, games_played, games_won')
      .eq('telegram_id', userId.toString())
      .single()

    if (!user) {
      await ctx.answerCbQuery('You need to /start first!')
      return
    }

    await ctx.answerCbQuery()
    await ctx.editMessageText(
      `💰 *Your Account*\n\n` +
      `Balance: *${user.balance.toFixed(2)} ETB*\n` +
      `Bonus: *${(user.bonus_balance || 0).toFixed(2)} ETB*\n` +
      `Total: *${(user.balance + (user.bonus_balance || 0)).toFixed(2)} ETB*\n\n` +
      `Games Played: ${user.games_played || 0}\n` +
      `Games Won: ${user.games_won || 0}\n` +
      `Win Rate: ${user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : 0}%\n\n` +
      `📢 *Join our channel:* https://t.me/BingoXofficial`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('💸 Deposit', `${MINI_APP_URL}/deposit`)],
          [Markup.button.webApp('💰 Withdraw', `${MINI_APP_URL}/withdraw`)],
          [Markup.button.webApp('🎮 Play Game', MINI_APP_URL)],
          [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
        ])
      }
    )
  } catch (error) {
    console.error('Error in balance command:', error)
    await ctx.answerCbQuery('Failed to fetch balance.')
  }
})

// Handle help callback
bot.action('help', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.editMessageText(
    `📖 *BingoX Help*\n\n` +
    `Use these commands:\n` +
    `/start - Register & get 3 ETB bonus\n` +
    `/play - Join a game room\n` +
    `/balance - Check your balance\n` +
    `/help - Show this help\n\n` +
    `📢 *Join our channel:* https://t.me/BingoXofficial`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
        [Markup.button.url('📢 Join Channel', 'https://t.me/BingoXofficial')]
      ])
    }
  )
})

// ============================================
// INLINE MODE HANDLERS (for @Bot queries)
// ============================================

bot.on('inline_query', async (ctx) => {
  try {
    const q = (ctx.inlineQuery?.query || '').trim().toLowerCase()

    const joinKeyboard = {
      inline_keyboard: [
        [
          { text: '📢 Join Channel', url: 'https://t.me/BingoXofficial' },
          { text: '🎮 Play Now', web_app: { url: MINI_APP_URL } as any }
        ]
      ]
    }

    const results: any[] = []

    if (!q || q === 'rooms') {
      results.push({
        type: 'article',
        id: 'rooms',
        title: 'Rooms',
        description: 'View available game rooms',
        input_message_content: {
          message_text: '🎮 Open the mini app to view all rooms.',
          parse_mode: 'Markdown'
        },
        reply_markup: joinKeyboard
      })
    }

    if (!q || q === 'levels') {
      results.push({
        type: 'article',
        id: 'levels',
        title: 'Levels',
        description: 'Game difficulty levels',
        input_message_content: {
          message_text: '🎯 Levels: Easy, Medium, Hard. Higher levels grant more XP!',
          parse_mode: 'Markdown'
        },
        reply_markup: joinKeyboard
      })
    }

    if (!q || q === 'channel') {
      results.push({
        type: 'article',
        id: 'channel',
        title: 'Join Channel',
        description: 'Official announcements and bonuses',
        input_message_content: {
          message_text: '📢 Join our official channel: https://t.me/BingoXofficial',
          parse_mode: 'Markdown'
        },
        reply_markup: joinKeyboard
      })
    }

    if (!q || q === 'mystats') {
      results.push({
        type: 'article',
        id: 'mystats',
        title: 'My Stats',
        description: 'Open profile and stats',
        input_message_content: {
          message_text: '📊 Open the mini app to view your stats and profile.',
          parse_mode: 'Markdown'
        },
        reply_markup: joinKeyboard
      })
    }

    // Fallback/help card
    if (results.length === 0) {
      results.push({
        type: 'article',
        id: 'help',
        title: 'Help',
        description: 'Try: rooms, levels, channel, mystats',
        input_message_content: {
          message_text: 'Type: rooms, levels, channel, mystats',
          parse_mode: 'Markdown'
        },
        reply_markup: joinKeyboard
      })
    }

    await ctx.answerInlineQuery(results, { cache_time: 1 })
  } catch (e) {
    console.error('inline_query error:', e)
  }
})

// ============================================
// ERROR HANDLING
// ============================================

// Handle bot errors
bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err)
  console.error('Context:', ctx.update)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
})

// ============================================
// START BOT
// ============================================

bot.launch()
console.log('🤖 BingoX Bot is running...')
console.log('📢 Channel: https://t.me/BingoXofficial')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

export default bot
