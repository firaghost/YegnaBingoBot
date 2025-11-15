import { Telegraf, Markup, Context } from 'telegraf'
import { supabaseAdmin } from './supabase'

const MINI_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.MINI_APP_URL || 'https://yegnagame.vercel.app'
const supabase = supabaseAdmin

export function setupLevelHandlers(bot: Telegraf) {
  
  // ============================================
  // LEVELS COMMAND - Show available difficulty levels
  // ============================================
  bot.command('levels', async (ctx) => {
    try {
      const { data: levels } = await supabase
        .from('levels')
        .select('*')
        .order('xp_reward', { ascending: true })

      if (!levels || levels.length === 0) {
        await ctx.reply('❌ No game levels available.')
        return
      }

      let message = '🎯 **Available Game Levels:**\n\n'
      
      levels.forEach((level: any) => {
        const emoji = level.name === 'easy' ? '🟢' : level.name === 'medium' ? '🟡' : '🔴'
        const interval = (level.call_interval / 1000).toFixed(1)
        
        message += `${emoji} **${level.name.toUpperCase()}**\n`
        message += `   📏 Win Threshold: ${level.win_threshold} matches\n`
        message += `   ⏱️ Call Interval: ${interval}s\n`
        message += `   🏆 XP Reward: ${level.xp_reward} XP\n`
        message += `   📝 ${level.description}\n\n`
      })

      message += '💡 *Choose your difficulty when starting a game!*'

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.callback('📊 Leaderboard', 'leaderboard')]
        ])
      })
    } catch (error) {
      console.error('Error in levels command:', error)
      await ctx.reply('❌ Failed to fetch game levels.')
    }
  })

  // ============================================
  // ENHANCED LEADERBOARD COMMAND - Weekly/Monthly
  // ============================================
  bot.command('leaderboard', async (ctx) => {
    try {
      // Get weekly leaderboard
      const { data: weeklyBoard } = await supabase
        .from('current_leaderboard')
        .select('*')
        .eq('period', 'weekly')
        .order('xp', { ascending: false })
        .limit(10)

      if (!weeklyBoard || weeklyBoard.length === 0) {
        await ctx.reply(
          '🏆 **Weekly Leaderboard**\n\n' +
          '🎮 No games played this week yet!\n' +
          'Be the first to climb the ranks!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🎯 Play Now', MINI_APP_URL)],
              [Markup.button.callback('📊 Monthly Board', 'monthly_leaderboard')]
            ])
          }
        )
        return
      }

      let message = '🏆 **Weekly Leaderboard**\n\n'
      
      weeklyBoard.forEach((player: any, index: any) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        const rankEmoji = getRankEmoji(player.level_progress)
        
        message += `${medal} ${rankEmoji} **${player.username}**\n`
        message += `   🏆 ${player.wins} wins | ⚡ ${player.xp} XP\n`
        message += `   📈 ${player.level_progress} (${player.lifetime_xp} total XP)\n\n`
      })

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📅 Monthly Board', 'monthly_leaderboard')],
          [Markup.button.webApp('📊 Full Leaderboard', `${MINI_APP_URL}/leaderboard`)],
          [Markup.button.callback('🎯 My Stats', 'my_stats')]
        ])
      })
    } catch (error) {
      console.error('Error in leaderboard command:', error)
      await ctx.reply('❌ Failed to fetch leaderboard.')
    }
  })

  // ============================================
  // MY STATS COMMAND - Player's personal stats
  // ============================================
  bot.command('mystats', async (ctx) => {
    const userId = ctx.from.id

    try {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userId.toString())
        .single()

      if (!user) {
        await ctx.reply('❌ You need to /start first!')
        return
      }

      // Get weekly and monthly leaderboard positions
      const { data: weeklyPos } = await supabase
        .from('current_leaderboard')
        .select('rank')
        .eq('period', 'weekly')
        .eq('telegram_id', userId.toString())
        .maybeSingle()

      const { data: monthlyPos } = await supabase
        .from('current_leaderboard')
        .select('rank')
        .eq('period', 'monthly')
        .eq('telegram_id', userId.toString())
        .maybeSingle()

      const rankEmoji = getRankEmoji(user.level_progress)
      const winRate = user.games_played > 0 
        ? ((user.games_won / user.games_played) * 100).toFixed(1)
        : '0.0'

      const message = 
        `📊 **Your Statistics**\n\n` +
        `${rankEmoji} **Rank:** ${user.level_progress}\n` +
        `⚡ **Total XP:** ${user.xp}\n` +
        `🏆 **Total Wins:** ${user.total_wins}\n` +
        `🎮 **Games Played:** ${user.games_played}\n` +
        `📈 **Win Rate:** ${winRate}%\n` +
        `💰 **Total Winnings:** ${user.total_winnings} ETB\n\n` +
        `**Leaderboard Positions:**\n` +
        `📅 Weekly: ${weeklyPos?.rank ? `#${weeklyPos.rank}` : 'Unranked'}\n` +
        `📆 Monthly: ${monthlyPos?.rank ? `#${monthlyPos.rank}` : 'Unranked'}\n\n` +
        `**Next Rank:** ${getNextRank(user.xp)} XP`

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Game', MINI_APP_URL)],
          [Markup.button.callback('🏆 Leaderboard', 'leaderboard')],
          [Markup.button.callback('🎯 Levels', 'levels_info')]
        ])
      })
    } catch (error) {
      console.error('Error in mystats command:', error)
      await ctx.reply('❌ Failed to fetch your statistics.')
    }
  })

  // ============================================
  // ADMIN COMMANDS
  // ============================================
  
  // Set XP reward for a level
  bot.command('setxp', async (ctx) => {
    const userId = ctx.from.id
    const args = ctx.message.text.split(' ')

    // Check if user is admin (you can implement proper admin check)
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .maybeSingle()

    if (!admin) {
      await ctx.reply('❌ Admin access required.')
      return
    }

    if (args.length !== 3) {
      await ctx.reply(
        '❌ **Usage:** `/setxp <level> <xp_amount>`\n\n' +
        '**Examples:**\n' +
        '• `/setxp easy 15`\n' +
        '• `/setxp medium 30`\n' +
        '• `/setxp hard 60`',
        { parse_mode: 'Markdown' }
      )
      return
    }

    const [, levelName, newXP] = args
    const xpAmount = parseInt(newXP)

    if (!['easy', 'medium', 'hard'].includes(levelName)) {
      await ctx.reply('❌ Invalid level. Use: easy, medium, or hard')
      return
    }

    if (isNaN(xpAmount) || xpAmount < 1 || xpAmount > 1000) {
      await ctx.reply('❌ XP amount must be between 1 and 1000')
      return
    }

    try {
      const { error } = await supabase
        .from('levels')
        .update({ xp_reward: xpAmount })
        .eq('name', levelName)

      if (error) throw error

      await ctx.reply(
        `✅ **XP Updated Successfully!**\n\n` +
        `🎯 **Level:** ${levelName.toUpperCase()}\n` +
        `⚡ **New XP Reward:** ${xpAmount} XP`,
        { parse_mode: 'Markdown' }
      )
    } catch (error) {
      console.error('Error updating XP:', error)
      await ctx.reply('❌ Failed to update XP reward.')
    }
  })

  // Reset leaderboard (admin only)
  bot.command('resetleaderboard', async (ctx) => {
    const userId = ctx.from.id
    const args = ctx.message.text.split(' ')

    // Check admin access
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('telegram_id', userId.toString())
      .maybeSingle()

    if (!admin) {
      await ctx.reply('❌ Admin access required.')
      return
    }

    const period = args[1] || 'weekly'
    
    if (!['weekly', 'monthly'].includes(period)) {
      await ctx.reply('❌ Invalid period. Use: weekly or monthly')
      return
    }

    try {
      // Call the reset function
      const { error } = await supabase.rpc('reset_leaderboard', {
        p_period: period
      })

      if (error) throw error

      await ctx.reply(
        `✅ **Leaderboard Reset Complete!**\n\n` +
        `📊 **Period:** ${period.toUpperCase()}\n` +
        `📈 Previous rankings archived to history\n` +
        `🔄 New ${period} season has begun!`,
        { parse_mode: 'Markdown' }
      )
    } catch (error) {
      console.error('Error resetting leaderboard:', error)
      await ctx.reply('❌ Failed to reset leaderboard.')
    }
  })

  // ============================================
  // CALLBACK HANDLERS
  // ============================================
  
  bot.action('monthly_leaderboard', async (ctx) => {
    try {
      await ctx.answerCbQuery()
      
      const { data: monthlyBoard } = await supabase
        .from('current_leaderboard')
        .select('*')
        .eq('period', 'monthly')
        .order('xp', { ascending: false })
        .limit(10)

      if (!monthlyBoard || monthlyBoard.length === 0) {
        await ctx.editMessageText(
          '🏆 **Monthly Leaderboard**\n\n' +
          '🎮 No games played this month yet!\n' +
          'Start playing to claim the top spot!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🎯 Play Now', MINI_APP_URL)],
              [Markup.button.callback('📅 Weekly Board', 'weekly_leaderboard')]
            ])
          }
        )
        return
      }

      let message = '🏆 **Monthly Leaderboard**\n\n'
      
      monthlyBoard.forEach((player: any, index: any) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        const rankEmoji = getRankEmoji(player.level_progress)
        
        message += `${medal} ${rankEmoji} **${player.username}**\n`
        message += `   🏆 ${player.wins} wins | ⚡ ${player.xp} XP\n`
        message += `   📈 ${player.level_progress} (${player.lifetime_xp} total XP)\n\n`
      })

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📅 Weekly Board', 'weekly_leaderboard')],
          [Markup.button.webApp('📊 Full Leaderboard', `${MINI_APP_URL}/leaderboard`)],
          [Markup.button.callback('🎯 My Stats', 'my_stats')]
        ])
      })
    } catch (error) {
      console.error('Error in monthly leaderboard:', error)
      await ctx.answerCbQuery('❌ Failed to load monthly leaderboard')
    }
  })

  bot.action('weekly_leaderboard', async (ctx) => {
    // Redirect to main leaderboard command logic
    try {
      await ctx.answerCbQuery()
      
      const { data: weeklyBoard } = await supabase
        .from('current_leaderboard')
        .select('*')
        .eq('period', 'weekly')
        .order('xp', { ascending: false })
        .limit(10)

      if (!weeklyBoard || weeklyBoard.length === 0) {
        await ctx.editMessageText(
          '🏆 **Weekly Leaderboard**\n\n' +
          '🎮 No games played this week yet!\n' +
          'Be the first to climb the ranks!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.webApp('🎯 Play Now', MINI_APP_URL)],
              [Markup.button.callback('📊 Monthly Board', 'monthly_leaderboard')]
            ])
          }
        )
        return
      }

      let message = '🏆 **Weekly Leaderboard**\n\n'
      
      weeklyBoard.forEach((player: any, index: any) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        const rankEmoji = getRankEmoji(player.level_progress)
        
        message += `${medal} ${rankEmoji} **${player.username}**\n`
        message += `   🏆 ${player.wins} wins | ⚡ ${player.xp} XP\n`
        message += `   📈 ${player.level_progress} (${player.lifetime_xp} total XP)\n\n`
      })

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📅 Monthly Board', 'monthly_leaderboard')],
          [Markup.button.webApp('📊 Full Leaderboard', `${MINI_APP_URL}/leaderboard`)],
          [Markup.button.callback('🎯 My Stats', 'my_stats')]
        ])
      })
    } catch (error) {
      console.error('Error in weekly leaderboard:', error)
      await ctx.answerCbQuery('❌ Failed to load weekly leaderboard')
    }
  })

  bot.action('my_stats', async (ctx) => {
    const userId = ctx.from.id

    try {
      await ctx.answerCbQuery()
      
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userId.toString())
        .single()

      if (!user) {
        await ctx.editMessageText('❌ You need to /start first!')
        return
      }

      const rankEmoji = getRankEmoji(user.level_progress)
      const winRate = user.games_played > 0 
        ? ((user.games_won / user.games_played) * 100).toFixed(1)
        : '0.0'

      const message = 
        `📊 **Your Statistics**\n\n` +
        `${rankEmoji} **Rank:** ${user.level_progress}\n` +
        `⚡ **Total XP:** ${user.xp}\n` +
        `🏆 **Total Wins:** ${user.total_wins}\n` +
        `🎮 **Games Played:** ${user.games_played}\n` +
        `📈 **Win Rate:** ${winRate}%\n` +
        `💰 **Total Winnings:** ${user.total_winnings} ETB\n\n` +
        `**Next Rank:** ${getNextRank(user.xp)} XP`

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Game', MINI_APP_URL)],
          [Markup.button.callback('🏆 Leaderboard', 'weekly_leaderboard')],
          [Markup.button.callback('🎯 Levels', 'levels_info')]
        ])
      })
    } catch (error) {
      console.error('Error in my stats:', error)
      await ctx.answerCbQuery('❌ Failed to load your stats')
    }
  })

  bot.action('levels_info', async (ctx) => {
    try {
      await ctx.answerCbQuery()
      
      const { data: levels } = await supabase
        .from('levels')
        .select('*')
        .order('xp_reward', { ascending: true })

      if (!levels || levels.length === 0) {
        await ctx.editMessageText('❌ No game levels available.')
        return
      }

      let message = '🎯 **Available Game Levels:**\n\n'
      
      levels.forEach((level: any) => {
        const emoji = level.name === 'easy' ? '🟢' : level.name === 'medium' ? '🟡' : '🔴'
        const interval = (level.call_interval / 1000).toFixed(1)
        
        message += `${emoji} **${level.name.toUpperCase()}**\n`
        message += `   📏 Win Threshold: ${level.win_threshold} matches\n`
        message += `   ⏱️ Call Interval: ${interval}s\n`
        message += `   🏆 XP Reward: ${level.xp_reward} XP\n`
        message += `   📝 ${level.description}\n\n`
      })

      message += '💡 *Choose your difficulty when starting a game!*'

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 Play Now', MINI_APP_URL)],
          [Markup.button.callback('📊 Leaderboard', 'weekly_leaderboard')],
          [Markup.button.callback('🎯 My Stats', 'my_stats')]
        ])
      })
    } catch (error) {
      console.error('Error in levels info:', error)
      await ctx.answerCbQuery('❌ Failed to load levels info')
    }
  })
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRankEmoji(rank: string): string {
  switch (rank) {
    case 'Legend': return '👑'
    case 'Master': return '🔥'
    case 'Expert': return '⭐'
    case 'Skilled': return '💪'
    case 'Beginner': return '🌱'
    default: return '🎮'
  }
}

function getNextRank(currentXP: number): string {
  if (currentXP < 100) return `${100 - currentXP} XP to Skilled`
  if (currentXP < 300) return `${300 - currentXP} XP to Expert`
  if (currentXP < 600) return `${600 - currentXP} XP to Master`
  if (currentXP < 1000) return `${1000 - currentXP} XP to Legend`
  return 'Maximum rank achieved! 👑'
}

// ============================================
// GAME COMPLETION HANDLER
// ============================================
export async function handleGameCompletion(
  userId: string, 
  result: 'win' | 'lose', 
  levelName: string = 'medium'
) {
  try {
    if (result === 'win') {
      // Get level settings
      const { data: level } = await supabase
        .from('levels')
        .select('*')
        .eq('name', levelName)
        .single()

      if (!level) {
        console.error('Level not found:', levelName)
        return
      }

      // Get user data
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userId)
        .single()

      if (!user) {
        console.error('User not found:', userId)
        return
      }

      // Update player stats with XP
      const { error } = await supabase.rpc('update_player_stats', {
        p_user_id: user.id,
        p_xp: level.xp_reward
      })

      if (error) {
        console.error('Error updating player stats:', error)
        return
      }

      // Recalculate leaderboard ranks
      await supabase.rpc('calculate_leaderboard_ranks', { p_period: 'weekly' })
      await supabase.rpc('calculate_leaderboard_ranks', { p_period: 'monthly' })

      console.log(`Player ${userId} won on ${levelName} level, gained ${level.xp_reward} XP`)
    }
  } catch (error) {
    console.error('Error handling game completion:', error)
  }
}
