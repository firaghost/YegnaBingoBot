import { getConfig } from './admin-config'
import type { GameState, GamePlayer } from './game-state-manager'

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'unbeatable'

export interface CheatPlan {
  shouldCheat: boolean
  targetUsername?: string
  pattern?: 'row' | 'column' | 'diagonal' | 'full_house'
  winningCells?: number[]
}

export class CheatEngine {
  private difficulty: BotDifficulty = 'hard'
  private adminDebug: boolean = false

  async loadConfig(): Promise<void> {
    try {
      const diff = (await getConfig('bot_difficulty')) as BotDifficulty | null
      const debug = await getConfig('admin_debug_mode')
      const envDiff = process.env.BOT_DIFFICULTY as BotDifficulty | undefined
      const envDebug = process.env.ADMIN_DEBUG_MODE
      this.difficulty = (envDiff || diff || 'hard') as BotDifficulty
      this.adminDebug = (envDebug === 'true') || Boolean(debug)
    } catch {
      const envDiff = process.env.BOT_DIFFICULTY as BotDifficulty | undefined
      const envDebug = process.env.ADMIN_DEBUG_MODE
      this.difficulty = (envDiff || 'hard') as BotDifficulty
      this.adminDebug = envDebug === 'true'
    }
  }

  isUnbeatable(): boolean {
    return this.difficulty === 'unbeatable'
  }

  isAdminDebug(): boolean {
    return this.adminDebug
  }

  computePlan(game: GameState): CheatPlan {
    if (!this.isUnbeatable()) return { shouldCheat: false }
    if (game.status !== 'in_progress') return { shouldCheat: false }
    if (game.winner_claimed) return { shouldCheat: false }
    const called = new Set<number>(game.numbers_called)
    for (const player of Array.from(game.players.values())) {
      if (player.status !== 'active') continue
      const win = this.findWinningLine(player, called)
      if (win) {
        return {
          shouldCheat: true,
          targetUsername: player.username,
          pattern: win.pattern,
          winningCells: win.cells
        }
      }
    }
    return { shouldCheat: false }
  }

  private findWinningLine(player: GamePlayer, called: Set<number>): { pattern: 'row'|'column'|'diagonal'|'full_house', cells: number[] } | null {
    const b = player.board
    if (!b || b.length !== 5) return null
    const isMarked = (r: number, c: number) => (r === 2 && c === 2) || called.has(b[r][c])
    for (let r = 0; r < 5; r++) {
      let ok = true
      const cells: number[] = []
      for (let c = 0; c < 5; c++) {
        if (!isMarked(r, c)) { ok = false; break }
        cells.push(b[r][c])
      }
      if (ok) return { pattern: 'row', cells }
    }
    for (let c = 0; c < 5; c++) {
      let ok = true
      const cells: number[] = []
      for (let r = 0; r < 5; r++) {
        if (!isMarked(r, c)) { ok = false; break }
        cells.push(b[r][c])
      }
      if (ok) return { pattern: 'column', cells }
    }
    let okDiag = true
    const diag1: number[] = []
    for (let i = 0; i < 5; i++) {
      if (!isMarked(i, i)) { okDiag = false; break }
      diag1.push(b[i][i])
    }
    if (okDiag) return { pattern: 'diagonal', cells: diag1 }
    okDiag = true
    const diag2: number[] = []
    for (let i = 0; i < 5; i++) {
      if (!isMarked(i, 4 - i)) { okDiag = false; break }
      diag2.push(b[i][4 - i])
    }
    if (okDiag) return { pattern: 'diagonal', cells: diag2 }
    let all = true
    const allCells: number[] = []
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (!isMarked(r, c)) { all = false; break }
        allCells.push(b[r][c])
      }
      if (!all) break
    }
    if (all) return { pattern: 'full_house', cells: allCells }
    return null
  }
}
