import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { gameId, userId, card } = await request.json()

    if (!gameId || !userId || !card) {
      return NextResponse.json({ error: 'Missing required fields: gameId, userId, card' }, { status: 400 })
    }

    const { error } = await supabase
      .from('game_player_cards')
      .upsert(
        {
          game_id: gameId,
          user_id: userId,
          card,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'game_id,user_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
