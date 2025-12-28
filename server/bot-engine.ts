import { SupabaseClient } from '@supabase/supabase-js'
import { generateBingoCard } from '../lib/utils.js'

const BOTS_ENABLED = process.env.ENABLE_BOTS === 'true'

// Runtime config to reach the Next API for claim
const API_BASE = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000'

// Internal state for bot sessions per game
interface BotSession {
  card: number[][]
  pendingClaim?: NodeJS.Timeout | null
  lastCallCount: number
}

class BotEngine {
  private sessions: Map<string, Map<string, BotSession>> = new Map() // gameId -> (botId -> session)
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  // Ensure session exists for game bots
  async ensureGame(gameId: string): Promise<void> {
    if (!BOTS_ENABLED) return
    const { data: game } = await this.supabase
      .from('games')
      .select('id, bots, called_numbers, status')
      .eq('id', gameId)
      .single()
    if (!game) return

    if (!this.sessions.has(gameId)) this.sessions.set(gameId, new Map())
    const map = this.sessions.get(gameId)!

    const botIds: string[] = game.bots || []
    for (const botId of botIds) {
      if (!map.has(botId)) {
        map.set(botId, {
          card: generateBingoCard(),
          lastCallCount: game.called_numbers?.length || 0,
          pendingClaim: null
        })
      }
    }
  }

  // Called on every number tick
  async tick(gameId: string): Promise<void> {
    if (!BOTS_ENABLED) return
    const { data: game } = await this.supabase
      .from('games')
      .select('id, status, bots, called_numbers, prize_pool, stake')
      .eq('id', gameId)
      .single()
    if (!game || game.status !== 'active') return

    await this.ensureGame(gameId)
    const map = this.sessions.get(gameId)!

    const called = (game.called_numbers || []) as number[]

    for (const botId of game.bots || []) {
      const sess = map.get(botId)
      if (!sess) continue

      const callCount = called.length
      if (callCount === sess.lastCallCount) continue
      sess.lastCallCount = callCount

      // Build marked matrix based on called numbers (center free)
      const marked: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false))
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (r === 2 && c === 2) { marked[r][c] = true; continue }
          const num = sess.card[r][c]
          marked[r][c] = called.includes(num)
        }
      }

      // Check for bingo
      if (!this.checkBingo(marked)) continue

      // Schedule a claim according to behavior profile / win probability
      const delayMs = await this.getClaimDelay(botId)

      if (sess.pendingClaim) { clearTimeout(sess.pendingClaim); sess.pendingClaim = null }
      sess.pendingClaim = setTimeout(async () => {
        try {
          const resp = await fetch(`${API_BASE}/api/game/claim-bingo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId,
              userId: botId,
              card: sess.card,
              marked
            })
          })
          await resp.json().catch(() => null)
        } catch {}
      }, delayMs)
    }
  }

  private async getClaimDelay(botId: string): Promise<number> {
    if (!BOTS_ENABLED) return 500
    // Fetch profile once (or could cache)
    const { data: bot } = await this.supabase
      .from('bots')
      .select('behavior_profile, win_probability, difficulty')
      .eq('id', botId)
      .single()
    const profile = bot?.behavior_profile || {}
    const checkRange: [number, number] = profile.check_bingo_interval_ms || [300, 800]
    // Bias delay by win probability: higher prob => lower delay
    const wp = Math.max(0, Math.min(1, bot?.win_probability ?? 0.5))
    if (wp >= 0.999) return 30 // near-instant for guaranteed wins

    const min = Math.max(50, checkRange[0] || 300)
    const max = Math.max(min + 1, checkRange[1] || 800)
    const base = Math.floor(min + Math.random() * (max - min))
    const bias = Math.floor(base * (1 - wp)) // more delay if lower probability
    return Math.max(60, base - bias)
  }

  private checkBingo(marked: boolean[][]): boolean {
    // rows
    for (let r = 0; r < 5; r++) if (marked[r].every(Boolean)) return true
    // cols
    for (let c = 0; c < 5; c++) { let ok = true; for (let r = 0; r < 5; r++) if (!marked[r][c]) { ok = false; break } if (ok) return true }
    // diags
    if ([0,1,2,3,4].every(i => marked[i][i])) return true
    if ([0,1,2,3,4].every(i => marked[i][4 - i])) return true
    return false
  }
}

export { BotEngine }
