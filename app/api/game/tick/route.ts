import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// Use admin client to bypass RLS in production
const supabase = supabaseAdmin

// Game type definition
interface Game {
  id: string
  room_id: string
  status: 'waiting' | 'waiting_for_players' | 'countdown' | 'active' | 'finished'
  countdown_time: number
  players: string[]
  bots: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  stake: number
  prize_pool: number
  winner_id: string | null
  min_players: number
  number_sequence?: number[]
  number_sequence_hash?: string
  started_at?: string
  ended_at?: string
  created_at: string
  commission_rate?: number
  commission_amount?: number
  net_prize?: number
}

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

    // CRITICAL: Use FOR UPDATE lock to prevent race conditions
    // This ensures only ONE tick can process at a time
    const { data: game, error: gameError } = await supabase
      .rpc('get_game_for_update', { game_id: gameId })
      .single() as { data: Game | null; error: any }

    if (gameError || !game) {
      // Game not found or locked by another tick
      return NextResponse.json({
        success: true,
        action: 'skip',
        message: 'Game locked or not found'
      })
    }

    // Type assertion for safety
    const typedGame = game as Game

    // ============================================================
    // UNIFIED STATE MACHINE - All transitions handled here
    // ============================================================

    // Handle waiting_for_players phase (30-second wait for more players)
    if (game.status === 'waiting_for_players') {
      const currentPlayers = game.players?.length || 0

      // If not enough players, reset to waiting
      if (currentPlayers < 2) {
        console.log(`⚠️ Game ${gameId}: Not enough players (${currentPlayers}), resetting to waiting`)
        await supabase
          .from('games')
          .update({
            status: 'waiting',
            countdown_time: 0,
            waiting_started_at: null
          })
          .eq('id', gameId)

        return NextResponse.json({
          success: true,
          action: 'reset',
          message: 'Waiting for more players'
        })
      }

      const waitingTime = game.countdown_time || 30

      if (waitingTime > 1) {
        // Decrement waiting countdown
        const newTime = waitingTime - 1
        await supabase
          .from('games')
          .update({ countdown_time: newTime })
          .eq('id', gameId)
          .eq('status', 'waiting_for_players')

        console.log(`⏳ Waiting: ${newTime}s remaining for game ${gameId}`)

        return NextResponse.json({
          success: true,
          action: 'waiting',
          countdown_time: newTime,
          message: `Waiting for players: ${newTime}s`
        })
      } else {
        // Waiting period complete - transition to countdown
        console.log(`🔥 Game ${gameId}: Waiting complete, starting countdown`)

        await supabase
          .from('games')
          .update({
            status: 'countdown',
            countdown_time: 10,
            countdown_started_at: new Date().toISOString()
          })
          .eq('id', gameId)
          .eq('status', 'waiting_for_players')

        return NextResponse.json({
          success: true,
          action: 'countdown_start',
          countdown_time: 10,
          message: 'Game countdown starting!'
        })
      }
    }

    // Handle countdown phase (10-second countdown before game starts)
    if (game.status === 'countdown') {
      // Validate player count during countdown
      const currentPlayers = game.players?.length || 0
      if (currentPlayers < 2) {
        console.log(`⚠️ Game ${gameId}: Player left during countdown, resetting to waiting`)
        await supabase
          .from('games')
          .update({
            status: 'waiting',
            countdown_time: 0,
            waiting_started_at: null
          })
          .eq('id', gameId)

        return NextResponse.json({
          success: true,
          action: 'reset',
          message: 'Player left, waiting for more players'
        })
      }

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
        // All 75 numbers called - finish game immediately
        // No setTimeout needed - bingo claims are idempotent and work even on finished games
        // as long as the claim is made before winner_id is set
        console.log(`🏁 Game ${gameId} - all 75 numbers called, finishing game`)

        const { error: finishError } = await supabase
          .from('games')
          .update({
            status: 'finished',
            ended_at: new Date().toISOString(),
            winner_id: null
          })
          .eq('id', gameId)
          .eq('status', 'active')
          .is('winner_id', null)  // Only finish if no winner yet

        if (finishError) {
          console.log(`✅ Game ${gameId} already finished or has winner`)
        } else {
          console.log(`🏁 Game ${gameId} finished - NO WINNER (all 75 numbers called)`)
        }

        return NextResponse.json({
          success: true,
          action: 'end',
          message: 'Game finished - all numbers called, no winner'
        })
      }

      // --- PATCHED SECTION for Atomic Race Handling ---
      // Call the next number (with race condition protection)
      const updatedNumbers = [...calledNumbers, nextNumber]
      const latestNumber = {
        letter: getBingoLetter(nextNumber),
        number: nextNumber
      }

      // Use atomic update with proper locking to prevent duplicate calls
      // First, acquire a lock on the game row
      const { data: lockedGame, error: lockError } = await supabase
        .rpc('get_game_for_update', { game_id: gameId })

      if (lockError || !lockedGame) {
        // Game is locked by another process, skip this tick
        console.log(`⚠️ Game ${gameId} is locked by another process, skipping tick`)
        return NextResponse.json({
          success: true,
          action: 'skip',
          message: 'Game locked by another process'
        })
      }

      // Double-check that the number hasn't been called while we waited for the lock
      const currentCalledNumbers = lockedGame.called_numbers || []
      if (currentCalledNumbers.includes(nextNumber)) {
        console.log(`⚠️ Number ${nextNumber} already called for game ${gameId} (detected after lock)`)
        return NextResponse.json({
          success: true,
          action: 'skip',
          message: 'Number already called'
        })
      }

      // Verify game is still active and has no winner
      if (lockedGame.status !== 'active' || lockedGame.winner_id) {
        console.log(`⚠️ Game ${gameId} is no longer active or has a winner, skipping tick`)
        return NextResponse.json({
          success: true,
          action: 'skip',
          message: 'Game no longer active'
        })
      }

      // Perform the update with strict conditions
      const { data: updatedGame, error: updateError } = await supabase
        .from('games')
        .update({
          called_numbers: updatedNumbers,
          latest_number: latestNumber
        })
        .eq('id', gameId)
        .eq('status', 'active')
        .is('winner_id', null) // Only update if no winner yet
        .select('called_numbers, latest_number')
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
      // --- END PATCHED SECTION ---

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