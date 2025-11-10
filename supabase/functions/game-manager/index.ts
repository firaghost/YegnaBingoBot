// Game Manager Edge Function
// Handles game countdown, number calling, and winner detection

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Generate random bingo number
function generateBingoNumber(calledNumbers: number[]): { letter: string; number: number } | null {
  const available = []
  for (let i = 1; i <= 75; i++) {
    if (!calledNumbers.includes(i)) {
      available.push(i)
    }
  }
  
  if (available.length === 0) return null
  
  const number = available[Math.floor(Math.random() * available.length)]
  const letter = number <= 15 ? 'B' : number <= 30 ? 'I' : number <= 45 ? 'N' : number <= 60 ? 'G' : 'O'
  
  return { letter, number }
}

// Start game countdown
async function startCountdown(gameId: string) {
  console.log(`Starting countdown for game ${gameId}`)
  
  for (let i = 10; i >= 0; i--) {
    await supabase
      .from('games')
      .update({ countdown_time: i })
      .eq('id', gameId)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Start the game
  await supabase
    .from('games')
    .update({ 
      status: 'active',
      started_at: new Date().toISOString()
    })
    .eq('id', gameId)
  
  console.log(`Game ${gameId} started!`)
  
  // Start calling numbers
  await callNumbers(gameId)
}

// Call bingo numbers
async function callNumbers(gameId: string) {
  console.log(`Calling numbers for game ${gameId}`)
  
  while (true) {
    // Get current game state
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
    
    if (!game || game.status !== 'active') {
      console.log(`Game ${gameId} ended or not active`)
      break
    }
    
    // Generate new number
    const newNumber = generateBingoNumber(game.called_numbers || [])
    
    if (!newNumber) {
      console.log(`All numbers called for game ${gameId}`)
      break
    }
    
    const updatedNumbers = [...(game.called_numbers || []), newNumber.number]
    
    // Update game with new number
    await supabase
      .from('games')
      .update({
        called_numbers: updatedNumbers,
        latest_number: newNumber
      })
      .eq('id', gameId)
    
    console.log(`Called ${newNumber.letter}${newNumber.number} for game ${gameId}`)
    
    // Wait 3 seconds before next number
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
}

serve(async (req) => {
  try {
    const { action, gameId } = await req.json()
    
    if (action === 'start_countdown') {
      // Start countdown in background
      startCountdown(gameId).catch(console.error)
      
      return new Response(
        JSON.stringify({ success: true, message: 'Countdown started' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
