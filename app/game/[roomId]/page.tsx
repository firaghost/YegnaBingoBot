"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { GameSimulator, GameStatus, CalledNumber } from '@/lib/gameSimulator'
import { generateBingoCard, checkBingoWin, getBingoLetter, generateBotName, formatCurrency } from '@/lib/utils'

export default function GamePage() {
  const params = useParams()
  const roomId = params?.roomId as string
  const simulatorRef = useRef<GameSimulator | null>(null)

  const [gameStatus, setGameStatus] = useState<GameStatus>('countdown')
  const [countdownTime, setCountdownTime] = useState(10)
  const [playerState, setPlayerState] = useState<'playing' | 'queue' | 'spectator'>('playing')
  const [bingoCard, setBingoCard] = useState<number[][]>([])
  const [markedCells, setMarkedCells] = useState<boolean[][]>([])
  const [calledNumbers, setCalledNumbers] = useState<number[]>([])
  const [latestNumber, setLatestNumber] = useState<CalledNumber | null>(null)
  const [players, setPlayers] = useState(124)
  const [prizePool, setPrizePool] = useState(1000)
  const [stake] = useState(10)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showWinDialog, setShowWinDialog] = useState(false)
  const [showLoseDialog, setShowLoseDialog] = useState(false)
  const [winAmount, setWinAmount] = useState(0)
  const [botWinnerName] = useState(generateBotName())
  const [redirectCountdown, setRedirectCountdown] = useState(5)
  const [findingNewGame, setFindingNewGame] = useState(false)
  const [lobbyInfo, setLobbyInfo] = useState({
    isActive: false,
    isInitiator: false,
    playersReady: 0
  })

  // Initialize game
  useEffect(() => {
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

    // Initialize game simulator
    simulatorRef.current = new GameSimulator(stake)
    const unsubscribe = simulatorRef.current.subscribe((state) => {
      setGameStatus(state.status)
      setCountdownTime(state.countdownTime)
      setCalledNumbers(state.calledNumbers)
      setLatestNumber(state.latestNumber)
      setPlayers(state.players)
      setPrizePool(state.prizePool)
    })

    simulatorRef.current.start()

    return () => {
      unsubscribe()
      simulatorRef.current?.cleanup()
    }
  }, [stake])

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (gameStatus !== 'active') return
    const num = bingoCard[row][col]
    if (num === 0) return
    if (!calledNumbers.includes(num)) return

    const newMarked = markedCells.map(r => [...r])
    newMarked[row][col] = !newMarked[row][col]
    setMarkedCells(newMarked)

    // Check for win
    if (checkBingoWin(newMarked)) {
      setWinAmount(prizePool)
      setShowWinDialog(true)
      simulatorRef.current?.cleanup()
    }
  }

  // Simulate bot win
  useEffect(() => {
    if (gameStatus === 'finished' && !showWinDialog) {
      setShowLoseDialog(true)
      setWinAmount(prizePool)
    }
  }, [gameStatus, showWinDialog, prizePool])

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
    setLobbyInfo({
      isActive: true,
      isInitiator: Math.random() > 0.5,
      playersReady: Math.floor(Math.random() * 5) + 1
    })
    // In production, this would emit socket event: 'request-new-game'
    setTimeout(() => {
      window.location.href = `/game/${roomId}`
    }, 3000)
  }

  const getRoomName = (id: string) => {
    const names: Record<string, string> = {
      classic: 'Classic Room',
      speed: 'Speed Bingo',
      mega: 'Mega Jackpot'
    }
    return names[id] || 'Bingo Room'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/lobby" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
            ← Back to Lobby
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{getRoomName(roomId)}</h1>
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
                Your stake: {stake} ETB • Room: {getRoomName(roomId)}
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
                
                {botWinnerName && (
                  <p className="text-xl">
                    The winner is: <span className="font-semibold text-blue-600">{botWinnerName}</span>
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
                  {lobbyInfo.isActive && (
                    <p className="text-xs text-gray-600">
                      {lobbyInfo.isInitiator 
                        ? `Started lobby with ${lobbyInfo.playersReady} players ready`
                        : `Joined lobby with ${lobbyInfo.playersReady} players ready`
                      }
                    </p>
                  )}
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
