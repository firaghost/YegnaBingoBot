import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(req: NextRequest) {
  try {
    const { gameId } = await req.json()
    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('games')
      .select('winner_card,winner_pattern')
      .eq('id', gameId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      winner_card: data.winner_card || null,
      winner_pattern: data.winner_pattern || null
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
