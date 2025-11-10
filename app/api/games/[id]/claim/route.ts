import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id
    const { userId, markedCells } = await request.json()

    if (!userId || !markedCells) {
      return NextResponse.json(
        { error: 'User ID and marked cells required' },
        { status: 400 }
      )
    }

    // TODO: Verify the win on server side
    // For now, we'll trust the client (in production, validate the win)

    // Call process_game_win function
    const { error } = await supabase.rpc('process_game_win', {
      p_game_id: gameId,
      p_winner_id: userId
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
