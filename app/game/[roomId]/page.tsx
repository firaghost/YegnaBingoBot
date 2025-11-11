"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSocket } from '@/lib/hooks/useSocket'
import { useGameTicker } from '@/lib/hooks/useGameTicker'
import { supabase } from '@/lib/supabase'
import { generateBingoCard, checkBingoWin, formatCurrency } from '@/lib/utils'

type GameStatus = 'waiting' | 'countdown' | 'active' | 'finished'

interface CalledNumber {
  letter: string
  number: number
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params?.roomId as string
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { connected, gameState, joinGame, leaveGame, markNumber, claimBingo } = useSocket()

  const [gameId, setGameId] = useState<string | null>(null)
  
  // Use game ticker to progress the game (replaces server-side loop)
  useGameTicker(gameId, gameState?.status || null)
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
  const [autoWin, setAutoWin] = useState(false)
  const initializingRef = useRef(false)
  const cleanupRef = useRef<{ gameId: string; userId: string } | null>(null)

  // Check authentication - only redirect after auth is loaded
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Fetch room data and join/create game
  useEffect(() => {
    // Wait for auth to load before initializing game
    if (authLoading) return
    if (!user || !roomId) return
    if (gameId) return // Already initialized
    if (initializingRef.current) return // Already initializing

    let isMounted = true
    initializingRef.current = true

    const initializeGame = async () => {
      if (!isMounted) return
      console.log('🎮 Initializing game for room:', roomId)
      
      try {
        // Fetch room data
        console.log('📡 Fetching room data...')
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (roomError) {
          console.error('❌ Room error:', roomError)
          throw roomError
        }
        console.log('✅ Room data:', room)
        setRoomData(room)

        // Check if user has sufficient balance
        if (user.balance < room.stake) {
          alert('Insufficient balance!')
          router.push('/lobby')
          return
        }

        // Use API to join/create game (bypasses RLS issues)
        console.log('📡 Calling join API...')
        const joinResponse = await fetch('/api/game/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomId,
            userId: user.id,
            stake: room.stake
          })
        })

        if (!joinResponse.ok) {
          const error = await joinResponse.json()
          throw new Error(error.error || 'Failed to join game')
        }

        const joinResult = await joinResponse.json()
        console.log('✅ Join result:', joinResult)

        if (joinResult.status === 'queued') {
          // Game is already running, put player in queue
          setPlayerState('queue')
          setLoading(false)
          return
        }

        const activeGame = joinResult.game
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

        // Save card to database (upsert to avoid conflicts)
        await supabase.from('player_cards').upsert({
          game_id: activeGame.id,
          user_id: user.id,
          card: card
        }, {
          onConflict: 'game_id,user_id'
        })

        // Join socket room and wait for initial state
        console.log('🔌 About to join socket game:', activeGame.id)
        await joinGame(activeGame.id, user.id)
        console.log('🔌 Socket join completed')
        
        // Store cleanup info
        cleanupRef.current = { gameId: activeGame.id, userId: user.id }

        // Check current game status and trigger start if in countdown
        // Re-fetch to get the latest status after joining
        const { data: currentGame } = await supabase
          .from('games')
          .select('status')
          .eq('id', activeGame.id)
          .single()

        if (currentGame?.status === 'countdown') {
          console.log('🎬 Game is in countdown, triggering start...')
          try {
            const response = await fetch('/api/game/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gameId: activeGame.id })
            })
            
            if (!response.ok) {
              const errorText = await response.text()
              console.error('Failed to start game:', errorText)
            } else {
              const result = await response.json()
              console.log('✅ Game start triggered:', result.message)
            }
          } catch (error) {
            console.error('❌ Error starting game:', error)
            // Don't fail the game join if start trigger fails
          }
        }

        // Update daily streak (only when actually playing a game)
        try {
          await fetch('/api/game/update-streak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          })
        } catch (streakError) {
          console.error('Error updating streak:', streakError)
          // Don't fail the game join if streak update fails
        }

      } catch (error) {
        console.error('❌ Error initializing game:', error)
        alert('Failed to join game: ' + (error as any).message)
        initializingRef.current = false
        router.push('/lobby')
      } finally {
        console.log('✅ Game initialization complete')
        setLoading(false)
      }
    }

    initializeGame()

    return () => {
      isMounted = false
    }
  }, [user, roomId, router, authLoading, gameId])

  // Cleanup socket connection on unmount only
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        leaveGame(cleanupRef.current.gameId, cleanupRef.current.userId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Safety timeout - if gameState doesn't load within 10 seconds, show error
  useEffect(() => {
    if (!loading && !gameState && gameId) {
      const timeout = setTimeout(() => {
        console.error('⚠️ Game state failed to load after 10 seconds')
        console.log('Debug - gameId:', gameId, 'loading:', loading, 'gameState:', gameState)
        alert('Failed to connect to game. Please try again.')
        router.push('/lobby')
      }, 10000)

      return () => clearTimeout(timeout)
    }
  }, [loading, gameState, gameId, router])

  // Monitor countdown - if stuck for too long, try to restart it
  useEffect(() => {
    if (!gameState || !gameId) return
    if (gameState.status !== 'countdown') return

    // If countdown is stuck at same value for more than 15 seconds, try to restart
    const countdownValue = gameState.countdown_time
    const timeout = setTimeout(async () => {
      console.warn('⚠️ Countdown appears stuck, attempting to restart game loop...')
      try {
        const response = await fetch('/api/game/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId })
        })
        const result = await response.json()
        console.log('Restart attempt result:', result)
      } catch (error) {
        console.error('Failed to restart game:', error)
      }
    }, 15000)

    return () => clearTimeout(timeout)
  }, [gameState?.status, gameState?.countdown_time, gameId])

  // Handle game state updates from Socket.IO
  useEffect(() => {
    if (!gameState) return

    // Check if game finished
    if (gameState.status === 'finished' && gameState.winner_id) {
      console.log('🏁 Game finished! Winner:', gameState.winner_id)
      
      if (gameState.winner_id === user?.id) {
        // User won
        const prize = gameState.net_prize || gameState.prize_pool
        setWinAmount(prize)
        
        // Check if it's an auto-win (opponent left)
        if (gameState.players.length === 1) {
          setAutoWin(true)
        }
        
        console.log('🎉 You won!', prize)
        setShowWinDialog(true)
      } else {
        // User lost
        const prize = gameState.net_prize || gameState.prize_pool
        setWinAmount(prize)
        setShowLoseDialog(true)
        
        console.log('😢 You lost. Winner:', gameState.winner_id)
        
        // Fetch winner name
        if (gameState.winner_id) {
          supabase
            .from('users')
            .select('username')
            .eq('id', gameState.winner_id)
            .single()
            .then(({ data }) => {
              if (data) {
                console.log('Winner name:', data.username)
                setWinnerName(data.username)
              }
            })
        }
      }
    }
  }, [gameState?.status, gameState?.winner_id, user])

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (!gameState || gameState.status !== 'active') return
    if (!gameId || !user) return
    
    const num = bingoCard[row][col]
    if (num === 0) return // Free space
    if (!gameState.called_numbers.includes(num)) return // Not called yet
    if (markedCells[row][col]) return // Already marked - don't allow unmarking

    const newMarked = markedCells.map(r => [...r])
    newMarked[row][col] = true // Only allow marking, not unmarking
    setMarkedCells(newMarked)

    // Emit mark event to server
    markNumber(gameId, user.id, num)

    // Check for win
    if (checkBingoWin(newMarked)) {
      claimBingo(gameId, user.id, bingoCard)
    }
  }

  // No auto-redirect - removed to let user choose

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

  if (!roomData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  // If gameState hasn't loaded yet, show a brief loading state
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Connecting to game...</p>
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
          <h1 className="text-2xl font-bold text-gray-800">{getRoomName()}</h1>
          <button 
            onClick={() => setShowLeaveDialog(true)}
            className="text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            Leave Game
          </button>
        </div>

        {/* Waiting for Players State */}
        {gameStatus === 'waiting' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="text-4xl animate-bounce">⏳</div>
                <h2 className="text-3xl font-bold text-gray-800">Waiting for Players</h2>
              </div>
              <div className="text-6xl font-bold text-blue-600 mb-6">
                {players}/{gameState?.min_players || 2}
              </div>
              <p className="text-gray-600 text-lg mb-4">
                Waiting for at least {gameState?.min_players || 2} players to start the game...
              </p>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mt-6">
                <p className="text-sm text-gray-600">
                  💡 <strong>Tip:</strong> Share the game link with friends to start faster!
                </p>
              </div>
              <div className="mt-6 text-sm text-gray-500">
                Current Prize Pool: <span className="font-bold text-green-600">{formatCurrency(prizePool)}</span>
              </div>
            </div>
          </div>
        )}

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
          <div className="flex flex-col h-screen">
            {/* Fixed Header with Game Info */}
            <div className="bg-white border-b border-gray-200 px-3 py-2 flex-shrink-0">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div>
                    <span className="text-gray-500">Players:</span>
                    <span className="font-bold ml-0.5">{players}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Prize:</span>
                    <span className="font-bold text-green-600 ml-0.5">{formatCurrency(prizePool)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <span className="text-gray-500">Progress:</span>
                    <span className="font-bold text-blue-600 ml-0.5">{calledNumbers.length}/75</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Stake:</span>
                    <span className="font-bold ml-0.5">{formatCurrency(stake)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {/* Latest Number & History */}
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg p-3 text-white">
                <h3 className="font-bold text-xs mb-2">Latest Number Called</h3>
                <div className="flex items-center gap-3">
                  {/* Latest Number - Large */}
                  <div className="flex-shrink-0">
                    {latestNumber ? (
                      <div className="text-center">
                        <div className="text-lg font-bold mb-0.5">{latestNumber.letter}</div>
                        <div className="w-16 h-16 rounded-full bg-white text-blue-600 flex items-center justify-center text-2xl font-bold shadow-xl animate-pulse">
                          {latestNumber.number}
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-xs">
                        Wait...
                      </div>
                    )}
                  </div>

                  {/* Recent History - Compact */}
                  <div className="flex-1">
                    <div className="text-xs font-semibold mb-1.5 opacity-90">Recent:</div>
                    <div className="flex flex-wrap gap-1">
                      {[...calledNumbers].reverse().slice(1, 11).map((num) => {
                        const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O'
                        return (
                          <div
                            key={num}
                            className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-semibold"
                          >
                            {letter}{num}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bingo Card */}
              <div className="bg-white rounded-lg shadow-2xl p-3">
                <h3 className="text-center font-bold text-lg mb-2 text-gray-800">Your Bingo Card</h3>
                
                {/* B-I-N-G-O Headers */}
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map(letter => (
                    <div key={letter} className="text-center font-bold text-xl text-blue-600">
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Bingo Grid */}
                <div className="grid grid-cols-5 gap-1.5">
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
                            aspect-square rounded-md flex items-center justify-center text-sm font-bold
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
              <p className="text-2xl mb-6 text-gray-700">
                {autoWin ? "You won by default!" : "You've hit the BINGO!"}
              </p>
              
              {autoWin && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
                  <p className="text-gray-700">
                    🏆 Your opponent left the game, so you win!
                  </p>
                </div>
              )}
              
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
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">
                    Choose what to do next:
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button 
                      onClick={handleFindNewGame}
                      className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg text-lg"
                    >
                      🔄 Play Again
                    </button>
                    <Link href="/lobby">
                      <button className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg text-lg">
                        🏠 Back to Lobby
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
                {gameState && gameState.players.length === 2 && gameState.status === 'active' && (
                  <span className="block mt-2 text-orange-600 font-semibold">
                    ⚠️ If you leave, your opponent will win automatically!
                  </span>
                )}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowLeaveDialog(false)}
                  className="flex-1 bg-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (gameId && user) {
                      // Call leave API
                      try {
                        await fetch('/api/game/leave', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ gameId, userId: user.id })
                        })
                      } catch (error) {
                        console.error('Error leaving game:', error)
                      }
                    }
                    window.location.href = '/lobby'
                  }}
                  className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                >
                  Leave Game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
