import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'active')
      .order('stake', { ascending: true })

    if (error) throw error

    // Get current player counts for each room
    const roomsWithPlayers = await Promise.all(
      (rooms || []).map(async (room: any) => {
        const { count } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .eq('status', 'active')

        return {
          ...room,
          current_players: count || 0
        }
      })
    )

    return NextResponse.json({ rooms: roomsWithPlayers })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
