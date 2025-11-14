"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminGameViewer() {
  const params = useParams()
  const gameId = params?.gameId as string
  const [game, setGame] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<any[]>([])
  const [calledNumbers, setCalledNumbers] = useState<number[]>([])
  const [latestNumber, setLatestNumber] = useState<any>(null)
  
  useEffect(() => {
    if (gameId) {
      fetchGameData()
      
      // Set up polling for real-time updates
      const interval = setInterval(() => {
        fetchGameData()
      }, 5000) // Poll every 5 seconds
      
      return () => clearInterval(interval)
    }
  }, [gameId])

  // Remove socket functionality for now - using polling instead

  const fetchGameData = async () => {
    try {
      const { data: gameData, error } = await supabase
        .from('games')
        .select(`
          *,
          rooms (name, stake, game_level)
        `)
        .eq('id', gameId)
        .single()

      if (error) throw error
      setGame(gameData)
      setCalledNumbers(gameData.called_numbers || [])
      setLatestNumber(gameData.latest_number)
      
      // Fetch players if available
      if (gameData.players) {
        setPlayers(gameData.players)
      }
    } catch (error) {
      console.error('Error fetching game data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateBingoNumbers = () => {
    const numbers = {
      B: Array.from({ length: 15 }, (_, i) => i + 1),
      I: Array.from({ length: 15 }, (_, i) => i + 16),
      N: Array.from({ length: 15 }, (_, i) => i + 31),
      G: Array.from({ length: 15 }, (_, i) => i + 46),
      O: Array.from({ length: 15 }, (_, i) => i + 61)
    }
    return numbers
  }

  const bingoNumbers = generateBingoNumbers()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading game...</p>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Game Not Found</h1>
          <Link href="/mgmt-portal-x7k9p2/games" className="text-blue-400 hover:text-blue-300">
            ← Back to Games
          </Link>
        </div>
      </div>
    )
  }

  // Redirect if game is not active (canceled, finished, etc.)
  if (game.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Game No Longer Active</h1>
          <p className="text-gray-400 mb-4">This game has {game.status === 'finished' ? 'finished' : 'been canceled'}</p>
          <Link href="/mgmt-portal-x7k9p2/games" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
            ← Back to Games
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/mgmt-portal-x7k9p2/games" className="text-xl sm:text-2xl text-white hover:opacity-70">←</Link>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white">Live Game Monitor</h1>
                <p className="text-gray-400 text-sm">{game.rooms?.name} - {game.rooms?.game_level}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span className="text-sm text-gray-300">Polling Updates</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Game Status Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Game Info */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Game Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    game.status === 'active' ? 'bg-green-500/20 text-green-400 animate-pulse' :
                    game.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                    game.status === 'countdown' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {game.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Players:</span>
                  <span className="text-white font-semibold">{players.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Prize Pool:</span>
                  <span className="text-green-400 font-bold">{formatCurrency(game.prize_pool || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Numbers Called:</span>
                  <span className="text-white font-semibold">{calledNumbers.length} / 75</span>
                </div>
                {game.countdown_time > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Countdown:</span>
                    <span className="text-blue-400 font-bold">{game.countdown_time}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Number */}
            {latestNumber && (
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-md rounded-xl border border-blue-400/30 p-6 text-center">
                <h3 className="text-lg font-bold text-white mb-4">Latest Number</h3>
                <div className="text-6xl font-bold text-blue-400 mb-2">
                  {latestNumber.letter}-{latestNumber.number}
                </div>
                <div className="text-gray-300 text-sm">
                  Called {new Date(latestNumber.calledAt || Date.now()).toLocaleTimeString()}
                </div>
              </div>
            )}

            {/* Players List */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Players ({players.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {players.map((player, index) => (
                  <div key={player.id || index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {player.username?.charAt(0) || 'P'}
                      </div>
                      <span className="text-white font-medium">{player.username || `Player ${index + 1}`}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {player.markedNumbers?.length || 0} marked
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bingo Board */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
              <h3 className="text-lg font-bold text-white mb-6 text-center">Bingo Board</h3>
              
              {/* BINGO Header */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                  <div key={letter} className={`text-center font-black text-2xl sm:text-3xl ${
                    ['text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-500', 'text-purple-500'][index]
                  }`}>
                    {letter}
                  </div>
                ))}
              </div>

              {/* Numbers Grid */}
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(bingoNumbers).map(([letter, numbers]) => (
                  <div key={letter} className="space-y-2">
                    {numbers.map((number) => {
                      const isCalled = calledNumbers.includes(number)
                      const isLatest = latestNumber?.number === number
                      
                      return (
                        <div
                          key={number}
                          className={`
                            w-full aspect-square flex items-center justify-center rounded-lg font-bold text-sm sm:text-base transition-all duration-300
                            ${isCalled 
                              ? isLatest 
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg scale-110 animate-pulse' 
                                : 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md'
                              : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }
                          `}
                        >
                          {number}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-green-600 rounded"></div>
                  <span className="text-gray-300">Called</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded"></div>
                  <span className="text-gray-300">Latest</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/10 rounded"></div>
                  <span className="text-gray-300">Not Called</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game History */}
        <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Called Numbers History</h3>
          <div className="flex flex-wrap gap-2">
            {calledNumbers.slice().reverse().map((number, index) => {
              const letter = number <= 15 ? 'B' : number <= 30 ? 'I' : number <= 45 ? 'N' : number <= 60 ? 'G' : 'O'
              return (
                <div
                  key={`${number}-${index}`}
                  className={`
                    px-3 py-1 rounded-lg text-sm font-bold
                    ${index === 0 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' 
                      : 'bg-white/10 text-gray-300'
                    }
                  `}
                >
                  {letter}-{number}
                </div>
              )
            })}
          </div>
          {calledNumbers.length === 0 && (
            <p className="text-gray-400 text-center py-8">No numbers called yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
