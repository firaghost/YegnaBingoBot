// @ts-ignore: Deno types
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { gameId, userId, card } = await req.json()

    // Create Supabase client
    // @ts-ignore: Deno types
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch game data
    const { data: game, error: gameError } = await supabaseClient
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if game is still active
    if (game.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Game is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify bingo
    const isValid = verifyBingo(card, game.called_numbers)

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid bingo claim' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update game status
    await supabaseClient
      .from('games')
      .update({
        status: 'finished',
        winner_id: userId,
        ended_at: new Date().toISOString()
      })
      .eq('id', gameId)

    // Update winner's balance
    await supabaseClient.rpc('add_balance', {
      user_id: userId,
      amount: game.prize_pool
    })

    // Update user stats
    await supabaseClient.rpc('update_user_stats', {
      user_id: userId,
      won: true,
      winnings: game.prize_pool
    })

    // Create transaction
    await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'win',
        amount: game.prize_pool,
        game_id: gameId,
        status: 'completed',
        description: `Won game ${gameId}`
      })

    return new Response(
      JSON.stringify({
        success: true,
        prize: game.prize_pool,
        message: 'Bingo verified and prize awarded!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to verify bingo
function verifyBingo(card: number[][], calledNumbers: number[]): boolean {
  // Convert card to marked cells based on called numbers
  const marked: boolean[][] = []
  for (let i = 0; i < 5; i++) {
    marked[i] = []
    for (let j = 0; j < 5; j++) {
      // Free space (center) or called number
      marked[i][j] = (i === 2 && j === 2) || calledNumbers.includes(card[i][j])
    }
  }

  // Check rows
  for (let row of marked) {
    if (row.every(cell => cell)) return true
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (marked.every(row => row[col])) return true
  }

  // Check diagonals
  if (marked.every((row, i) => row[i])) return true
  if (marked.every((row, i) => row[4 - i])) return true

  return false
}
