import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

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

// Start countdown and game with provably fair number calling
async function runGameLoop(gameId: string) {
  // Check if already running
  if (runningGames.has(gameId)) {
    console.log(`⚠️ Game loop already running for ${gameId}`)
    return
  }

  runningGames.add(gameId)
  console.log(`🎮 Starting game loop for ${gameId}`)
  
  try {
    // Generate cryptographically secure number sequence BEFORE game starts
    const numberSequence = generateNumberSequence()
    const sequenceHash = crypto.createHash('sha256').update(numberSequence.join(',')).digest('hex')
    
    console.log(`🔒 Number sequence hash: ${sequenceHash.substring(0, 16)}... (provably fair)`)
  
  // Countdown from 10 to 0
  for (let i = 10; i >= 0; i--) {
    await supabase
      .from('games')
      .update({ countdown_time: i })
      .eq('id', gameId)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Start the game
  const startTime = new Date().toISOString()
  await supabase
    .from('games')
    .update({ 
      status: 'active',
      started_at: startTime
    })
    .eq('id', gameId)
  
  console.log(`✅ Game ${gameId} started at ${startTime}`)
  
  // Call numbers every 3 seconds using pre-shuffled sequence
  let callCount = 0
  const maxCalls = 75 // Maximum possible calls
  
  while (callCount < maxCalls) {
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Get current game state
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
    
    if (gameError || !game) {
      console.error(`❌ Error fetching game ${gameId}:`, gameError)
      break
    }
    
    if (game.status !== 'active') {
      console.log(`🛑 Game ${gameId} ended with status: ${game.status}`)
      break
    }
    
    // Get next number from pre-shuffled sequence
    const calledNumbers = game.called_numbers || []
    const nextNumber = getNextNumber(calledNumbers, numberSequence)
    
    if (!nextNumber) {
      console.log(`📢 All numbers called for game ${gameId}`)
      // End game if no winner after all numbers
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
        latest_number: nextNumber
      })
      .eq('id', gameId)
      .eq('status', 'active') // Only update if still active
    
    if (updateError) {
      console.error(`❌ Error updating game ${gameId}:`, updateError)
      break
    }
    
    callCount++
    console.log(`📢 [${callCount}/75] Called ${nextNumber.letter}${nextNumber.number} for game ${gameId}`)
    
    // Safety check: if game has been running too long, end it
    const gameRunTime = Date.now() - new Date(startTime).getTime()
    if (gameRunTime > 10 * 60 * 1000) { // 10 minutes max
      console.log(`⏰ Game ${gameId} exceeded max runtime, ending...`)
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', gameId)
      break
    }
  }
  
  console.log(`🏁 Game loop ended for ${gameId}`)
  } finally {
    // Remove from running games set
    runningGames.delete(gameId)
  }
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
