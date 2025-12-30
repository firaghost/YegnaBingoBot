import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('games')
      .select(
        'id, room_id, status, created_at, started_at, stake, prize_pool, players, called_numbers, latest_number, winner_id, rooms (id, name, stake, max_players)'
      )
      .in('status', ['waiting', 'waiting_for_players', 'countdown', 'active'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ games: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load live games' }, { status: 500 })
  }
}
