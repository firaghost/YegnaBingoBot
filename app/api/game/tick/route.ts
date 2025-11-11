import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// Use admin client to bypass RLS in production
const supabase = supabaseAdmin

// Get bingo letter for number
function getBingoLetter(number: number): string {
  if (number <= 15) return 'B'
  if (number <= 30) return 'I'
  if (number <= 45) return 'N'
  if (number <= 60) return 'G'
  return 'O'
}

// Cryptographically secure random number generator
function secureRandom(max: number): number {
  const randomBytes = crypto.randomBytes(4)
  const randomNumber = randomBytes.readUInt32BE(0)
  return randomNumber % max
}

// Fisher-Yates shuffle for fair number distribution
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Generate pre-shuffled number sequence for complete fairness
function generateNumberSequence(): number[] {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1)
  return shuffleArray(numbers)
}

/**
 * Game tick endpoint - advances game state by one step
 * This is called repeatedly by the client to progress the game
 * Works around Vercel's 10-second serverless timeout
 */
export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json()

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 })
    }

    // Get current game state
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Handle countdown phase
    if (game.status === 'countdown') {
      const currentTime = game.countdown_time || 10
      
      if (currentTime > 1) {
        // Decrement countdown (but not below 1)
        const newTime = currentTime - 1
        await supabase
          .from('games')
          .update({ countdown_time: newTime })
          .eq('id', gameId)
          .eq('status', 'countdown')
        
        console.log(`⏰ Countdown: ${newTime}s for game ${gameId}`)
        
        return NextResponse.json({
          success: true,
          action: 'countdown',
          countdown_time: newTime,
          message: `Countdown: ${newTime}`
        })
      } else {
        // currentTime is 1 or 0, start the game
        console.log(`🎬 Starting game ${gameId}...`)
        
        const numberSequence = generateNumberSequence()
        const sequenceHash = crypto.createHash('sha256')
          .update(numberSequence.join(','))
          .digest('hex')
        
        const { error: updateError } = await supabase
          .from('games')
          .update({
            status: 'active',
            countdown_time: 0,
            started_at: new Date().toISOString(),
            number_sequence: numberSequence,
            number_sequence_hash: sequenceHash
          })
          .eq('id', gameId)
          .eq('status', 'countdown')
        
        if (updateError) {
          console.error('Error starting game:', updateError)
          throw updateError
        }
        
        console.log(`✅ Game ${gameId} started with hash: ${sequenceHash.substring(0, 16)}...`)
        
        return NextResponse.json({
          success: true,
          action: 'start',
          message: 'Game started!',
          sequence_hash: sequenceHash
        })
      }
    }

    // Handle active game phase - call next number
    if (game.status === 'active') {
      const calledNumbers = game.called_numbers || []
      const numberSequence = game.number_sequence || generateNumberSequence()
      
      // Check if game has a winner (stop calling numbers)
      if (game.winner_id) {
        console.log(`🏆 Game ${gameId} has a winner, stopping number calls`)
        return NextResponse.json({
          success: true,
          action: 'end',
          message: 'Game has a winner'
        })
      }
      
      // Find next uncalled number from sequence
      let nextNumber: number | null = null
      for (const num of numberSequence) {
        if (!calledNumbers.includes(num)) {
          nextNumber = num
          break
        }
      }
      
      if (!nextNumber) {
        // All numbers called, end game
        await supabase
          .from('games')
          .update({ status: 'finished', ended_at: new Date().toISOString() })
          .eq('id', gameId)
          .eq('status', 'active')
        
        return NextResponse.json({
          success: true,
          action: 'end',
          message: 'All numbers called, game ended'
        })
      }
      
      // Call the next number (with race condition protection)
      const updatedNumbers = [...calledNumbers, nextNumber]
      const latestNumber = {
        letter: getBingoLetter(nextNumber),
        number: nextNumber
      }
      
      // Use atomic update to prevent duplicate calls
      const { data: updatedGame, error: updateError } = await supabase
        .from('games')
        .update({
          called_numbers: updatedNumbers,
          latest_number: latestNumber
        })
        .eq('id', gameId)
        .eq('status', 'active')
        .is('winner_id', null) // Only update if no winner yet
        .select('called_numbers')
        .single()
      
      if (updateError || !updatedGame) {
        // Another tick already updated, skip this one
        console.log(`⚠️ Race condition detected for game ${gameId}, skipping tick`)
        return NextResponse.json({
          success: true,
          action: 'skip',
          message: 'Another tick in progress'
        })
      }
      
      // Verify the number was actually added (race condition check)
      if (updatedGame.called_numbers.length !== updatedNumbers.length) {
        console.log(`⚠️ Number already called for game ${gameId}`)
        return NextResponse.json({
          success: true,
          action: 'skip',
          message: 'Number already called'
        })
      }
      
      console.log(`📢 [${updatedNumbers.length}/75] Called ${latestNumber.letter}${latestNumber.number} for game ${gameId}`)
      
      return NextResponse.json({
        success: true,
        action: 'call_number',
        latest_number: latestNumber,
        total_called: updatedNumbers.length,
        message: `Called ${latestNumber.letter}${latestNumber.number}`
      })
    }

    // Game is finished or in another state
    return NextResponse.json({
      success: true,
      action: 'none',
      status: game.status,
      message: `Game is ${game.status}`
    })

  } catch (error) {
    console.error('Error in game tick:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
