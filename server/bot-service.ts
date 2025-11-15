import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateBingoCard } from '../lib/utils'

export type BotJSON = {
  id: string
  name: string
  avatar?: string | null
  win_probability: number
  difficulty: 'easy' | 'medium' | 'hard' | 'unbeatable'
  behavior_profile: any
} | null

async function getDefaultBotsPerRoom(supabase: SupabaseClient): Promise<number> {
  try {
    const { data } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', 'default_bots_per_room')
      .eq('is_active', true)
      .maybeSingle()
    const raw = (data?.config_value as any) ?? 1
    const n = typeof raw === 'string' ? parseInt(raw) : (typeof raw === 'number' ? raw : 1)
    return Number.isFinite(n) && n >= 0 ? Math.min(10, Math.max(0, Math.floor(n))) : 1
  } catch {
    return 1
  }
}

export async function selectActiveBotJSON(supabase: SupabaseClient, difficulty?: 'easy'|'medium'|'hard'|'unbeatable', waitingMode: 'always_waiting'|'only_when_assigned' = 'always_waiting'): Promise<BotJSON> {
  try {
    const { data, error } = await (supabase as any).rpc('select_active_bot_json', {
      p_difficulty: difficulty ?? null,
      p_waiting_mode: waitingMode
    })
    if (error || !data) {
      console.warn('select_active_bot_json error or empty, falling back to direct select:', error?.message)
      // Fallback: pick a random active bot directly
      try {
        let query = supabase
          .from('bots')
          .select('id,name,avatar,win_probability,difficulty,behavior_profile')
          .eq('active', true)
          .order('random()')
          .limit(1)
        
        if (difficulty) {
          query = (query as any).eq('difficulty', difficulty)
        }
        
        const { data: botRow, error: selectError } = await (query as any)
        
        if (selectError) {
          console.warn('fallback direct bot select error:', selectError)
          return null
        }
        
        if (!botRow || botRow.length === 0) {
          console.warn('No active bots found in database')
          return null
        }
        
        return botRow[0] as any
      } catch (fbe) {
        console.warn('fallback direct bot select failed:', fbe)
        return null
      }
    }
    return data as BotJSON
  } catch (e) {
    console.warn('selectActiveBotJSON exception:', e)
    return null
  }
}

export async function autofillBotsForGame(
  supabase: SupabaseClient,
  game: any,
  stake: number,
  targetCount?: number
): Promise<{ updatedGame: any, assigned: string[] }> {
  let updated = game
  const assigned: string[] = []
  const desired = typeof targetCount === 'number' ? targetCount : await getDefaultBotsPerRoom(supabase)
  const current = (updated.bots?.length || 0)
  const need = Math.max(0, desired - current)
  for (let i = 0; i < need; i++) {
    // Prefer at least one unbeatable bot if available
    const bot = await selectActiveBotJSON(supabase, i === 0 ? 'unbeatable' : undefined)
    if (!bot || !bot.id) break
    const newBots = [...(updated.bots || []), bot.id]
    const { data, error } = await supabase
      .from('games')
      .update({ bots: newBots, prize_pool: (updated.prize_pool || 0) + (stake || 0) })
      .eq('id', updated.id)
      .select('*')
      .single()
    if (error || !data) break
    updated = data
    assigned.push(bot.id)
    // Ensure a game_players row exists with a stored board for this bot
    try {
      const { data: existing } = await supabase
        .from('game_players')
        .select('id')
        .eq('session_id', updated.id)
        .eq('bot_id', bot.id)
        .maybeSingle()
      if (!existing) {
        await supabase.from('game_players').insert({
          id: crypto.randomUUID(),
          session_id: updated.id,
          username: bot.name || 'Bot',
          socket_id: `bot_${bot.id}`,
          status: 'active',
          board: generateBingoCard(),
          score: 0,
          is_bot: true,
          bot_id: bot.id
        })
      }
    } catch (e) {
      console.warn('autofillBotsForGame: failed to ensure game_players row for bot', bot.id, e)
    }
    try {
      await (supabase as any).rpc('record_bot_earning', {
        p_bot_id: bot.id,
        p_amount: stake,
        p_type: 'stake',
        p_game_id: updated.id
      })
    } catch {}
  }
  return { updatedGame: updated, assigned }
}

export async function assignBotIfNeeded(supabase: SupabaseClient, game: any, stake: number): Promise<{ updatedGame: any, bot: BotJSON | null }> {
  try {
    const playersCount = (game.players?.length || 0)
    const botsCount = (game.bots?.length || 0)
    if (playersCount + botsCount >= 2) {
      return { updatedGame: game, bot: null }
    }

    // Prefer unbeatable bot for head-to-head
    const bot = await selectActiveBotJSON(supabase, 'unbeatable')
    if (!bot || !bot.id) {
      return { updatedGame: game, bot: null }
    }

    const newBots = [...(game.bots || []), bot.id]
    const { data: updated, error } = await supabase
      .from('games')
      .update({
        bots: newBots,
        prize_pool: (game.prize_pool || 0) + (stake || 0)
      })
      .eq('id', game.id)
      .select('*')
      .single()

    if (error) {
      console.warn('Failed to assign bot to game:', error)
      return { updatedGame: game, bot: null }
    }

    // Record bot stake for tracking (does not affect total_earnings)
    try {
      await (supabase as any).rpc('record_bot_earning', {
        p_bot_id: bot.id,
        p_amount: stake,
        p_type: 'stake',
        p_game_id: game.id
      })
    } catch {}

    // Ensure a game_players row exists with a stored board
    try {
      const { data: existing } = await supabase
        .from('game_players')
        .select('id')
        .eq('session_id', game.id)
        .eq('bot_id', bot.id)
        .maybeSingle()
      if (!existing) {
        await supabase.from('game_players').insert({
          id: crypto.randomUUID(),
          session_id: game.id,
          username: bot.name || 'Bot',
          socket_id: `bot_${bot.id}`,
          status: 'active',
          board: generateBingoCard(),
          score: 0,
          is_bot: true,
          bot_id: bot.id
        })
      }
    } catch (e) {
      console.warn('assignBotIfNeeded: failed to ensure game_players row for bot', bot.id, e)
    }

    return { updatedGame: updated, bot }
  } catch (e) {
    console.warn('assignBotIfNeeded exception:', e)
    return { updatedGame: game, bot: null }
  }
}
