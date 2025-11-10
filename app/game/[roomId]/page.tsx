"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSocket } from '@/lib/hooks/useSocket'
import { supabase } from '@/lib/supabase'
import { generateBingoCard, checkBingoWin, formatCurrency } from '@/lib/utils'

type GameStatus = 'countdown' | 'waiting' | 'active' | 'finished'

interface CalledNumber {
  letter: string
  number: number
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params?.roomId as string
  const { user, isAuthenticated } = useAuth()
  const { connected, gameState, joinGame, leaveGame, markNumber, claimBingo } = useSocket()

  const [gameId, setGameId] = useState<string | null>(null)
  const [roomData, setRoomData] = useState<any>(null)
  const [playerState, setPlayerState] = useState<'playing' | 'queue' | 'spectator'>('playing')
  const [bingoCard, setBingoCard] = useState<number[][]>([])
  const [markedCells, setMarkedCells] = useState<boolean[][]>([])
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showWinDialog, setShowWinDialog] = useState(false)
  const [showLoseDialog, setShowLoseDialog] = useState(false)
  const [winAmount, setWinAmount] = useState(0)
  const [winnerName, setWinnerName] = useState('')
  const [redirectCountdown, setRedirectCountdown] = useState(5)
  const [findingNewGame, setFindingNewGame] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  // Fetch room data and join/create game
  useEffect(() => {
    if (!user || !roomId) return

    const initializeGame = async () => {
      try {
        // Fetch room data
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (roomError) throw roomError
        setRoomData(room)

        // Check if user has sufficient balance
        if (user.balance < room.stake) {
          alert('Insufficient balance!')
          router.push('/lobby')
          return
        }

        // Find or create active game for this room
        let { data: activeGame } = await supabase
          .from('games')
          .select('*')
          .eq('room_id', roomId)
          .in('status', ['countdown', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!activeGame) {
          // Create new game
          const { data: newGame, error: createError } = await supabase
            .from('games')
            .insert({
              room_id: roomId,
              status: 'countdown',
              countdown_time: 10,
              players: [user.id],
              bots: [],
              called_numbers: [],
              stake: room.stake,
              prize_pool: room.stake,
              started_at: new Date().toISOString()
            })
            .select()
            .single()

          if (createError) throw createError
          activeGame = newGame
        } else {
          // Join existing game
          if (!activeGame.players.includes(user.id)) {
            const { error: joinError } = await supabase
              .from('games')
              .update({
                players: [...activeGame.players, user.id],
                prize_pool: activeGame.prize_pool + room.stake
              })
              .eq('id', activeGame.id)

            if (joinError) throw joinError
          }
        }

        setGameId(activeGame.id)

        // Deduct stake from user balance
        await supabase.rpc('deduct_balance', {
          user_id: user.id,
          amount: room.stake
        })

        // Create transaction record
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'stake',
          amount: -room.stake,
          game_id: activeGame.id,
          status: 'completed'
        })

        // Generate bingo card
        const card = generateBingoCard()
        setBingoCard(card)
        
        const marked: boolean[][] = []
        for (let i = 0; i < 5; i++) {
          marked[i] = []
          for (let j = 0; j < 5; j++) {
            marked[i][j] = (i === 2 && j === 2) // Free space
          }
        }
        setMarkedCells(marked)

        // Save card to database
        await supabase.from('player_cards').insert({
          game_id: activeGame.id,
          user_id: user.id,
          card: card
        })

        // Join socket room
        joinGame(activeGame.id, user.id)

      } catch (error) {
        console.error('Error initializing game:', error)
        alert('Failed to join game')
        router.push('/lobby')
      } finally {
        setLoading(false)
      }
    }

    initializeGame()

    return () => {
      if (gameId && user) {
        leaveGame(gameId, user.id)
      }
    }
  }, [user, roomId, router, joinGame, leaveGame])

  // Handle game state updates from Socket.IO
  useEffect(() => {
    if (!gameState) return

    // Check if game finished
    if (gameState.status === 'finished') {
      if (gameState.winner_id === user?.id) {
        // User won
        setWinAmount(gameState.prize_pool)
        setShowWinDialog(true)
      } else {
        // User lost
        setWinAmount(gameState.prize_pool)
        setShowLoseDialog(true)
        
        // Fetch winner name
        if (gameState.winner_id) {
          supabase
            .from('users')
            .select('username')
            .eq('id', gameState.winner_id)
            .single()
            .then(({ data }) => {
              if (data) setWinnerName(data.username)
            })
        }
      }
    }
  }, [gameState, user])

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (!gameState || gameState.status !== 'active') return
    if (!gameId || !user) return
    
    const num = bingoCard[row][col]
    if (num === 0) return
    if (!gameState.called_numbers.includes(num)) return

    const newMarked = markedCells.map(r => [...r])
    newMarked[row][col] = !newMarked[row][col]
    setMarkedCells(newMarked)

    // Emit mark event to server
    markNumber(gameId, user.id, num)

    // Check for win
    if (checkBingoWin(newMarked)) {
      claimBingo(gameId, user.id, bingoCard)
    }
  }

  // Auto-redirect countdown after losing
  useEffect(() => {
    if (showLoseDialog && !findingNewGame) {
      const interval = setInterval(() => {
        setRedirectCountdown(prev => {
          if (prev <= 1) {
            window.location.href = '/lobby'
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [showLoseDialog, findingNewGame])

  const handleFindNewGame = () => {
    setFindingNewGame(true)
    // Reload the page to join a new game
    setTimeout(() => {
      window.location.href = `/game/${roomId}`
    }, 1500)
  }

  const getRoomName = () => {
    return roomData?.name || 'Bingo Room'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Joining game...</p>
        </div>
      </div>
    )
  }

  if (!gameState || !roomData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  const gameStatus = gameState.status
  const countdownTime = gameState.countdown_time
  const calledNumbers = gameState.called_numbers
  const latestNumber = gameState.latest_number
  const players = gameState.players.length
  const prizePool = gameState.prize_pool
  const stake = roomData.stake

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/lobby" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
            ← Back to Lobby
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{getRoomName()}</h1>
          <button 
            onClick={() => setShowLeaveDialog(true)}
            className="text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Leave Game
          </button>
        </div>

        {/* Countdown State */}
        {gameStatus === 'countdown' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="text-4xl animate-pulse">⏰</div>
                <h2 className="text-3xl font-bold text-gray-800">Game Starting In</h2>
              </div>
              <div className="text-8xl font-bold text-blue-600 mb-6 animate-pulse">
                {countdownTime}s
              </div>
              <p className="text-gray-600 text-lg">
                Get ready! The game is about to begin...
              </p>
            </div>
          </div>
        )}

        {/* Queue State */}
        {playerState === 'queue' && gameStatus === 'active' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-xl p-12 text-center border-2 border-blue-200">
              <div className="text-6xl mb-6">⏳</div>
              <h2 className="text-3xl font-bold text-blue-800 mb-4">You're in the queue!</h2>
              <p className="text-lg text-gray-700 mb-6">
                You'll join the next game when this one ends
              </p>
              <div className="bg-white rounded-lg p-6 mb-6">
                <h3 className="font-bold text-gray-800 mb-3">What happens next?</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  🎮 New game will start when current game ends<br/>
                  📝 Cards will be generated before the next round starts
                </p>
              </div>
              <div className="text-sm text-gray-500">
                Your stake: {formatCurrency(stake)} • Room: {getRoomName()}
              </div>
            </div>
          </div>
        )}

        {/* Spectator Mode */}
        {playerState === 'spectator' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-6xl mb-6">👀</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Spectator Mode</h2>
              <p className="text-lg text-gray-600">
                Waiting for game to start...
              </p>
            </div>
          </div>
        )}

        {/* Active Game */}
        {gameStatus === 'active' && playerState === 'playing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Game Info */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Status:</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Players:</span>
                    <span className="font-bold text-lg">{players}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Prize Pool:</span>
                    <span className="font-bold text-lg text-green-600">{formatCurrency(prizePool)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Progress:</span>
                    <span className="font-bold text-lg text-blue-600">{calledNumbers.length}/75</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Your Stake:</span>
                    <span className="font-bold text-lg">{formatCurrency(stake)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <h3 className="font-bold text-lg mb-4">Latest Number Called</h3>
                {latestNumber ? (
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">{latestNumber.letter}</div>
                    <div className="w-24 h-24 mx-auto rounded-full bg-white text-blue-600 flex items-center justify-center text-4xl font-bold shadow-xl animate-pulse">
                      {latestNumber.number}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-white/80">Calling...</div>
                )}
              </div>
            </div>

            {/* Center - Bingo Card */}
            <div>
              <div className="bg-white rounded-xl shadow-2xl p-6">
                <h3 className="text-center font-bold text-2xl mb-4 text-gray-800">Your Bingo Card</h3>
                
                {/* B-I-N-G-O Headers */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {['B', 'I', 'N', 'G', 'O'].map(letter => (
                    <div key={letter} className="text-center font-bold text-3xl text-blue-600">
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Bingo Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {bingoCard.map((row, ri) =>
                    row.map((num, ci) => {
                      const isMarked = markedCells[ri][ci]
                      const isCalled = calledNumbers.includes(num) && num !== 0
                      const isFree = num === 0

                      return (
                        <button
                          key={`${ri}-${ci}`}
                          onClick={() => handleCellClick(ri, ci)}
                          disabled={!isCalled && !isFree}
                          className={`
                            aspect-square rounded-lg flex items-center justify-center text-lg font-bold
                            transition-all duration-200 transform
                            ${isMarked
                              ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-95'
                              : isCalled
                              ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-900 animate-pulse hover:scale-105'
                              : isFree
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 border-2 border-gray-300 text-gray-400'
                            }
                            ${(isCalled || isFree) ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed'}
                          `}
                        >
                          {isFree ? '★' : num}
                        </button>
                      )
                    })
                  )}
                </div>

                <p className="text-center text-sm text-gray-500 mt-4">
                  Click on called numbers to mark them
                </p>
              </div>
            </div>

            {/* Right Panel - Called Numbers */}
            <div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Recently Called</h3>
                <div className="grid grid-cols-5 gap-2 max-h-[600px] overflow-y-auto">
                  {Array.from({ length: 75 }, (_, i) => i + 1).map(num => {
                    const isCalled = calledNumbers.includes(num)
                    const isLatest = latestNumber?.number === num

                    return (
                      <div
                        key={num}
                        className={`
                          aspect-square rounded-md flex items-center justify-center text-sm font-semibold
                          transition-all duration-300
                          ${isCalled
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md scale-110'
                            : 'bg-gray-100 text-gray-400'
                          }
                          ${isLatest ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
                        `}
                      >
                        {num}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Win Dialog */}
        {showWinDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-12 max-w-md text-center shadow-2xl">
              <div className="text-8xl mb-6">🎉</div>
              <h2 className="text-4xl font-bold mb-4 text-gray-800">Congratulations!</h2>
              <p className="text-2xl mb-6 text-gray-700">You've hit the BINGO!</p>
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
                <p className="text-lg text-gray-700 mb-2">You won:</p>
                <p className="text-4xl font-bold text-green-600">{formatCurrency(winAmount)}</p>
              </div>
              <p className="text-gray-600 mb-6">
                The winnings have been credited to your account.
              </p>
              <Link href="/lobby">
                <button className="bg-blue-600 text-white px-10 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg text-lg">
                  Go to Lobby
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Lose Dialog */}
        {showLoseDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-12 max-w-md text-center shadow-2xl">
              <div className="text-8xl mb-6">😢</div>
              <h2 className="text-4xl font-bold mb-4 text-gray-800">You Lost This Round</h2>
              
              <div className="space-y-3 mb-6">
                <p className="text-lg text-gray-700">
                  Stake lost: <span className="font-bold text-red-600">{formatCurrency(stake)}</span>
                </p>
                
                {winnerName && (
                  <p className="text-xl">
                    The winner is: <span className="font-semibold text-blue-600">{winnerName}</span>
                  </p>
                )}
                
                {winAmount > 0 && (
                  <p className="text-lg">
                    They won: <span className="font-semibold text-green-600">{formatCurrency(winAmount)}</span>
                  </p>
                )}
              </div>

              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
                <p className="text-gray-600 leading-relaxed">
                  Better luck next time! Keep playing to improve your chances.
                </p>
              </div>

              {findingNewGame ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm text-blue-600 font-medium">🎮 Finding new game...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    Auto-redirecting in <span className="font-bold text-blue-600">{redirectCountdown}</span> seconds...
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button 
                      onClick={handleFindNewGame}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
                    >
                      Find New Game
                    </button>
                    <Link href="/lobby">
                      <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg">
                        Go to Lobby
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leave Dialog */}
        {showLeaveDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-md shadow-2xl">
              <h2 className="text-3xl font-bold mb-4 text-gray-800">Leave Game?</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Are you sure you want to leave this game? Your stake will be forfeited.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowLeaveDialog(false)}
                  className="flex-1 bg-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <Link href="/lobby" className="flex-1">
                  <button className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors">
                    Leave Game
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
