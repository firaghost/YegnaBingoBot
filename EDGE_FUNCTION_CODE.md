# Supabase Edge Function Code

## Deploy this to: `super-handler`

Create a new Edge Function in Supabase Dashboard and paste this code:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Cryptographically secure random
function secureRandom(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Generate number sequence
function generateNumberSequence(): number[] {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1)
  return shuffleArray(numbers)
}

// Get bingo letter
function getBingoLetter(number: number): string {
  if (number <= 15) return 'B'
  if (number <= 30) return 'I'
  if (number <= 45) return 'N'
  if (number <= 60) return 'G'
  return 'O'
}

// Get next number
function getNextNumber(calledNumbers: number[], sequence: number[]): { letter: string; number: number } | null {
  for (const num of sequence) {
    if (!calledNumbers.includes(num)) {
      return {
        letter: getBingoLetter(num),
        number: num
      }
    }
  }
  return null
}

// Hash sequence for provable fairness
async function hashSequence(sequence: number[]): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(sequence.join(','))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Game loop
async function runGameLoop(gameId: string) {
  console.log(`🎮 Starting game loop for ${gameId}`)
  
  // Generate secure sequence
  const numberSequence = generateNumberSequence()
  const sequenceHash = await hashSequence(numberSequence)
  
  console.log(`🔒 Sequence hash: ${sequenceHash.substring(0, 16)}...`)
  
  // Store hash
  await supabase
    .from('games')
    .update({ number_sequence_hash: sequenceHash })
    .eq('id', gameId)
  
  // Countdown 10 to 0
  for (let i = 10; i >= 0; i--) {
    await supabase
      .from('games')
      .update({ countdown_time: i })
      .eq('id', gameId)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Start game
  const startTime = new Date().toISOString()
  await supabase
    .from('games')
    .update({ 
      status: 'active',
      started_at: startTime
    })
    .eq('id', gameId)
  
  console.log(`✅ Game ${gameId} started`)
  
  // Call numbers every 3 seconds
  let callCount = 0
  const maxCalls = 75
  
  while (callCount < maxCalls) {
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Get game state
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
    
    if (gameError || !game) {
      console.error(`❌ Error: ${gameError?.message}`)
      break
    }
    
    if (game.status !== 'active') {
      console.log(`🛑 Game ended: ${game.status}`)
      break
    }
    
    // Get next number
    const calledNumbers = game.called_numbers || []
    const nextNumber = getNextNumber(calledNumbers, numberSequence)
    
    if (!nextNumber) {
      console.log(`📢 All numbers called`)
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', gameId)
      break
    }
    
    const updatedNumbers = [...calledNumbers, nextNumber.number]
    
    // Atomic update
    const { error: updateError } = await supabase
      .from('games')
      .update({
        called_numbers: updatedNumbers,
        latest_number: nextNumber,
        last_call_time: new Date().toISOString()
      })
      .eq('id', gameId)
      .eq('status', 'active')
    
    if (updateError) {
      console.error(`❌ Update error: ${updateError.message}`)
      break
    }
    
    callCount++
    console.log(`📢 [${callCount}/75] ${nextNumber.letter}${nextNumber.number}`)
    
    // Safety timeout (10 minutes)
    const gameRunTime = Date.now() - new Date(startTime).getTime()
    if (gameRunTime > 10 * 60 * 1000) {
      console.log(`⏰ Timeout`)
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', gameId)
      break
    }
  }
  
  console.log(`🏁 Game loop ended`)
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const { action, gameId } = await req.json()
    
    if (action === 'start_game') {
      // Check game exists and is in countdown
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (!game) {
        return new Response(
          JSON.stringify({ error: 'Game not found' }),
          { 
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      if (game.status !== 'countdown') {
        return new Response(
          JSON.stringify({ 
            message: 'Game already started',
            status: game.status 
          }),
          { 
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Start game loop (non-blocking)
      runGameLoop(gameId).catch(console.error)
      
      return new Response(
        JSON.stringify({ success: true, message: 'Game starting...' }),
        { 
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
})
```

## How to Deploy:

1. Go to Supabase Dashboard → Edge Functions
2. Find or create function named `super-handler`
3. Paste the code above
4. Deploy

## Environment Variables (Already set):
- `SUPABASE_URL` - Automatically available
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically available

## Test:
```bash
curl -X POST https://mrayxghardqswonihwjs.supabase.co/functions/v1/super-handler \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action":"start_game","gameId":"test-game-id"}'
```

This Edge Function will:
- ✅ Run the countdown
- ✅ Call numbers every 3 seconds
- ✅ Use cryptographically secure randomness
- ✅ Store provably fair hash
- ✅ Handle game state properly
- ✅ Auto-end after 10 minutes or all numbers called
