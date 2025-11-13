import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { gameId, waitingTime = 30, countdownTime = 10 } = await request.json()

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 })
    }

    console.log(`⏳ Starting waiting period for game ${gameId}: ${waitingTime}s waiting + ${countdownTime}s countdown`)

    // Start the 30-second waiting period
    setTimeout(async () => {
      try {
        // After 30 seconds, start the 10-second countdown
        console.log(`🔥 Starting 10-second countdown for game ${gameId}`)
        
        await supabase
          .from('games')
          .update({ 
            status: 'countdown',
            countdown_time: countdownTime,
            countdown_started_at: new Date().toISOString()
          })
          .eq('id', gameId)

        // Start the actual countdown
        let timeLeft = countdownTime
        const countdownInterval = setInterval(async () => {
          timeLeft--
          
          if (timeLeft > 0) {
            // Update countdown time
            await supabase
              .from('games')
              .update({ countdown_time: timeLeft })
              .eq('id', gameId)
            
            console.log(`⏰ Game ${gameId} countdown: ${timeLeft}s`)
          } else {
            // Countdown finished, start the game
            clearInterval(countdownInterval)
            console.log(`🎮 Starting game ${gameId}`)
            
            await supabase
              .from('games')
              .update({ 
                status: 'active',
                countdown_time: 0,
                started_at: new Date().toISOString()
              })
              .eq('id', gameId)
          }
        }, 1000)

      } catch (error) {
        console.error('Error in countdown phase:', error)
      }
    }, waitingTime * 1000)

    // Update countdown time every second during waiting period
    let waitingTimeLeft = waitingTime
    const waitingInterval = setInterval(async () => {
      waitingTimeLeft--
      
      if (waitingTimeLeft > 0) {
        await supabase
          .from('games')
          .update({ countdown_time: waitingTimeLeft })
          .eq('id', gameId)
        
        console.log(`⏳ Game ${gameId} waiting: ${waitingTimeLeft}s`)
      } else {
        clearInterval(waitingInterval)
      }
    }, 1000)

    return NextResponse.json({
      success: true,
      message: `Started waiting period for game ${gameId}`,
      waitingTime,
      countdownTime
    })

  } catch (error) {
    console.error('Error starting waiting period:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
