"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSocket } from '@/lib/hooks/useSocket'
import { supabase } from '@/lib/supabase'
import { generateBingoCard, checkBingoWin, formatCurrency } from '@/lib/utils'
import { Users, Trophy, DollarSign, Clock, Loader2, LogOut, ArrowLeft, CheckCircle, XCircle, Star, Frown } from 'lucide-react'

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
  const [bingoError, setBingoError] = useState<string | null>(null)
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
          
          // Still need to join socket to get game updates
          if (joinResult.gameId) {
            setGameId(joinResult.gameId)
            await joinGame(joinResult.gameId, user.id)
            cleanupRef.current = { gameId: joinResult.gameId, userId: user.id }
          }
          
          setLoading(false)
          return
        }

        const activeGame = joinResult.game
        setGameId(activeGame.id)

        // DON'T deduct stake yet - only deduct when game becomes active
        // This allows players to leave during waiting without losing money

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

        // Game ticker (useGameTicker hook) will automatically handle countdown and number calling
        console.log('✅ Game joined, ticker will handle progression')

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

  // Deduct stake when game transitions to countdown/active
  const [stakeDeducted, setStakeDeducted] = useState(false)
  
  useEffect(() => {
    if (!gameState || !user || !gameId || !roomData) return
    if (stakeDeducted) return // Already deducted
    
    // Deduct stake when game starts (countdown or active)
    if (gameState.status === 'countdown' || gameState.status === 'active') {
      const deductStake = async () => {
        try {
          // Deduct stake from user balance
          await supabase.rpc('deduct_balance', {
            user_id: user.id,
            amount: roomData.stake
          })

          // Create transaction record
          await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'stake',
            amount: -roomData.stake,
            game_id: gameId,
            status: 'completed'
          })
          
          setStakeDeducted(true)
          console.log('💰 Stake deducted:', roomData.stake)
        } catch (error) {
          console.error('Error deducting stake:', error)
        }
      }
      
      deductStake()
    }
  }, [gameState?.status, user, gameId, roomData, stakeDeducted])

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
        
        // Auto-redirect after 8 seconds
        setTimeout(() => {
          router.push('/lobby')
        }, 8000)
      }
    }
  }, [gameState?.status, gameState?.winner_id, user])

  // REMOVED: Auto-mark feature - Players must manually mark numbers

  // Handle cell click - Manual marking only
  const handleCellClick = (row: number, col: number) => {
    if (!gameState || gameState.status !== 'active') return
    if (!gameId || !user) return
    
    const num = bingoCard[row][col]
    if (num === 0) return // Free space (always marked)
    if (!gameState.called_numbers.includes(num)) return // Not called yet
    
    // Toggle marking
    const newMarked = markedCells.map(r => [...r])
    newMarked[row][col] = !newMarked[row][col]
    setMarkedCells(newMarked)

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(50) // Short vibration (50ms)
    }

    // Emit mark event to server
    markNumber(gameId, user.id, num)
  }

  // Handle BINGO button click
  const handleBingoClick = async () => {
    if (!gameState || gameState.status !== 'active') {
      setBingoError('Game is not active')
      setTimeout(() => setBingoError(null), 3000)
      return
    }
    
    if (!gameId || !user) return

    // Check if user actually has a bingo
    if (!checkBingoWin(markedCells)) {
      setBingoError('Not a valid BINGO! Keep playing.')
      setTimeout(() => setBingoError(null), 3000)
      return
    }

    // Valid bingo - claim it!
    console.log('🎉 Claiming BINGO!')
    claimBingo(gameId, user.id, bingoCard)
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Joining game...</p>
        </div>
      </div>
    )
  }

  if (!roomData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-600">Loading game...</p>
        </div>
      </div>
    )
  }

  // If gameState hasn't loaded yet, show a brief loading state
  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-slate-600">Connecting to game...</p>
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => {
              if (gameStatus === 'active' || gameStatus === 'countdown') {
                setShowLeaveDialog(true)
              } else {
                router.push('/lobby')
              }
            }} 
            className="text-slate-900 text-2xl hover:text-slate-600 transition-colors"
          >
            ×
          </button>
          <h1 className="text-xl font-bold text-slate-900">{getRoomName()}</h1>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">

        {/* Waiting for Players State */}
        {gameStatus === 'waiting' && (
          <div className="space-y-4">
            {/* Current Game Section */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Waiting Room</h2>
              </div>
              
              <div className="space-y-6">
                {/* Players in Lobby */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <Users className="w-4 h-4" />
                      <span>Players in Lobby</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {players}
                    </span>
                  </div>
                  
                  {/* Waiting for Players Status */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="font-bold text-blue-700">Waiting for players...</span>
                    </div>
                    <p className="text-sm text-blue-600 text-center">
                      Game starts when enough players join
                    </p>
                  </div>
                </div>
                
                {/* Prize Pool */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span>Prize Pool</span>
                  </div>
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-emerald-600">{formatCurrency(prizePool)}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <button 
                onClick={() => router.push('/lobby')}
                className="w-full bg-slate-700 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Lobby</span>
              </button>
              
              <button 
                onClick={() => setShowLeaveDialog(true)}
                className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Leave Game</span>
              </button>
            </div>
          </div>
        )}

        {/* Countdown State - Show on same page */}
        {gameStatus === 'countdown' && (
          <div className="space-y-4">
            {/* Game Info Section */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Game Starting</h2>
              </div>
              
              <div className="space-y-4">
                {/* Players */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Users className="w-4 h-4" />
                    <span>Players</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{players}</span>
                </div>
                
                {/* Prize Pool */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <DollarSign className="w-4 h-4" />
                    <span>Prize Pool</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">{formatCurrency(prizePool)}</span>
                </div>
              </div>
            </div>

            {/* Countdown Progress Box */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border-2 border-blue-200 shadow-lg">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Clock className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">Starting In</h2>
              </div>
              
              <div className="text-center mb-6">
                <div className="text-7xl font-black text-blue-600 mb-2">
                  {countdownTime}
                </div>
                <p className="text-slate-600 font-medium">
                  seconds
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden mb-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((10 - countdownTime) / 10) * 100}%` }}
                ></div>
              </div>
              
              <p className="text-center text-sm text-slate-600">
                Get ready! The game is about to begin...
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button 
                onClick={() => router.push('/lobby')}
                className="w-full bg-slate-700 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Lobby</span>
              </button>
              
              <button 
                onClick={() => setShowLeaveDialog(true)}
                className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Leave Game</span>
              </button>
            </div>
          </div>
        )}

        {/* Queue State */}
        {playerState === 'queue' && (
          <div className="space-y-4">
            {/* Queue Status */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-8 border-2 border-purple-200 shadow-lg">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Clock className="w-10 h-10 text-purple-600" />
                <h2 className="text-2xl font-bold text-slate-900">In Queue</h2>
              </div>
              
              <p className="text-center text-lg text-slate-700 mb-6">
                You'll join the next game when this one ends
              </p>
              
              <div className="bg-white rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-3">
                  <Trophy className="w-4 h-4" />
                  <span>Current Game Progress</span>
                </div>
                
                {/* Game Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((calledNumbers.length / 75) * 100, 100)}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-slate-500 text-center">
                  {calledNumbers.length} / 75 numbers called
                </p>
              </div>
              
              <div className="bg-purple-100 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Users className="w-4 h-4" />
                    <span>Players in game:</span>
                  </div>
                  <span className="font-bold text-slate-900">{players}</span>
                </div>
              </div>
              
              <div className="text-sm text-slate-600 text-center space-y-1">
                <div>Your stake: <span className="font-bold text-purple-600">{formatCurrency(stake)}</span></div>
                <div>Room: <span className="font-semibold">{getRoomName()}</span></div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <button 
                onClick={() => router.push('/lobby')}
                className="w-full bg-slate-700 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Lobby</span>
              </button>
              
              <button 
                onClick={() => setShowLeaveDialog(true)}
                className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Leave Queue</span>
              </button>
            </div>
          </div>
        )}

        {/* Spectator Mode */}
        {playerState === 'spectator' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-slate-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Spectator Mode</h2>
              <p className="text-slate-600">
                Waiting for game to start...
              </p>
            </div>
          </div>
        )}

        {/* Active Game */}
        {gameStatus === 'active' && playerState === 'playing' && (
          <div className="space-y-3 pb-4">
            {/* Stake & Prize Info - Clean header */}
            <div className="text-center text-sm text-slate-700 font-medium py-2">
              <span>Stake: <span className="font-bold text-amber-600">{formatCurrency(stake)}</span></span>
              <span className="mx-3 text-slate-300">|</span>
              <span>Total Win Pool: <span className="font-bold text-emerald-600">{formatCurrency(prizePool)}</span></span>
            </div>

            {/* Number Called Section - Beautiful card */}
            <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-100">
              <h3 className="text-slate-700 font-bold text-sm mb-3">Latest Number Called</h3>
              
              <div className="flex items-center gap-4">
                {/* Latest Number - Prominent */}
                <div className="flex-shrink-0">
                  {latestNumber ? (
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-xl ring-4 ring-blue-100">
                        {latestNumber.number}
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-medium">
                      Wait...
                    </div>
                  )}
                </div>

                {/* Recent Numbers - Styled badges */}
                <div className="flex-1">
                  <div className="text-slate-600 text-xs font-semibold mb-2">Recent:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...calledNumbers].reverse().slice(1, 5).map((num) => {
                      const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O'
                      const colorClass = 
                        letter === 'B' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                        letter === 'I' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' :
                        letter === 'N' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' :
                        letter === 'G' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                        'bg-purple-100 text-purple-700 ring-1 ring-purple-200'
                      return (
                        <div
                          key={num}
                          className={`${colorClass} px-2 py-1 rounded-lg text-xs font-bold`}
                        >
                          {letter}{num}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bingo Card - Beautiful and Compact */}
            <div className="bg-white rounded-2xl p-3 border-4 border-amber-400 shadow-xl max-w-md mx-auto">
              {/* B-I-N-G-O Headers */}
              <div className="grid grid-cols-5 gap-0 mb-0 border-b-4 border-amber-400 pb-2.5">
                {[
                  { letter: 'B', color: 'text-red-500' },
                  { letter: 'I', color: 'text-blue-500' },
                  { letter: 'N', color: 'text-emerald-500' },
                  { letter: 'G', color: 'text-amber-500' },
                  { letter: 'O', color: 'text-purple-500' }
                ].map(({ letter, color }) => (
                  <div key={letter} className={`text-center font-black text-2xl ${color}`}>
                    {letter}
                  </div>
                ))}
              </div>

              {/* Bingo Grid - Optimized size */}
              <div className="grid grid-cols-5 gap-0 pt-2.5">
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
                          aspect-square flex items-center justify-center text-base font-bold
                          transition-all duration-200 border-r border-b border-slate-200
                          ${ci === 4 ? 'border-r-0' : ''}
                          ${ri === 4 ? 'border-b-0' : ''}
                          ${isMarked
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full m-1 shadow-lg'
                            : isCalled
                            ? 'bg-white text-slate-700 rounded-full m-1 ring-2 ring-blue-300 hover:bg-blue-50'
                            : isFree
                            ? 'bg-slate-100 text-slate-600 rounded-full m-1'
                            : 'bg-white text-slate-400'
                          }
                          ${(isCalled || isFree) ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed'}
                        `}
                      >
                        {isFree ? '★' : num}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* BINGO Error Message */}
            {bingoError && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-2.5 text-center animate-pulse max-w-md mx-auto">
                <p className="text-red-600 font-semibold text-sm">{bingoError}</p>
              </div>
            )}

            {/* BINGO Button - Beautiful */}
            <button
              onClick={handleBingoClick}
              disabled={!checkBingoWin(markedCells)}
              className={`w-full max-w-md mx-auto py-3.5 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                checkBingoWin(markedCells)
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-slate-400 text-slate-600 cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              <span>BINGO!</span>
            </button>
          </div>
        )}

        {/* Win Dialog */}
        {showWinDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
              {/* Trophy Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center">
                  <Trophy className="w-14 h-14 text-amber-600" />
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-3 text-slate-900">Congratulations!</h2>
              <p className="text-lg mb-6 text-slate-600">
                You've hit the BINGO!
              </p>
              
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-6">
                <p className="text-sm text-slate-600 mb-2">You won:</p>
                <p className="text-4xl font-bold text-green-600">{formatCurrency(winAmount)}</p>
              </div>

              <p className="text-sm text-slate-500 mb-6">
                The winnings have been credited to your account.
              </p>

              <Link href="/lobby">
                <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2">
                  <ArrowLeft className="w-5 h-5" />
                  Go to Lobby
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Lose Dialog */}
        {showLoseDialog && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
              {/* Close Button */}
              <button
                onClick={() => setShowLoseDialog(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>

              {/* Sad Face Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <Frown className="w-12 h-12 text-red-500" />
                </div>
              </div>

              <h2 className="text-3xl font-bold text-center mb-4 text-slate-900">You Lost This Round</h2>
              
              <p className="text-center text-slate-600 mb-2">
                Stake lost: <span className="font-bold text-red-600">{formatCurrency(stake)}</span>. Better luck next time!
              </p>

              {winnerName && (
                <div className="text-center mb-6">
                  <p className="text-slate-700 mb-1">
                    The winner is: <span className="font-bold text-amber-600">{winnerName}</span>
                  </p>
                  {winAmount > 0 && (
                    <p className="text-slate-700">
                      They won: <span className="font-bold text-emerald-600">{formatCurrency(winAmount)}</span>
                    </p>
                  )}
                </div>
              )}

              <p className="text-center text-sm text-slate-500 mb-6">
                Auto-redirecting in 8 seconds...
              </p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button 
                  onClick={handleFindNewGame}
                  disabled={findingNewGame}
                  className="w-full bg-amber-500 text-white py-4 rounded-xl font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  {findingNewGame ? 'Finding...' : 'Play Again'}
                </button>
                
                <Link href="/lobby" className="block">
                  <button className="w-full bg-slate-700 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Close
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Leave Dialog */}
        {showLeaveDialog && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold text-center mb-4 text-slate-900">Leave Game?</h2>
              <p className="text-center text-slate-600 mb-8">
                Are you sure you want to leave the current game? You will lose your stake of {formatCurrency(stake)}.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    if (gameId && user) {
                      try {
                        await fetch('/api/game/leave', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            gameId, 
                            userId: user.id,
                            gameStatus: gameState?.status,
                            stakeDeducted: stakeDeducted
                          })
                        })
                      } catch (error) {
                        console.error('Error leaving game:', error)
                      }
                    }
                    window.location.href = '/lobby'
                  }}
                  className="w-full bg-amber-500 text-white py-3.5 rounded-xl font-bold hover:bg-amber-600 transition-colors"
                >
                  Leave Game
                </button>
                
                <button 
                  onClick={() => setShowLeaveDialog(false)}
                  className="w-full bg-slate-700 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
