import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// Use admin client to bypass RLS in production
const supabase = supabaseAdmin

// Track running game loops to prevent duplicates
const runningGames = new Set<string>()

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

// Get bingo letter for number
function getBingoLetter(number: number): string {
  if (number <= 15) return 'B'
  if (number <= 30) return 'I'
  if (number <= 45) return 'N'
  if (number <= 60) return 'G'
  return 'O'
}

// Get next number from pre-shuffled sequence
function getNextNumber(calledNumbers: number[], sequence: number[]): { letter: string; number: number } | null {
  // Find first number in sequence that hasn't been called
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

/**
 * DEPRECATED: Old game loop - replaced with tick-based system
 * This function is kept for backward compatibility but should not be used
 * The new system uses /api/game/tick which is called repeatedly by clients
 * This avoids Vercel's 10-second serverless timeout limitation
 */
async function runGameLoop(gameId: string) {
  console.log(`⚠️ Old game loop called for ${gameId} - this is deprecated`)
  console.log(`💡 Use the new tick-based system at /api/game/tick instead`)
  
  // Just ensure the game is in countdown status
  // The client will handle the rest via tick API
  await supabase
    .from('games')
    .update({ 
      countdown_time: 10,
      status: 'countdown'
    })
    .eq('id', gameId)
}

export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json()

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 })
    }

    // Check if game exists and is in countdown
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    if (game.status !== 'countdown') {
      console.log(`⚠️ Game ${gameId} is not in countdown status: ${game.status}`)
      return NextResponse.json({ 
        message: 'Game already started or finished',
        status: game.status 
      })
    }

    console.log(`🚀 Starting game loop for ${gameId}`)

    // Start game loop in background (don't await)
    runGameLoop(gameId).catch(error => {
      console.error('Error in game loop:', error)
    })

    return NextResponse.json({ 
      success: true,
      message: 'Game starting...'
    })
  } catch (error) {
    console.error('Error starting game:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
