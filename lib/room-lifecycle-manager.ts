import { Server as SocketServer } from 'socket.io'
import { supabaseAdmin } from './supabase'
import { waitingRoomManager } from './waiting-room-manager'
import { gameStateManager } from './game-state-manager'

/**
 * RoomLifecycleManager
 *
 * - Manages pre-countdown timers for waiting rooms (to avoid ghost countdowns)
 * - Periodically checks for idle in-progress games and auto-ends them
 * - Triggers wallet-safe stake refunds via SQL helper functions
 */
export class RoomLifecycleManager {
  private preCountdownTimers = new Map<string, NodeJS.Timeout>()
  private idleCheckTimer?: NodeJS.Timeout
  private io?: SocketServer

  private readonly idleTimeoutMs: number
  private readonly idleCheckIntervalMs: number

  constructor(idleTimeoutMs: number = 30_000, idleCheckIntervalMs: number = 5_000) {
    this.idleTimeoutMs = idleTimeoutMs
    this.idleCheckIntervalMs = idleCheckIntervalMs
  }

  /** Attach Socket.IO instance so we can emit game_over on idle auto-end */
  attachIO(io: SocketServer): void {
    this.io = io
  }

  /**
   * Schedule the "waiting period" before starting the actual countdown.
   * Any existing pre-countdown timer for this room is cleared first.
   */
  schedulePreCountdown(roomId: string, waitingTimeMs: number, runCountdown: () => void): void {
    this.cancelPreCountdown(roomId)

    const timeout = setTimeout(() => {
      this.preCountdownTimers.delete(roomId)
      runCountdown()
    }, waitingTimeMs)

    this.preCountdownTimers.set(roomId, timeout)
  }

  /** Cancel any scheduled pre-countdown for a room */
  cancelPreCountdown(roomId: string): void {
    const timeout = this.preCountdownTimers.get(roomId)
    if (timeout) {
      clearTimeout(timeout)
      this.preCountdownTimers.delete(roomId)
      console.log(`🚫 Cancelled pre-countdown timer for room ${roomId}`)
    }
  }

  /** Mark activity for a waiting room (updates rooms.last_activity_at) */
  async markWaitingRoomActivity(roomId: string): Promise<void> {
    await this.updateRoomActivity(roomId)
  }

  /** Mark activity for an in-game room (updates rooms.last_activity_at) */
  async markInGameActivity(roomId: string): Promise<void> {
    await this.updateRoomActivity(roomId)
  }

  private async updateRoomActivity(roomId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('rooms')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', roomId)
    } catch (error) {
      console.error(`Error updating last_activity_at for room ${roomId}:`, error)
    }
  }

  /** Start periodic idle-game monitoring */
  startIdleMonitor(): void {
    if (this.idleCheckTimer) return

    this.idleCheckTimer = setInterval(() => {
      this.checkIdleGames().catch((error) => {
        console.error('Error during idle game check:', error)
      })
    }, this.idleCheckIntervalMs)

    console.log(`⏱️ RoomLifecycleManager idle monitor started (timeout=${this.idleTimeoutMs}ms, interval=${this.idleCheckIntervalMs}ms)`)        
  }

  stopIdleMonitor(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer)
      this.idleCheckTimer = undefined
      console.log('⏹️ RoomLifecycleManager idle monitor stopped')
    }
  }

  /**
   * Iterate over active in-progress games and auto-end any that are idle.
   * Idle is defined by gameStateManager.last_activity exceeding idleTimeoutMs.
   */
  private async checkIdleGames(): Promise<void> {
    const now = Date.now()

    for (const [roomId, game] of gameStateManager.getActiveGames().entries()) {
      if (game.status !== 'in_progress') continue

      const lastActivity = game.last_activity?.getTime?.() ?? game.last_activity?.valueOf?.() ?? Date.now()
      const idleMs = now - lastActivity

      if (idleMs >= this.idleTimeoutMs) {
        await this.handleIdleGame(roomId)
      }
    }
  }

  /** Auto-end a single idle game and trigger stake refunds */
  private async handleIdleGame(roomId: string): Promise<void> {
    const game = gameStateManager.getGameState(roomId)
    if (!game || game.status !== 'in_progress') return

    const idleSeconds = Math.floor((Date.now() - game.last_activity.getTime()) / 1000)
    console.log(`⏳ Auto-ending idle game for room ${roomId} after ${idleSeconds}s with no activity`)

    try {
      // End game at application + DB level
      await gameStateManager.endGame(roomId, null, 'idle_timeout')

      // Mark room as cancelled in the database to avoid ghost in_progress rooms
      try {
        await supabaseAdmin
          .from('rooms')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', roomId)
      } catch (roomError) {
        console.error(`Error updating room ${roomId} status to cancelled after idle timeout:`, roomError)
      }

      // Process stake refunds (best-effort, per-player atomicity in SQL)
      await this.processStakeRefunds(roomId, game.id, idleSeconds)

      // Notify clients that the game is over due to idle timeout
      if (this.io) {
        const finalNumbers = game.numbers_called || []
        const duration = Math.floor((Date.now() - game.started_at.getTime()) / 1000)

        this.io.to(roomId).emit('game_over', {
          winner: null,
          reason: 'idle_timeout',
          finalNumbers,
          duration,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error(`Error auto-ending idle game for room ${roomId}:`, error)
    }
  }

  /**
   * Process stake refunds for all players in a room using room_refund_player_stake.
   *
   * Assumptions:
   * - room_players.stake_amount and stake_source are populated when stake is deducted.
   * - room_players.has_refund is false until a refund is successfully processed.
   * - room_refund_player_stake is fully idempotent per (user_id, game_id).
   */
  private async processStakeRefunds(roomId: string, gameSessionId: string, idleSeconds: number): Promise<void> {
    try {
      // Fetch all room players with potential stakes
      const { data: roomPlayers, error } = await supabaseAdmin
        .from('room_players')
        .select('user_id, stake_amount, stake_source, has_refund')
        .eq('room_id', roomId)

      if (error) {
        console.error('Error fetching room players for refund:', error)
        return
      }

      if (!roomPlayers || roomPlayers.length === 0) {
        return
      }

      // Log auto-end action once per room
      try {
        await supabaseAdmin
          .from('room_audit_logs')
          .insert({
            room_id: roomId,
            action: 'idle_auto_end',
            details: {
              game_session_id: gameSessionId,
              idle_seconds: idleSeconds
            }
          })
      } catch (logError) {
        console.error('Error inserting idle_auto_end audit log:', logError)
      }

      for (const player of roomPlayers) {
        if (!player.user_id) continue
        if (!player.stake_amount || player.stake_amount <= 0) continue
        if (player.has_refund) continue

        const stakeSource = player.stake_source || 'real'

        try {
          const { error: refundError } = await supabaseAdmin.rpc('room_refund_player_stake', {
            p_room_id: roomId,
            p_user_id: player.user_id,
            p_game_id: gameSessionId,
            p_stake_source: stakeSource,
            p_amount: player.stake_amount
          })

          if (refundError) {
            console.error('Error processing stake refund for player:', {
              roomId,
              userId: player.user_id,
              error: refundError
            })
            continue
          }

          // Mark refund flag on room_players to guard against double-refunds
          await supabaseAdmin
            .from('room_players')
            .update({ has_refund: true })
            .eq('room_id', roomId)
            .eq('user_id', player.user_id)
        } catch (singleError) {
          console.error('Unhandled error during stake refund for player:', {
            roomId,
            userId: player.user_id,
            error: singleError
          })
        }
      }
    } catch (error) {
      console.error('Error in processStakeRefunds:', error)
    }
  }
}

// Export singleton instance used by the integrated game server and socket servers
export const roomLifecycleManager = new RoomLifecycleManager()
