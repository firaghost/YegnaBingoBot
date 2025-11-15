import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { autofillBotsForGame } from '@/server/bot-service'

// Secure with a simple header secret for cron/manual trigger
const CRON_SECRET = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret') || req.headers.get('x-admin-secret')
    if (!secret || secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1) Load desired default bots per room from admin_config
    let defaultBotsPerRoom = 3
    try {
      const { data } = await supabaseAdmin
        .from('admin_config')
        .select('config_value')
        .eq('config_key', 'default_bots_per_room')
        .eq('is_active', true)
        .maybeSingle()
      const raw = (data?.config_value as any)
      const n = typeof raw === 'string' ? parseInt(raw) : (typeof raw === 'number' ? raw : 3)
      if (Number.isFinite(n)) defaultBotsPerRoom = Math.max(0, Math.min(50, Math.floor(n)))
    } catch {}

    // 2) Fetch all active rooms
    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select('id, stake, max_players, status')
      .eq('status', 'active')

    if (roomsError) {
      return NextResponse.json({ error: roomsError.message }, { status: 500 })
    }

    const results: any[] = []

    // 3) For each room, ensure a waiting (or countdown) game exists and seed bots randomly
    for (const room of rooms || []) {
      // Find an existing waiting/countdown game
      let { data: game } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('room_id', room.id)
        .in('status', ['waiting', 'waiting_for_players', 'countdown'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // If none, create a new waiting game with zero players
      if (!game) {
        const { data: newGame } = await supabaseAdmin
          .from('games')
          .insert({
            room_id: room.id,
            status: 'waiting',
            countdown_time: 10,
            players: [],
            bots: [],
            called_numbers: [],
            stake: room.stake,
            prize_pool: 0,
            started_at: new Date().toISOString()
          })
          .select('*')
          .single()
        game = newGame!
      }

      // Decide a random target number of bots for this room
      const maxAddable = Math.max(0, (room.max_players || 50) - (game.players?.length || 0))
      const base = Math.max(1, defaultBotsPerRoom)
      const targetBots = Math.min(maxAddable, Math.max(1, Math.floor(base * (0.5 + Math.random()))))

      // Seed bots up to target
      const { updatedGame } = await autofillBotsForGame(supabaseAdmin as any, game, Number(room.stake) || 0, targetBots)

      // If participants ≥ 2, move to waiting_for_players
      const participants = (updatedGame.players?.length || 0) + (updatedGame.bots?.length || 0)
      if (participants >= 2 && updatedGame.status === 'waiting') {
        await supabaseAdmin
          .from('games')
          .update({
            status: 'waiting_for_players',
            countdown_time: 30,
            waiting_started_at: new Date().toISOString()
          })
          .eq('id', updatedGame.id)
      }

      results.push({ roomId: room.id, gameId: updatedGame.id, bots: updatedGame.bots?.length || 0, players: updatedGame.players?.length || 0 })
    }

    return NextResponse.json({ success: true, seeded: results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
