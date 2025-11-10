import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { userId, roomId } = await request.json()

    if (!userId || !roomId) {
      return NextResponse.json(
        { error: 'User ID and Room ID required' },
        { status: 400 }
      )
    }

    // Call the join_game function
    const { data, error } = await supabase.rpc('join_game', {
      p_user_id: userId,
      p_room_id: roomId
    })

    if (error) throw error

    return NextResponse.json({ gameId: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
