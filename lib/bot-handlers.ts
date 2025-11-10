import { Telegraf, Markup, Context } from 'telegraf'
import { supabaseAdmin } from './supabase'

const MINI_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.MINI_APP_URL || 'https://yegnagame.vercel.app'

// Use admin client for all operations
const supabase = supabaseAdmin

export function setupBotHandlers(bot: Telegraf) {
  // Start command - Register user
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
          `🎰 *Welcome to Bingo Royale!*\n\n` +
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
          `Click "Register Now" to begin!`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✅ Register Now', 'register')],
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
          `Tap the button below to start playing!`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
              [Markup.button.callback('💰 Balance', 'balance')],
              [Markup.button.callback('🏆 Leaderboard', 'leaderboard')]
            ])
          }
        )
      }
    } catch (error) {
      console.error('Error in start command:', error)
      await ctx.reply('❌ An error occurred. Please try again later.')
    }
  })

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
          `Tap "Play Now" to start!`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
              [Markup.button.callback('💰 Balance', 'balance')],
              [Markup.button.callback('❓ Help', 'help')]
            ])
          }
        )
        return
      }

      // Get registration bonus from admin settings
      const { data: bonusSetting } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'welcome_bonus')
        .maybeSingle()

      const registrationBonus = parseFloat(bonusSetting?.setting_value || '3.00')

      // Create new user with registration bonus
      const { error: insertError } = await supabase
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

      if (insertError) {
        console.error('Insert error:', insertError)
        
        // Check if it's a duplicate key error
        if (insertError.code === '23505') {
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', userId.toString())
            .single()

          await ctx.answerCbQuery('You are already registered!')
          await ctx.editMessageText(
            `✅ You're already registered!\n\n` +
            `💰 Balance: ${user.balance.toFixed(2)} ETB\n` +
            `🎁 Bonus: ${(user.bonus_balance || 0).toFixed(2)} ETB\n\n` +
            `Tap "Play Now" to start!`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
                [Markup.button.callback('💰 Balance', 'balance')],
                [Markup.button.callback('❓ Help', 'help')]
              ])
            }
          )
          return
        }
        
        throw insertError
      }

      await ctx.answerCbQuery('✅ Registration successful!')
      await ctx.editMessageText(
        `🎉 *Registration Successful!*\n\n` +
        `Welcome to Bingo Royale, ${firstName}! 🎰\n\n` +
        `🎁 You've received ${registrationBonus.toFixed(2)} ETB bonus!\n\n` +
        `✨ *Your Account:*\n` +
        `💰 Balance: 0.00 ETB\n` +
        `🎁 Bonus: ${registrationBonus.toFixed(2)} ETB\n` +
        `📊 Total: ${registrationBonus.toFixed(2)} ETB\n\n` +
        `You can start playing right away!\n` +
        `Tap "Play Now" to choose a room! 🎮`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
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

  // Balance callback
  bot.action('balance', async (ctx) => {
    const userId = ctx.from.id

    try {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userId.toString())
        .single()

      if (!user) {
        await ctx.answerCbQuery('You need to /start first!')
        return
      }

      const totalBalance = user.balance + (user.bonus_balance || 0)

      await ctx.answerCbQuery()
      await ctx.editMessageText(
        `💰 *Your Balance*\n\n` +
        `💵 Main Balance: ${user.balance.toFixed(2)} ETB\n` +
        `🎁 Bonus Balance: ${(user.bonus_balance || 0).toFixed(2)} ETB\n` +
        `📊 Total: ${totalBalance.toFixed(2)} ETB\n\n` +
        `🎮 Games Played: ${user.games_played}\n` +
        `🏆 Games Won: ${user.games_won}\n` +
        `💸 Total Winnings: ${user.total_winnings.toFixed(2)} ETB`,
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
      await ctx.answerCbQuery('Failed to fetch balance.')
    }
  })

  // Balance command
  bot.command('balance', async (ctx) => {
    const userId = ctx.from.id

    try {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userId.toString())
        .single()

      if (!user) {
        await ctx.reply('Please use /start to register first!')
        return
      }

      const totalBalance = user.balance + (user.bonus_balance || 0)

      await ctx.reply(
        `💰 *Your Balance*\n\n` +
        `💵 Main Balance: ${user.balance.toFixed(2)} ETB\n` +
        `🎁 Bonus Balance: ${(user.bonus_balance || 0).toFixed(2)} ETB\n` +
        `📊 Total: ${totalBalance.toFixed(2)} ETB\n\n` +
        `🎮 Games Played: ${user.games_played}\n` +
        `🏆 Games Won: ${user.games_won}\n` +
        `💸 Total Winnings: ${user.total_winnings.toFixed(2)} ETB`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('💸 Deposit', `${MINI_APP_URL}/deposit`)],
            [Markup.button.webApp('💵 Withdraw', `${MINI_APP_URL}/withdraw`)],
            [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)]
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
    await ctx.reply(
      `🎮 *Ready to Play?*\n\nTap the button below to start playing!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)]
        ])
      }
    )
  })

  // Leaderboard command
  bot.command('leaderboard', async (ctx) => {
    try {
      const { data: leaderboard } = await supabase
        .from('users')
        .select('username, total_winnings, games_won, games_played')
        .order('total_winnings', { ascending: false })
        .limit(10)

      if (!leaderboard || leaderboard.length === 0) {
        await ctx.reply('No leaderboard data yet. Be the first to play!')
        return
      }

      let message = '🏆 *Top 10 Players*\n\n'
      leaderboard.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        message += `${medal} ${player.username}\n`
        message += `   💰 ${player.total_winnings} ETB | 🎯 ${player.games_won} wins\n\n`
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

  // Leaderboard callback
  bot.action('leaderboard', async (ctx) => {
    try {
      const { data: leaderboard } = await supabase
        .from('users')
        .select('username, total_winnings, games_won')
        .order('total_winnings', { ascending: false })
        .limit(10)

      if (!leaderboard || leaderboard.length === 0) {
        await ctx.answerCbQuery('No leaderboard data yet')
        return
      }

      let message = '🏆 *Top 10 Players*\n\n'
      leaderboard.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        message += `${medal} ${player.username} - ${player.total_winnings} ETB\n`
      })

      await ctx.answerCbQuery()
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('📊 Full Leaderboard', `${MINI_APP_URL}/leaderboard`)],
          [Markup.button.callback('🔙 Back', 'back_to_start')]
        ])
      })
    } catch (error) {
      console.error('Error in leaderboard:', error)
      await ctx.answerCbQuery('Failed to load leaderboard')
    }
  })

  // Help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *Bingo Royale - Help & Commands*\n\n` +
      `*Game Commands:*\n` +
      `/start - Register and start playing\n` +
      `/play - Open the game\n` +
      `/balance - Check your balance\n` +
      `/deposit - Add funds to your account\n` +
      `/withdraw - Withdraw your winnings\n` +
      `/leaderboard - View top players\n` +
      `/help - Show this help message\n\n` +
      `*How to Play:*\n` +
      `1️⃣ Register with /start\n` +
      `2️⃣ Deposit funds or use your bonus\n` +
      `3️⃣ Join a game room\n` +
      `4️⃣ Mark numbers as they're called\n` +
      `5️⃣ Get BINGO and win prizes!\n\n` +
      `Need more help? Contact support!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)]
        ])
      }
    )
  })

  // Help callback
  bot.action('help', async (ctx) => {
    await ctx.answerCbQuery()
    await ctx.editMessageText(
      `📖 *Bingo Royale - Help*\n\n` +
      `*How to Play:*\n` +
      `1️⃣ Register with /start\n` +
      `2️⃣ Deposit funds or use your bonus\n` +
      `3️⃣ Join a game room\n` +
      `4️⃣ Mark numbers as they're called\n` +
      `5️⃣ Get BINGO and win prizes!\n\n` +
      `*Commands:*\n` +
      `/balance - Check balance\n` +
      `/play - Start playing\n` +
      `/leaderboard - Top players\n\n` +
      `Good luck! 🍀`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.callback('🔙 Back', 'back_to_start')]
        ])
      }
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
          [Markup.button.webApp('💸 Deposit Now', `${MINI_APP_URL}/deposit`)]
        ])
      }
    )
  })

  // Withdraw command
  bot.command('withdraw', async (ctx) => {
    await ctx.reply(
      '💰 *Withdraw Winnings*\n\n' +
      'Click the button below to withdraw your winnings:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('💰 Withdraw Now', `${MINI_APP_URL}/withdraw`)]
        ])
      }
    )
  })

  // Account command
  bot.command('account', async (ctx) => {
    await ctx.reply(
      '👤 *Your Account*\n\n' +
      'View your complete profile and statistics:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('👤 View Account', `${MINI_APP_URL}/account`)]
        ])
      }
    )
  })

  // History command
  bot.command('history', async (ctx) => {
    await ctx.reply(
      '📜 *Game History*\n\n' +
      'View your complete game and transaction history:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('📜 View History', `${MINI_APP_URL}/history`)]
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
        await ctx.reply('Please use /start to register first!')
        return
      }

      const winRate = user.games_played > 0 
        ? ((user.games_won / user.games_played) * 100).toFixed(1)
        : '0.0'

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

  // Rooms command
  bot.command('rooms', async (ctx) => {
    try {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'active')
        .order('stake', { ascending: true })

      if (!rooms || rooms.length === 0) {
        await ctx.reply('No game rooms available.')
        return
      }

      let message = '🎮 *Available Game Rooms:*\n\n'
      rooms.forEach(room => {
        const emoji = room.stake <= 10 ? '🎯' : room.stake <= 50 ? '⚡' : '💎'
        message += `${emoji} *${room.name}*\n`
        message += `   Stake: ${room.stake} ETB\n`
        message += `   Max Players: ${room.max_players}\n\n`
      })

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Join a Room', `${MINI_APP_URL}/lobby`)]
        ])
      })
    } catch (error) {
      console.error('Error in rooms command:', error)
      await ctx.reply('Failed to fetch game rooms.')
    }
  })

  // Error handling
  bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err)
  })

  return bot
}
