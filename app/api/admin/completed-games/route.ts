import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('games')
      .select(
        'id, room_id, status, created_at, started_at, ended_at, stake, prize_pool, players, called_numbers, latest_number, winner_id, winner_pattern, winner_card, rooms (id, name, stake, max_players), winner:users!games_winner_id_fkey (id, username)'
      )
      .in('status', ['finished', 'cancelled'])
      .order('ended_at', { ascending: false })
      .limit(40)

    if (error) throw error

    return NextResponse.json({ games: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load completed games' }, { status: 500 })
  }
}
