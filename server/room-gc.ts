// [ADDED FOR CAPACITY FIX]
// Room Garbage Collector: cleans empty/dead/abandoned rooms & games, kills stuck timers,
// and restores system health automatically. Designed to be safe and idempotent.

import { setTimeout as sleep } from 'timers/promises'

export function startRoomGC() {
  const INTERVAL_MS = (parseInt(process.env.ROOM_GC_INTERVAL_MS || '120000', 10) || 120000)
  const BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || ''

  // Run on boot and at interval
  runOnce().catch(() => {})
  setInterval(() => { runOnce().catch(() => {}) }, INTERVAL_MS)

  async function runOnce() {
    try {
      const { supabaseAdmin } = await import('../lib/supabase')
      const supabase = supabaseAdmin

      // 1) Remove empty waiting rooms older than 10 minutes
      try {
        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id, status')
          .eq('status', 'waiting')
          .lte('created_at', cutoff)
          .lte('active_player_count', 0)

        if (rooms && rooms.length > 0) {
          const ids = rooms.map(r => r.id)
          await supabase.from('rooms').update({ status: 'finished' }).in('id', ids)
          console.log(`🧹 [GC] Marked ${ids.length} empty waiting rooms as finished`)
        }
      } catch (e) { console.warn('[GC] rooms cleanup warning:', e) }

      // 2) Stop active games that have no players (abandoned) for 2+ minutes
      try {
        const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        const { data: games } = await supabase
          .from('games')
          .select('id, players')
          .eq('status', 'active')
          .lte('updated_at', cutoff)

        const abandoned = (games || []).filter(g => (g.players?.length || 0) === 0)
        for (const g of abandoned) {
          await supabase.from('games').update({ status: 'finished', ended_at: new Date().toISOString() }).eq('id', g.id)
          if (BASE_URL) {
            // best-effort stop number calling
            fetch(`${BASE_URL}/api/game/stop-calling`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: g.id }) }).catch(() => {})
          }
        }
        if (abandoned.length) console.log(`🧹 [GC] Stopped ${abandoned.length} abandoned games`)
      } catch (e) { console.warn('[GC] abandoned games warning:', e) }

      // 3) Kill stuck countdown/waiting games older than 15 minutes
      try {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
        const { data: stuck } = await supabase
          .from('games')
          .select('id')
          .in('status', ['waiting', 'waiting_for_players', 'countdown'])
          .lte('created_at', cutoff)
        for (const g of (stuck || [])) {
          await supabase.from('games').update({ status: 'cancelled', ended_at: new Date().toISOString() }).eq('id', g.id)
        }
        if ((stuck || []).length) console.log(`🧹 [GC] Cancelled ${stuck?.length} stuck games`)
      } catch (e) { console.warn('[GC] stuck games warning:', e) }

      // 4) Nudge cache sync occasionally for active games
      try {
        const { data: active } = await supabase
          .from('games')
          .select('id')
          .eq('status', 'active')
          .limit(10)
        if (BASE_URL && active && active.length) {
          for (const g of active) {
            fetch(`${BASE_URL}/api/cache/force-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: g.id }) }).catch(() => {})
            await sleep(50)
          }
        }
      } catch (e) { /* optional */ }

    } catch (e) {
      console.warn('[GC] run error:', e)
    }
  }
}
