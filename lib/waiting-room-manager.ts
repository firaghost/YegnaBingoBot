import { supabaseAdmin } from './supabase'
import { v4 as uuidv4 } from 'uuid'

// Types for waiting room system
export interface Player {
  id: string
  username: string
  telegram_id?: string
  socket_id: string
  joined_at: Date
  status: 'active' | 'disconnected' | 'finished'
  last_seen: Date
}

export interface WaitingRoom {
  id: string
  name: string
  status: 'waiting' | 'starting' | 'in_progress' | 'finished'
  game_level: 'easy' | 'medium' | 'hard'
  max_players: number
  min_players: number
  current_players: number
  active_player_count: number
  countdown_started_at?: Date
  created_at: Date
  players: Player[]
}

export interface GameSession {
  id: string
  room_id: string
  game_level: string
  status: 'waiting' | 'starting' | 'in_progress' | 'finished' | 'cancelled'
  started_at?: Date
  finished_at?: Date
  total_players: number
  active_players: number
  game_data: any
}

// In-memory cache for active rooms and countdowns
const activeRooms = new Map<string, WaitingRoom>()
const roomCountdowns = new Map<string, NodeJS.Timeout>()
const roomCleanupInterval = new Map<string, NodeJS.Timeout>()

export class WaitingRoomManager {
  private supabase = supabaseAdmin

  /**
   * Find or create a waiting room for a player
   */
  async findOrCreateRoom(gameLevel: 'easy' | 'medium' | 'hard' = 'medium'): Promise<WaitingRoom> {
    try {
      // First, check cached rooms for available ones
      let foundRoom: WaitingRoom | null = null
      activeRooms.forEach((room, roomId) => {
        if (!foundRoom && room.game_level === gameLevel && 
            room.status === 'waiting' && 
            room.current_players < room.max_players) {
          console.log(`🔄 Found existing room: ${roomId} (${room.current_players}/${room.max_players})`)
          foundRoom = room
        }
      })
      
      if (foundRoom) {
        return foundRoom
      }

      // Try to find an available waiting room in database
      const { data: availableRooms } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('game_level', gameLevel)
        .eq('status', 'waiting')
        .lt('current_players', 'max_players')
        .order('created_at', { ascending: true })
        .limit(1)

      if (availableRooms && availableRooms.length > 0) {
        const room = availableRooms[0]
        const players = await this.getRoomPlayers(room.id)
        
        const waitingRoom: WaitingRoom = {
          id: room.id,
          name: room.name,
          status: room.status,
          game_level: room.game_level,
          max_players: room.max_players,
          min_players: room.min_players,
          current_players: room.current_players,
          active_player_count: players.length, // Use actual player count
          countdown_started_at: room.countdown_started_at,
          created_at: new Date(room.created_at),
          players
        }

        // Cache the room
        activeRooms.set(room.id, waitingRoom)
        console.log(`🔄 Found database room: ${room.id} (${players.length}/${room.max_players})`)
        return waitingRoom
      }

      // No available room found, create a new one
      console.log(`🆕 Creating new room for ${gameLevel}`)
      return await this.createNewRoom(gameLevel)
    } catch (error) {
      console.error('Error finding or creating room:', error)
      throw new Error('Failed to find or create waiting room')
    }
  }

  /**
   * Create a new waiting room
   */
  async createNewRoom(gameLevel: 'easy' | 'medium' | 'hard' = 'medium'): Promise<WaitingRoom> {
    try {
      const roomId = `room_${uuidv4()}`
      const roomName = `${gameLevel.charAt(0).toUpperCase() + gameLevel.slice(1)} Game Room`
      
      // Get level settings
      const { data: levelSettings } = await this.supabase
        .from('levels')
        .select('*')
        .eq('name', gameLevel)
        .single()

      if (!levelSettings) {
        throw new Error(`Level settings not found for ${gameLevel}`)
      }

      // Create room in database
      const { data: newRoom, error } = await this.supabase
        .from('rooms')
        .insert({
          id: roomId,
          name: roomName,
          stake: gameLevel === 'easy' ? 5 : gameLevel === 'medium' ? 10 : 25,
          max_players: gameLevel === 'easy' ? 10 : gameLevel === 'medium' ? 8 : 6,
          min_players: process.env.ALLOW_SINGLE_PLAYER === 'true' ? 1 : 2,
          status: 'waiting',
          description: `${levelSettings.description} - Waiting for players`,
          color: gameLevel === 'easy' ? 'from-green-500 to-green-700' : 
                 gameLevel === 'medium' ? 'from-blue-500 to-blue-700' : 
                 'from-red-500 to-red-700',
          prize_pool: gameLevel === 'easy' ? 50 : gameLevel === 'medium' ? 80 : 150,
          game_level: gameLevel,
          room_type: 'waiting',
          current_players: 0
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating room:', error)
        throw new Error('Failed to create new room')
      }

      const waitingRoom: WaitingRoom = {
        id: newRoom.id,
        name: newRoom.name,
        status: 'waiting',
        game_level: gameLevel,
        max_players: newRoom.max_players,
        min_players: process.env.ALLOW_SINGLE_PLAYER === 'true' ? 1 : 2,
        current_players: 0,
        active_player_count: 0,
        created_at: new Date(newRoom.created_at),
        players: []
      }

      // Cache the room
      activeRooms.set(roomId, waitingRoom)
      
      console.log(`✅ Created new waiting room: ${roomId} (${gameLevel})`)
      return waitingRoom
    } catch (error) {
      console.error('Error creating new room:', error)
      throw error
    }
  }

  /**
   * Add a player to a waiting room
   */
  async addPlayerToRoom(roomId: string, player: Omit<Player, 'id' | 'joined_at' | 'status' | 'last_seen'>): Promise<WaitingRoom> {
    try {
      // Check if player is already in the room
      const { data: existingPlayer } = await this.supabase
        .from('room_players')
        .select('*')
        .eq('room_id', roomId)
        .eq('socket_id', player.socket_id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingPlayer) {
        console.log(`Player ${player.username} already in room ${roomId}`)
        return await this.getRoom(roomId)
      }

      // Add player to database
      const { data: newPlayer, error } = await this.supabase
        .from('room_players')
        .insert({
          room_id: roomId,
          username: player.username,
          telegram_id: player.telegram_id,
          socket_id: player.socket_id,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding player to room:', error)
        throw new Error('Failed to add player to room')
      }

      // Update room player count in database
      await this.updateRoomPlayerCount(roomId)
      
      // Update cached room
      const room = await this.getRoom(roomId)
      
      console.log(`✅ Added player ${player.username} to room ${roomId}`)
      return room
    } catch (error) {
      console.error('Error adding player to room:', error)
      throw error
    }
  }

  /**
   * Remove a player from a waiting room
   */
  async removePlayerFromRoom(roomId: string, socketId: string): Promise<WaitingRoom | null> {
    try {
      // Update player status to disconnected
      const { error } = await this.supabase
        .from('room_players')
        .update({ 
          status: 'disconnected',
          last_seen: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('socket_id', socketId)

      if (error) {
        console.error('Error removing player from room:', error)
        throw new Error('Failed to remove player from room')
      }

      // Update room player count in database
      await this.updateRoomPlayerCount(roomId)

      // Get updated room
      const room = await this.getRoom(roomId)
      
      // If no active players left, clean up the room
      if (room.active_player_count === 0) {
        await this.cleanupRoom(roomId)
        return null
      }

      console.log(`✅ Removed player from room ${roomId}`)
      return room
    } catch (error) {
      console.error('Error removing player from room:', error)
      throw error
    }
  }

  /**
   * Update room player count in database
   */
  private async updateRoomPlayerCount(roomId: string): Promise<void> {
    try {
      const players = await this.getRoomPlayers(roomId)
      const playerCount = players.length
      
      await this.supabase
        .from('rooms')
        .update({ 
          current_players: playerCount,
          active_player_count: playerCount
        })
        .eq('id', roomId)
        
      console.log(`📊 Updated room ${roomId} player count: ${playerCount}`)
    } catch (error) {
      console.error('Error updating room player count:', error)
    }
  }

  /**
   * Get room with current player list
   */
  async getRoom(roomId: string): Promise<WaitingRoom> {
    try {
      // Try to get from cache first
      if (activeRooms.has(roomId)) {
        const cachedRoom = activeRooms.get(roomId)!
        // Refresh player list from database
        cachedRoom.players = await this.getRoomPlayers(roomId)
        cachedRoom.active_player_count = cachedRoom.players.length
        cachedRoom.current_players = cachedRoom.players.length
        return cachedRoom
      }

      // Get from database
      const { data: roomData } = await this.supabase
        .rpc('get_room_with_player_count', { p_room_id: roomId })

      if (!roomData || roomData.length === 0) {
        throw new Error(`Room ${roomId} not found`)
      }

      const room = roomData[0]
      const players = await this.getRoomPlayers(roomId)

      const waitingRoom: WaitingRoom = {
        id: room.id,
        name: room.name,
        status: room.status,
        game_level: room.game_level,
        max_players: room.max_players,
        min_players: room.min_players,
        current_players: room.current_players,
        active_player_count: parseInt(room.active_player_count.toString()),
        countdown_started_at: room.countdown_started_at,
        created_at: room.created_at,
        players
      }

      // Cache the room
      activeRooms.set(roomId, waitingRoom)
      return waitingRoom
    } catch (error) {
      console.error('Error getting room:', error)
      throw error
    }
  }

  /**
   * Get active players in a room
   */
  async getRoomPlayers(roomId: string): Promise<Player[]> {
    try {
      const { data: players } = await this.supabase
        .rpc('get_active_room_players', { p_room_id: roomId })

      if (!players) return []

      return players.map((p: any) => ({
        id: p.id,
        username: p.username,
        telegram_id: p.telegram_id,
        socket_id: p.socket_id,
        joined_at: new Date(p.joined_at),
        status: p.status as 'active' | 'disconnected' | 'finished',
        last_seen: new Date()
      }))
    } catch (error) {
      console.error('Error getting room players:', error)
      return []
    }
  }

  /**
   * Start countdown for a room
   */
  startCountdown(roomId: string, callback: (seconds: number) => void, onComplete: () => void): void {
    // Clear existing countdown if any
    this.clearCountdown(roomId)

    let seconds = 10
    console.log(`🕐 Starting countdown for room ${roomId}: ${seconds} seconds`)

    const countdown = setInterval(() => {
      callback(seconds)
      
      if (seconds <= 0) {
        this.clearCountdown(roomId)
        onComplete()
        return
      }
      
      seconds--
    }, 1000)

    roomCountdowns.set(roomId, countdown)

    // Update database
    this.updateRoomCountdownStatus(roomId, 'starting')
  }

  /**
   * Update room countdown status in database
   */
  private async updateRoomCountdownStatus(roomId: string, status: 'starting' | 'waiting'): Promise<void> {
    try {
      const updateData = status === 'starting' 
        ? { countdown_started_at: new Date().toISOString(), status: 'starting' }
        : { countdown_started_at: null, status: 'waiting' }

      const { error } = await this.supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId)

      if (error) {
        console.error(`Error updating room ${roomId} countdown status:`, error)
      } else {
        console.log(`✅ Updated room ${roomId} status to ${status}`)
      }
    } catch (error) {
      console.error(`Error updating room ${roomId} countdown status:`, error)
    }
  }

  /**
   * Clear countdown for a room
   */
  clearCountdown(roomId: string): void {
    const countdown = roomCountdowns.get(roomId)
    if (countdown) {
      clearInterval(countdown)
      roomCountdowns.delete(roomId)
      console.log(`🚫 Cleared countdown for room ${roomId}`)

      // Update database
      this.updateRoomCountdownStatus(roomId, 'waiting')
    }
  }

  /**
   * Start a game for a room
   */
  async startGame(roomId: string): Promise<GameSession> {
    try {
      const room = await this.getRoom(roomId)

      // Create game session
      const { data: gameSession, error } = await this.supabase
        .from('game_sessions')
        .insert({
          room_id: roomId,
          game_level: room.game_level,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          total_players: room.active_player_count,
          active_players: room.active_player_count,
          game_data: {
            level_settings: await this.getLevelSettings(room.game_level),
            players: room.players.map(p => ({
              username: p.username,
              socket_id: p.socket_id,
              joined_at: p.joined_at
            }))
          }
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating game session:', error)
        throw new Error('Failed to create game session')
      }

      // Update room status
      await this.supabase
        .from('rooms')
        .update({ 
          status: 'in_progress',
          game_started_at: new Date().toISOString()
        })
        .eq('id', roomId)

      // Clear countdown and cache
      this.clearCountdown(roomId)
      activeRooms.delete(roomId)

      console.log(`🎮 Started game for room ${roomId}`)
      return gameSession
    } catch (error) {
      console.error('Error starting game:', error)
      throw error
    }
  }

  /**
   * Get level settings
   */
  async getLevelSettings(gameLevel: string) {
    const { data: levelSettings } = await this.supabase
      .from('levels')
      .select('*')
      .eq('name', gameLevel)
      .single()

    return levelSettings
  }

  /**
   * Clean up a room
   */
  async cleanupRoom(roomId: string): Promise<void> {
    try {
      // Clear any countdowns
      this.clearCountdown(roomId)

      // Remove from cache
      activeRooms.delete(roomId)

      // Update room status in database
      await this.supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)

      console.log(`🧹 Cleaned up room ${roomId}`)
    } catch (error) {
      console.error('Error cleaning up room:', error)
    }
  }

  /**
   * Run periodic cleanup of expired rooms
   */
  async runCleanup(): Promise<void> {
    try {
      const { data: deletedCount } = await this.supabase
        .rpc('cleanup_expired_rooms')

      if (deletedCount && deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired rooms`)
      }
    } catch (error) {
      console.error('Error running cleanup:', error)
    }
  }

  /**
   * Start periodic cleanup interval
   */
  startCleanupInterval(): void {
    // Run cleanup every 2 minutes
    setInterval(() => {
      this.runCleanup()
    }, 2 * 60 * 1000)

    console.log('🧹 Started periodic room cleanup (every 2 minutes)')
  }

  /**
   * Get all active rooms (for debugging)
   */
  getActiveRooms(): Map<string, WaitingRoom> {
    return activeRooms
  }

  /**
   * Get room countdown status
   */
  isCountdownActive(roomId: string): boolean {
    return roomCountdowns.has(roomId)
  }
}

// Export singleton instance
export const waitingRoomManager = new WaitingRoomManager()
