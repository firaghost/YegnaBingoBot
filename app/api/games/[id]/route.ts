import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type BasicUser = { id: string; username: string | null }
type CardRow = { user_id: string; card: unknown; updated_at: string | null }

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id

    // Get game details
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*, rooms (id, name, stake, max_players)')
      .eq('id', gameId)
      .single()

    if (gameError) throw gameError

    // Winner info (optional)
    let winner: BasicUser | null = null
    const winnerId = String((game as any)?.winner_id || '').trim()
    if (winnerId) {
      const { data: wUser, error: wErr } = await supabaseAdmin
        .from('users')
        .select('id, username')
        .eq('id', winnerId)
        .maybeSingle()
      if (!wErr && wUser) winner = wUser as BasicUser
    }

    const playerIds = Array.isArray((game as any)?.players) ? ((game as any).players as string[]) : []
    const cardsPromise = supabaseAdmin
      .from('game_player_cards')
      .select('user_id, card, updated_at')
      .eq('game_id', gameId)

    const usersPromise = playerIds.length
      ? supabaseAdmin.from('users').select('id, username').in('id', playerIds)
      : Promise.resolve({ data: [] as any[], error: null as any })

    const [{ data: cards, error: cardsError }, { data: users, error: usersError }] = await Promise.all([
      cardsPromise,
      usersPromise as any,
    ])

    if (cardsError) throw cardsError
    if (usersError) throw usersError

    const userRows = (users || []) as BasicUser[]
    const userMap = new Map(userRows.map((u) => [String(u.id), u]))
    const cardRows = (cards || []) as CardRow[]
    const cardMap = new Map(cardRows.map((c) => [String(c.user_id), c]))
    const players = playerIds.map((id: string) => {
      const u = userMap.get(String(id))
      const c = cardMap.get(String(id))
      return {
        id,
        username: u?.username || '',
        card: c?.card || null,
        card_updated_at: c?.updated_at || null,
      }
    })

    return NextResponse.json({ game: { ...(game as any), winner }, players })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
