import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { autofillBotsForGame } from '@/server/bot-service'

const ADMIN_SECRET = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret') || req.headers.get('x-cron-secret')
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const roomId = String(body.roomId || '').trim()
    const count = typeof body.count === 'number' ? Math.max(1, Math.floor(body.count)) : undefined
    const random = Boolean(body.random)

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // Load room for stake
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, stake, max_players, status')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Find or create a waiting game
    let { data: game } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'waiting_for_players', 'countdown'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!game) {
      const { data: newGame } = await supabaseAdmin
        .from('games')
        .insert({
          room_id: roomId,
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

    const players = game.players?.length || 0
    const bots = game.bots?.length || 0
    const maxAddable = Math.max(0, (room.max_players || 50) - players)

    let target = count ?? 1
    if (random) {
      const min = 1
      const max = Math.max(min, Math.min(maxAddable, (count || 5)))
      target = Math.floor(min + Math.random() * (max - min + 1))
    }
    target = Math.min(target, maxAddable)

    const { updatedGame } = await autofillBotsForGame(supabaseAdmin as any, game, Number(room.stake) || 0, bots + target)

    // If participants ≥ 2, mark waiting_for_players
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

    return NextResponse.json({
      success: true,
      roomId,
      gameId: updatedGame.id,
      players: updatedGame.players?.length || 0,
      bots: updatedGame.bots?.length || 0,
      prize_pool: updatedGame.prize_pool
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
