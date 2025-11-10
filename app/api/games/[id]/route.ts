import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id

    // Get game details
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError) throw gameError

    // Get players in game
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('*, users(username)')
      .eq('game_id', gameId)

    if (playersError) throw playersError

    return NextResponse.json({ game, players })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
