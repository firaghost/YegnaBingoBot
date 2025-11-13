import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

interface BotPlayer {
  id: string
  name: string
  username: string
  win_rate: number
  response_time_min: number
  response_time_max: number
  aggression_level: number
  personality: string
  chat_enabled: boolean
  chat_frequency: number
  skill_level: string
  auto_join_enabled: boolean
  max_concurrent_games: number
}

interface GameRoom {
  id: string
  name: string
  stake: number
  max_players: number
  default_level: string
  waiting_players: number
}

export class BotManager {
  private static instance: BotManager
  private checkInterval: NodeJS.Timeout | null = null
  private isRunning = false

  static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager()
    }
    return BotManager.instance
  }

  // Start monitoring for dynamic bot system
  startMonitoring() {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('🤖 Bot Manager: Starting dynamic bot system...')
    console.log('🔄 Features: Random rotation, prize pool updates, real-player-only game starts')
    
    // Check every 2 minutes for bot rotation and maintenance
    this.checkInterval = setInterval(async () => {
      await this.maintainBotPresence()
    }, 120000) // 2 minutes
    
    // Initial setup
    this.maintainBotPresence()
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isRunning = false
    console.log('🤖 Bot Manager: Stopped monitoring')
  }

  // Maintain permanent bot presence in rooms
  private async maintainBotPresence() {
    try {
      console.log('🤖 Maintaining bot presence in rooms...')
      
      // Call the database function to maintain bot presence
      const { error } = await supabase.rpc('maintain_bot_presence')
      
      if (error) {
        console.error('Error maintaining bot presence:', error)
      } else {
        console.log('🤖 Bot presence maintained successfully')
      }
    } catch (error) {
      console.error('Error in maintainBotPresence:', error)
    }
  }

  // Check for players waiting and send bots to join them
  private async checkForLonelyPlayers() {
    try {
      // First try to get rooms with waiting_players column
      let waitingRooms: any[] = []
      
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .gte('waiting_players', 1)
          .lt('waiting_players', 4) // Don't join rooms that are almost full

        if (error) throw error
        waitingRooms = data || []
      } catch (columnError: any) {
        // If waiting_players column doesn't exist, fall back to manual counting
        if (columnError.code === '42703') {
          console.log('🤖 waiting_players column not found, using manual count...')
          
          // Get all rooms and manually count waiting games
          const { data: allRooms, error: roomsError } = await supabase
            .from('rooms')
            .select('*')

          if (roomsError) throw roomsError

          // For each room, count waiting games
          for (const room of allRooms || []) {
            const { data: waitingGames, error: gamesError } = await supabase
              .from('games')
              .select('id')
              .eq('room_id', room.id)
              .eq('status', 'waiting')

            if (!gamesError && waitingGames && waitingGames.length > 0 && waitingGames.length < 4) {
              waitingRooms.push({
                ...room,
                waiting_players: waitingGames.length
              })
            }
          }
        } else {
          throw columnError
        }
      }

      if (waitingRooms.length === 0) {
        return // No waiting players
      }

      console.log(`🤖 Found ${waitingRooms.length} rooms with waiting players, sending bots...`)

      // For each waiting room, try to add 1-2 bots randomly
      for (const room of waitingRooms) {
        const botsToAdd = Math.floor(Math.random() * 2) + 1 // 1-2 bots
        console.log(`🤖 Adding ${botsToAdd} bots to room ${room.name} (${room.waiting_players || 'unknown'} waiting)`)
        
        for (let i = 0; i < botsToAdd; i++) {
          await this.addBotToRoom(room)
          // Small delay between bot additions
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    } catch (error) {
      console.error('Error in checkForLonelyPlayers:', error)
    }
  }

  // Add a suitable bot to a specific room
  private async addBotToRoom(room: GameRoom) {
    try {
      // Get available bots for this room
      const { data: availableBots, error: botsError } = await supabase
        .rpc('get_available_bots_for_room', {
          room_id_param: room.id,
          skill_level_param: room.default_level,
          limit_param: 5
        })

      if (botsError || !availableBots || availableBots.length === 0) {
        console.log(`🤖 No available bots for room ${room.name}`)
        return
      }

      // Pick a random bot from available ones
      const selectedBot = availableBots[Math.floor(Math.random() * availableBots.length)]
      
      // Check if this bot is already in a game for this room
      const { data: existingSession, error: sessionError } = await supabase
        .from('bot_game_sessions')
        .select('id')
        .eq('bot_id', selectedBot.id)
        .eq('status', 'active')
        .limit(1)

      if (existingSession && existingSession.length > 0) {
        console.log(`🤖 Bot ${selectedBot.name} is already in an active game`)
        return
      }
      
      // Create a user account for the bot if it doesn't exist
      const botUser = await this.getOrCreateBotUser(selectedBot)
      
      if (!botUser) {
        console.error(`Failed to create user for bot ${selectedBot.name}`)
        return
      }

      // Join the bot to the room
      const success = await this.joinBotToRoom(selectedBot, botUser, room)
      
      if (success) {
        console.log(`🤖 Bot ${selectedBot.name} joined room ${room.name}`)
        
        // Start bot behavior for this game
        this.startBotBehavior(selectedBot, room)
      }
    } catch (error) {
      console.error(`Error adding bot to room ${room.name}:`, error)
    }
  }

  // Get or create a user account for the bot
  private async getOrCreateBotUser(bot: BotPlayer) {
    try {
      // Check if bot user already exists by bot_id first
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('bot_id', bot.id)
        .single()

      if (existingUser) {
        return existingUser
      }

      // Try to create new user for the bot with unique telegram_id
      const uniqueTelegramId = `bot_${bot.id}_${Date.now()}`
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          username: bot.username,
          telegram_id: uniqueTelegramId,
          balance: 1000000, // Give bots a large balance
          is_bot: true,
          bot_id: bot.id
        })
        .select()
        .single()

      if (createError) {
        // If still duplicate, try to find existing user by username
        if (createError.code === '23505') {
          const { data: fallbackUser } = await supabase
            .from('users')
            .select('*')
            .eq('username', bot.username)
            .eq('is_bot', true)
            .single()
          
          if (fallbackUser) {
            return fallbackUser
          }
        }
        
        console.error('Error creating bot user:', createError)
        return null
      }

      return newUser
    } catch (error) {
      console.error('Error in getOrCreateBotUser:', error)
      return null
    }
  }

  // Join bot to a specific room
  private async joinBotToRoom(bot: BotPlayer, botUser: any, room: GameRoom): Promise<boolean> {
    try {
      // Create a game session for the bot
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          room_id: room.id,
          user_id: botUser.id,
          stake: room.stake,
          status: 'waiting',
          game_level: room.default_level
        })
        .select()
        .single()

      if (gameError) {
        console.error('Error creating bot game:', gameError)
        return false
      }

      // Record bot session
      const { error: sessionError } = await supabase
        .from('bot_game_sessions')
        .insert({
          bot_id: bot.id,
          game_id: game.id,
          user_id: botUser.id,
          status: 'active'
        })

      if (sessionError) {
        console.error('Error creating bot session:', sessionError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in joinBotToRoom:', error)
      return false
    }
  }

  // Start bot behavior simulation
  private async startBotBehavior(bot: BotPlayer, room: GameRoom) {
    // Wait for the game to start (when there are enough players)
    const gameCheckInterval = setInterval(async () => {
      try {
        const { data: roomData } = await supabase
          .from('rooms')
          .select('waiting_players')
          .eq('id', room.id)
          .single()

        if (roomData && roomData.waiting_players >= room.max_players) {
          clearInterval(gameCheckInterval)
          
          // Game is starting, begin bot gameplay simulation
          setTimeout(() => {
            this.simulateBotGameplay(bot, room)
          }, this.getRandomResponseTime(bot))
        }
      } catch (error) {
        console.error('Error checking game status:', error)
        clearInterval(gameCheckInterval)
      }
    }, 2000)

    // Clear interval after 5 minutes if game doesn't start
    setTimeout(() => {
      clearInterval(gameCheckInterval)
    }, 300000)
  }

  // Simulate bot gameplay (card marking, chat, etc.)
  private async simulateBotGameplay(bot: BotPlayer, room: GameRoom) {
    console.log(`🤖 ${bot.name} starting gameplay simulation`)
    
    // Simulate periodic card marking based on bot's aggression level
    const markingInterval = setInterval(() => {
      // Random chance to mark a card based on aggression level
      const shouldMark = Math.random() * 100 < bot.aggression_level
      
      if (shouldMark) {
        this.simulateCardMark(bot)
      }
      
      // Random chance to chat based on chat settings
      if (bot.chat_enabled && Math.random() * 100 < bot.chat_frequency) {
        this.simulateChat(bot)
      }
    }, this.getRandomResponseTime(bot))

    // Simulate game duration (5-15 minutes)
    const gameDuration = 300000 + Math.random() * 600000
    
    setTimeout(() => {
      clearInterval(markingInterval)
      this.endBotGame(bot, room)
    }, gameDuration)
  }

  // Simulate bot marking a card
  private simulateCardMark(bot: BotPlayer) {
    // This would integrate with your game logic
    console.log(`🤖 ${bot.name} marked a card`)
  }

  // Simulate bot chat messages
  private simulateChat(bot: BotPlayer) {
    const messages = {
      friendly: [
        "Good luck everyone! 😊",
        "This is fun!",
        "Nice game so far!",
        "Hope everyone is having a great time!"
      ],
      competitive: [
        "Let's see what you got! 🔥",
        "Bring it on!",
        "I'm feeling lucky today",
        "Game on!"
      ],
      casual: [
        "Just chillin' 😎",
        "Taking it easy",
        "No rush",
        "Enjoying the game"
      ],
      silent: [] // Silent bots don't chat
    }

    const botMessages = messages[bot.personality as keyof typeof messages] || []
    if (botMessages.length > 0) {
      const message = botMessages[Math.floor(Math.random() * botMessages.length)]
      console.log(`🤖 ${bot.name}: ${message}`)
    }
  }

  // End bot game and determine win/loss
  private async endBotGame(bot: BotPlayer, room: GameRoom) {
    try {
      // Bots always win to ensure they never lose money
      const botWins = true
      const winnings = room.stake * 0.9 // 90% of stake as winnings

      console.log(`🤖 ${bot.name} won the game (bots always win)`)

      // Update bot statistics
      await supabase.rpc('update_bot_stats', {
        bot_id_param: bot.id,
        won_param: botWins,
        winnings_param: winnings
      })

      // Update bot session
      const { data: session } = await supabase
        .from('bot_game_sessions')
        .select('id')
        .eq('bot_id', bot.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .single()

      if (session) {
        await supabase
          .from('bot_game_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            won: botWins,
            winnings: winnings
          })
          .eq('id', session.id)
      }
    } catch (error) {
      console.error('Error ending bot game:', error)
    }
  }

  // Get random response time based on bot settings
  private getRandomResponseTime(bot: BotPlayer): number {
    const min = bot.response_time_min
    const max = bot.response_time_max
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  // Manual function to add bot to specific room (for testing)
  async addBotToSpecificRoom(roomId: string, botId?: string) {
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (!room) {
        throw new Error('Room not found')
      }

      if (botId) {
        // Add specific bot
        const { data: bot } = await supabase
          .from('bot_players')
          .select('*')
          .eq('id', botId)
          .eq('is_enabled', true)
          .single()

        if (bot) {
          await this.addBotToRoom(room)
        }
      } else {
        // Add any available bot
        await this.addBotToRoom(room)
      }
    } catch (error) {
      console.error('Error adding bot to specific room:', error)
      throw error
    }
  }
}

// Export singleton instance
export const botManager = BotManager.getInstance()
