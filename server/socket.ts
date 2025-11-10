import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { supabase } from '../lib/supabase.js'

export function initializeSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  })

  // Store active games and their intervals
  const activeGames = new Map<string, NodeJS.Timeout>()

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Join a game room
    socket.on('join-game', async ({ gameId, userId }) => {
      try {
        socket.join(`game:${gameId}`)
        console.log(`User ${userId} joined game ${gameId}`)

        // Get current game state
        const { data: game } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()

        if (game) {
          socket.emit('game-state', game)
        }

        // Notify other players
        socket.to(`game:${gameId}`).emit('player-joined', { userId })

        // Start game if not already started
        if (game?.status === 'waiting' && !activeGames.has(gameId)) {
          startGameCountdown(gameId, io)
        }
      } catch (error) {
        console.error('Error joining game:', error)
        socket.emit('error', { message: 'Failed to join game' })
      }
    })

    // Leave a game room
    socket.on('leave-game', async ({ gameId, userId }) => {
      try {
        socket.leave(`game:${gameId}`)
        console.log(`User ${userId} left game ${gameId}`)

        // Update database
        await supabase
          .from('game_players')
          .update({ has_left: true, left_at: new Date().toISOString() })
          .eq('game_id', gameId)
          .eq('user_id', userId)

        // Notify other players
        socket.to(`game:${gameId}`).emit('player-left', { userId })
      } catch (error) {
        console.error('Error leaving game:', error)
      }
    })

    // Mark a number on the card
    socket.on('mark-number', async ({ gameId, userId, number, markedCells }) => {
      try {
        // Update player's marked numbers
        await supabase
          .from('game_players')
          .update({ marked_numbers: markedCells })
          .eq('game_id', gameId)
          .eq('user_id', userId)

        // Notify the player
        socket.emit('number-marked', { number, markedCells })
      } catch (error) {
        console.error('Error marking number:', error)
      }
    })

    // Claim bingo win
    socket.on('claim-bingo', async ({ gameId, userId, markedCells }) => {
      try {
        // Verify the win server-side
        const isValidWin = verifyBingoWin(markedCells)

        if (!isValidWin) {
          socket.emit('invalid-claim', { message: 'Invalid bingo claim' })
          return
        }

        // Process the win
        const { error } = await supabase.rpc('process_game_win', {
          p_game_id: gameId,
          p_winner_id: userId
        })

        if (error) throw error

        // Stop the game
        if (activeGames.has(gameId)) {
          clearInterval(activeGames.get(gameId)!)
          activeGames.delete(gameId)
        }

        // Get winner info
        const { data: user } = await supabase
          .from('users')
          .select('username')
          .eq('id', userId)
          .single()

        // Notify all players
        io.to(`game:${gameId}`).emit('game-ended', {
          winnerId: userId,
          winnerName: user?.username,
          status: 'completed'
        })
      } catch (error) {
        console.error('Error claiming bingo:', error)
        socket.emit('error', { message: 'Failed to claim bingo' })
      }
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  // Start game countdown
  async function startGameCountdown(gameId: string, io: SocketIOServer) {
    try {
      // Update game status
      await supabase
        .from('games')
        .update({ status: 'countdown', countdown_time: 10 })
        .eq('id', gameId)

      let countdown = 10

      const countdownInterval = setInterval(async () => {
        countdown--

        // Update database
        await supabase
          .from('games')
          .update({ countdown_time: countdown })
          .eq('id', gameId)

        // Emit countdown update
        io.to(`game:${gameId}`).emit('countdown-update', { countdown })

        if (countdown <= 0) {
          clearInterval(countdownInterval)
          startGame(gameId, io)
        }
      }, 1000)

      activeGames.set(gameId, countdownInterval)
    } catch (error) {
      console.error('Error starting countdown:', error)
    }
  }

  // Start the actual game
  async function startGame(gameId: string, io: SocketIOServer) {
    try {
      // Update game status
      await supabase
        .from('games')
        .update({ 
          status: 'active', 
          started_at: new Date().toISOString(),
          called_numbers: []
        })
        .eq('id', gameId)

      // Emit game started
      io.to(`game:${gameId}`).emit('game-started')

      // Start calling numbers
      const calledNumbers: number[] = []
      
      const gameInterval = setInterval(async () => {
        // Generate random number not yet called
        let number: number
        do {
          number = Math.floor(Math.random() * 75) + 1
        } while (calledNumbers.includes(number))

        calledNumbers.push(number)

        // Determine letter
        const letter = getLetterForNumber(number)

        // Update database
        await supabase
          .from('games')
          .update({ 
            called_numbers: calledNumbers,
            latest_number: { letter, number }
          })
          .eq('id', gameId)

        // Emit to all players
        io.to(`game:${gameId}`).emit('number-called', { letter, number, calledNumbers })

        // Check if all numbers called
        if (calledNumbers.length >= 75) {
          clearInterval(gameInterval)
          activeGames.delete(gameId)
          
          // End game with no winner
          await supabase
            .from('games')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .eq('id', gameId)

          io.to(`game:${gameId}`).emit('game-ended', { status: 'completed' })
        }
      }, 3000) // Call number every 3 seconds

      activeGames.set(gameId, gameInterval)
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  // Helper function to get letter for number
  function getLetterForNumber(num: number): string {
    if (num <= 15) return 'B'
    if (num <= 30) return 'I'
    if (num <= 45) return 'N'
    if (num <= 60) return 'G'
    return 'O'
  }

  // Verify bingo win
  function verifyBingoWin(markedCells: boolean[][]): boolean {
    // Check rows
    for (let row = 0; row < 5; row++) {
      if (markedCells[row].every(cell => cell)) return true
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      if (markedCells.every(row => row[col])) return true
    }

    // Check diagonals
    if (markedCells[0][0] && markedCells[1][1] && markedCells[2][2] && markedCells[3][3] && markedCells[4][4]) return true
    if (markedCells[0][4] && markedCells[1][3] && markedCells[2][2] && markedCells[3][1] && markedCells[4][0]) return true

    return false
  }

  return io
}
