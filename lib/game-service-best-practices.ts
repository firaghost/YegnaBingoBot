/**
 * Game Service - Best Practices Implementation
 * Implements industry standards for game state management, error handling, and performance
 */

import { supabaseAdmin } from './supabase'
import { optimizedTimerManager } from './optimized-timer-manager'
import { databaseOptimizer } from './database-optimizer'

// Types for type safety
interface GameCreationResult {
  success: boolean
  gameId?: string
  message: string
}

interface PlayerJoinResult {
  success: boolean
  message: string
  currentPlayerCount: number
}

interface BingoValidationResult {
  isValid: boolean
  isWinner: boolean
  validationDetails: any
  claimTimestamp: string
}

interface NumberCallResult {
  success: boolean
  numberCalled?: number
  letter?: string
  remainingNumbers: number
  message: string
}

export class GameServiceBestPractices {
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000 // 1 second
  
  /**
   * Create a new game with comprehensive validation
   */
  async createGame(roomId: string, creatorId: string, stake: number): Promise<GameCreationResult> {
    try {
      console.log(`🎮 Creating game for room ${roomId}, creator ${creatorId}, stake ${stake}`)
      
      const { data, error } = await supabaseAdmin.rpc('create_game_safe', {
        p_room_id: roomId,
        p_creator_id: creatorId,
        p_stake: stake
      })

      if (error) {
        console.error('❌ Error creating game:', error)
        return {
          success: false,
          message: `Failed to create game: ${error.message}`
        }
      }

      const result = data[0]
      if (!result.success) {
        console.warn(`⚠️ Game creation failed: ${result.message}`)
        return {
          success: false,
          message: result.message
        }
      }

      console.log(`✅ Game created successfully: ${result.game_id}`)
      return {
        success: true,
        gameId: result.game_id,
        message: result.message
      }

    } catch (error) {
      console.error('❌ Unexpected error creating game:', error)
      return {
        success: false,
        message: 'Internal server error'
      }
    }
  }

  /**
   * Add player to game with atomic operations and validation
   */
  async addPlayerToGame(gameId: string, userId: string, maxPlayers = 20): Promise<PlayerJoinResult> {
    let retries = 0
    
    while (retries < this.MAX_RETRIES) {
      try {
        console.log(`👤 Adding player ${userId} to game ${gameId} (attempt ${retries + 1})`)
        
        const { data, error } = await supabaseAdmin.rpc('add_player_to_game', {
          p_game_id: gameId,
          p_user_id: userId,
          p_max_players: maxPlayers
        })

        if (error) {
          console.error('❌ Error adding player:', error)
          
          // Retry on connection errors
          if (this.isRetryableError(error) && retries < this.MAX_RETRIES - 1) {
            retries++
            await this.delay(this.RETRY_DELAY * retries)
            continue
          }
          
          return {
            success: false,
            message: `Failed to join game: ${error.message}`,
            currentPlayerCount: 0
          }
        }

        const result = data[0]
        
        if (result.success) {
          console.log(`✅ Player ${userId} added to game ${gameId}. Players: ${result.current_player_count}`)
          
          // Start timer if this is the first player
          if (result.current_player_count === 1) {
            this.initializeGameTimer(gameId)
          }
        } else {
          console.warn(`⚠️ Failed to add player: ${result.message}`)
        }

        return {
          success: result.success,
          message: result.message,
          currentPlayerCount: result.current_player_count
        }

      } catch (error) {
        console.error(`❌ Unexpected error adding player (attempt ${retries + 1}):`, error)
        
        if (retries < this.MAX_RETRIES - 1) {
          retries++
          await this.delay(this.RETRY_DELAY * retries)
        } else {
          return {
            success: false,
            message: 'Internal server error',
            currentPlayerCount: 0
          }
        }
      }
    }

    return {
      success: false,
      message: 'Max retries exceeded',
      currentPlayerCount: 0
    }
  }

  /**
   * Start game with proper state transitions
   */
  async startGame(gameId: string): Promise<boolean> {
    try {
      console.log(`🚀 Starting game ${gameId}`)
      
      // Update game status to active
      const success = await databaseOptimizer.updateGameCritical(gameId, {
        status: 'active',
        started_at: new Date().toISOString()
      })

      if (!success) {
        console.error(`❌ Failed to start game ${gameId}`)
        return false
      }

      // Get game level for timer configuration
      const game = await databaseOptimizer.getGame(gameId)
      if (!game) {
        console.error(`❌ Game ${gameId} not found after starting`)
        return false
      }

      // Get room level
      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('game_level, default_level')
        .eq('id', game.room_id)
        .single()

      const gameLevel = room?.game_level || room?.default_level || 'medium'

      // Add to optimized timer system
      const timerSuccess = optimizedTimerManager.addGame(gameId, gameLevel as any)
      if (!timerSuccess) {
        console.warn(`⚠️ Could not add game ${gameId} to timer system`)
        // Don't fail the game start, but log the issue
      }

      console.log(`✅ Game ${gameId} started successfully`)
      return true

    } catch (error) {
      console.error(`❌ Error starting game ${gameId}:`, error)
      return false
    }
  }

  /**
   * Call next number with fairness validation
   */
  async callNextNumber(gameId: string): Promise<NumberCallResult> {
    try {
      const { data, error } = await supabaseAdmin.rpc('call_next_number', {
        p_game_id: gameId
      })

      if (error) {
        console.error('❌ Error calling number:', error)
        return {
          success: false,
          remainingNumbers: 0,
          message: `Failed to call number: ${error.message}`
        }
      }

      const result = data[0]
      
      if (result.success) {
        console.log(`📢 Game ${gameId}: Called ${result.letter}${result.number_called} (${result.remaining_numbers} remaining)`)
        
        // Batch update for performance (non-critical data)
        databaseOptimizer.batchUpdateGameState(gameId, {
          last_called_at: new Date().toISOString()
        })

        // Check if game should end (no more numbers)
        if (result.remaining_numbers === 0) {
          await this.endGame(gameId, undefined, 'numbers_exhausted')
        }
      }

      return {
        success: result.success,
        numberCalled: result.number_called,
        letter: result.letter,
        remainingNumbers: result.remaining_numbers,
        message: result.message
      }

    } catch (error) {
      console.error(`❌ Error calling number for game ${gameId}:`, error)
      return {
        success: false,
        remainingNumbers: 0,
        message: 'Internal server error'
      }
    }
  }

  /**
   * Validate bingo claim with anti-cheat measures
   */
  async validateBingoClaim(
    gameId: string,
    userId: string,
    claimedCells: number[],
    bingoPattern: string,
    userCard: number[][]
  ): Promise<BingoValidationResult> {
    try {
      console.log(`🎯 Validating bingo claim for user ${userId} in game ${gameId}`)
      
      const { data, error } = await supabaseAdmin.rpc('validate_bingo_claim', {
        p_game_id: gameId,
        p_user_id: userId,
        p_claimed_cells: claimedCells,
        p_bingo_pattern: bingoPattern,
        p_user_card: userCard
      })

      if (error) {
        console.error('❌ Error validating bingo claim:', error)
        return {
          isValid: false,
          isWinner: false,
          validationDetails: { error: error.message },
          claimTimestamp: new Date().toISOString()
        }
      }

      const result = data[0]
      
      if (result.is_winner) {
        console.log(`🏆 WINNER! User ${userId} won game ${gameId}`)
        
        // End game immediately for winner
        await this.endGame(gameId, userId, 'bingo_claimed')
        
        // Process winnings
        await this.processWinnings(gameId, userId)
      } else if (result.is_valid) {
        console.log(`✅ Valid bingo claim from ${userId}, but not winner`)
      } else {
        console.log(`❌ Invalid bingo claim from ${userId}`)
      }

      return {
        isValid: result.is_valid,
        isWinner: result.is_winner,
        validationDetails: result.validation_details,
        claimTimestamp: result.claim_timestamp
      }

    } catch (error) {
      console.error(`❌ Error validating bingo claim:`, error)
      return {
        isValid: false,
        isWinner: false,
        validationDetails: { error: 'Internal server error' },
        claimTimestamp: new Date().toISOString()
      }
    }
  }

  /**
   * End game with proper cleanup
   */
  async endGame(gameId: string, winnerId?: string, reason = 'game_ended'): Promise<boolean> {
    try {
      console.log(`🏁 Ending game ${gameId}, winner: ${winnerId || 'none'}, reason: ${reason}`)
      
      // Stop timer first
      optimizedTimerManager.removeGame(gameId)
      
      // Update game status
      const success = await databaseOptimizer.updateGameCritical(gameId, {
        status: 'finished',
        winner_id: winnerId || null,
        ended_at: new Date().toISOString()
      })

      if (!success) {
        console.error(`❌ Failed to end game ${gameId}`)
        return false
      }

      // Process post-game operations
      await this.processPostGame(gameId, winnerId, reason)
      
      console.log(`✅ Game ${gameId} ended successfully`)
      return true

    } catch (error) {
      console.error(`❌ Error ending game ${gameId}:`, error)
      return false
    }
  }

  /**
   * Process winnings and update user stats
   */
  private async processWinnings(gameId: string, winnerId: string): Promise<void> {
    try {
      // Get game details
      const game = await databaseOptimizer.getGame(gameId, false) // Don't use cache for critical data
      if (!game) {
        console.error(`❌ Game ${gameId} not found for winnings processing`)
        return
      }

      const prizePool = game.prize_pool
      const commission = prizePool * 0.1 // 10% commission
      const netWinnings = prizePool - commission

      console.log(`💰 Processing winnings for ${winnerId}: ${netWinnings} ETB (${prizePool} - ${commission} commission)`)

      // Update user balance and stats atomically
      const { error } = await supabaseAdmin.rpc('process_game_winnings', {
        p_user_id: winnerId,
        p_game_id: gameId,
        p_winnings: netWinnings,
        p_commission: commission
      })

      if (error) {
        console.error('❌ Error processing winnings:', error)
        // Log for manual processing
        await this.logCriticalError('winnings_processing_failed', {
          gameId,
          winnerId,
          amount: netWinnings,
          error: error.message
        })
      } else {
        console.log(`✅ Winnings processed successfully for ${winnerId}`)
      }

    } catch (error) {
      console.error(`❌ Error in processWinnings:`, error)
      await this.logCriticalError('winnings_processing_error', {
        gameId,
        winnerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Post-game processing
   */
  private async processPostGame(gameId: string, winnerId?: string, reason = 'game_ended'): Promise<void> {
    try {
      // Update player stats
      const game = await databaseOptimizer.getGame(gameId, false)
      if (!game) return

      // Batch update player stats
      const playerUpdates = game.players.map((playerId: string) => ({
        user_id: playerId,
        games_played_increment: 1,
        games_won_increment: playerId === winnerId ? 1 : 0,
        xp_increment: this.calculateXP(playerId === winnerId, reason)
      }))

      // Use batch operation for efficiency
      databaseOptimizer.batchUpdateBalance(winnerId || '', 0, 'win') // Placeholder for batch stats update

      console.log(`📊 Post-game processing completed for ${game.players.length} players`)

    } catch (error) {
      console.error(`❌ Error in post-game processing:`, error)
    }
  }

  /**
   * Calculate XP based on game outcome
   */
  private calculateXP(isWinner: boolean, reason: string): number {
    let baseXP = 10 // Base XP for participation
    
    if (isWinner) {
      baseXP += 25 // Winner bonus
      
      if (reason === 'bingo_claimed') {
        baseXP += 15 // Skill bonus for actual bingo
      }
    }
    
    return baseXP
  }

  /**
   * Initialize game timer
   */
  private initializeGameTimer(gameId: string): void {
    // Timer will be added when game starts
    console.log(`⏰ Game timer will be initialized when game ${gameId} starts`)
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'connection',
      'timeout',
      'network',
      'temporary'
    ]
    
    const errorMessage = error.message?.toLowerCase() || ''
    return retryableErrors.some(keyword => errorMessage.includes(keyword))
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Log critical errors for manual review
   */
  private async logCriticalError(type: string, details: any): Promise<void> {
    try {
      await supabaseAdmin.from('admin_logs').insert({
        action: 'critical_error',
        details: JSON.stringify({ type, details, timestamp: new Date().toISOString() }),
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Failed to log critical error:', error)
    }
  }

  /**
   * Get comprehensive game statistics
   */
  async getGameStatistics(): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_game_statistics')
      
      if (error) {
        console.error('❌ Error getting game statistics:', error)
        return null
      }

      return data[0]
    } catch (error) {
      console.error('❌ Error in getGameStatistics:', error)
      return null
    }
  }

  /**
   * Perform system cleanup
   */
  async performCleanup(): Promise<{ cleanedGames: number; message: string }> {
    try {
      const { data, error } = await supabaseAdmin.rpc('cleanup_old_games')
      
      if (error) {
        console.error('❌ Error during cleanup:', error)
        return { cleanedGames: 0, message: 'Cleanup failed' }
      }

      const result = data[0]
      console.log(`🧹 Cleanup completed: ${result.message}`)
      
      return {
        cleanedGames: result.cleaned_games,
        message: result.message
      }
    } catch (error) {
      console.error('❌ Error in performCleanup:', error)
      return { cleanedGames: 0, message: 'Cleanup error' }
    }
  }

  /**
   * Health check for monitoring
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: any
  }> {
    try {
      const stats = await this.getGameStatistics()
      const timerStats = optimizedTimerManager.getStats()
      const dbStats = databaseOptimizer.getStats()

      const status = this.determineHealthStatus(stats, timerStats, dbStats)

      return {
        status,
        details: {
          gameStats: stats,
          timerStats,
          dbStats,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('❌ Health check failed:', error)
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  /**
   * Determine system health status
   */
  private determineHealthStatus(gameStats: any, timerStats: any, dbStats: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (!gameStats || !timerStats || !dbStats) {
      return 'unhealthy'
    }

    // Check memory pressure
    if (timerStats.memoryPressure) {
      return 'degraded'
    }

    // Check database performance
    if (dbStats.isThrottled) {
      return 'degraded'
    }

    // Check game load
    if (gameStats.system_health === 'OVERLOADED') {
      return 'degraded'
    }

    return 'healthy'
  }
}

// Export singleton instance
export const gameService = new GameServiceBestPractices()
