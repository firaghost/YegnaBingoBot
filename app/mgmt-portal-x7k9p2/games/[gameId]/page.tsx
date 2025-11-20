"use client"
import { SpeedInsights } from "@vercel/speed-insights/next"
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminGameViewer() {
  const params = useParams()
  const searchParams = useSearchParams()
  const gameId = params?.gameId as string
  const viewMode = searchParams?.get('view') || 'live' // 'live' or 'history'
  const [game, setGame] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<any[]>([])
  const [calledNumbers, setCalledNumbers] = useState<number[]>([])
  const [latestNumber, setLatestNumber] = useState<any>(null)
  const [playerMarkings, setPlayerMarkings] = useState<Map<number, number>>(new Map()) // number -> playerIndex
  const [endCountdown, setEndCountdown] = useState<number | null>(null)
  const countdownRef = useRef<any>(null)
  const [ending, setEnding] = useState(false)
  const [walletSource, setWalletSource] = useState<'cash' | 'bonus' | 'mixed' | null>(null)
  
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
      
      // Fetch player details if available
      if (gameData.players && gameData.players.length > 0) {
        const { data: playerData } = await supabase
          .from('users')
          .select('id, username')
          .in('id', gameData.players)
        
        if (playerData) {
          setPlayers(playerData)
        }

        // (Optional) player_markings visualization was removed because the table does not
        // exist in the current schema. The board will still show called numbers correctly
        // without this extra per-player coloring.
      }

      // Fetch winner info if game has a winner
      if (gameData.winner_id) {
        const { data: winnerData } = await supabase
          .from('users')
          .select('id, username')
          .eq('id', gameData.winner_id)
          .single()
        
        if (winnerData) {
          gameData.winner_info = winnerData
        }
      }

      // Compute wallet mix (Cash / Bonus / Mixed) for this game using prize pool composition
      try {
        const [{ data: realPoolData, error: realErr }, { data: bonusPoolData, error: bonusErr }] = await Promise.all([
          supabase.rpc('compute_real_prize_pool', { p_game_id: gameId }).then((res: any) => ({ data: res.data, error: res.error })),
          supabase.rpc('compute_bonus_prize_pool', { p_game_id: gameId }).then((res: any) => ({ data: res.data, error: res.error })),
        ])
        const realPool = !realErr && typeof realPoolData === 'number' ? Number(realPoolData) : 0
        const bonusPool = !bonusErr && typeof bonusPoolData === 'number' ? Number(bonusPoolData) : 0
        if (realPool > 0 && bonusPool === 0) setWalletSource('cash')
        else if (bonusPool > 0 && realPool === 0) setWalletSource('bonus')
        else if (realPool > 0 && bonusPool > 0) setWalletSource('mixed')
        else setWalletSource(null)
      } catch (e) {
        console.warn('Failed to compute wallet mix for admin game viewer', e)
      }
    } catch (error) {
      console.error('Error fetching game data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto end: if all 75 numbers are called and there's no winner, start a 30s timer
  useEffect(() => {
    if (!game) return
    const allCalled = (calledNumbers?.length || 0) >= 75
    const noWinner = !game.winner_id
    const isActive = game.status === 'active'
    if (isActive && allCalled && noWinner && endCountdown == null) {
      setEndCountdown(30)
      countdownRef.current = setInterval(() => {
        setEndCountdown((prev) => {
          if (prev == null) return prev
          if (prev <= 1) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
            endGameNow('auto_end_no_claim')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    // Stop countdown if game ends or becomes inactive
    if ((!isActive || game.winner_id) && countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
      setEndCountdown(null)
    }
    return () => {}
  }, [game?.status, game?.winner_id, calledNumbers?.length])

  // End game immediately (admin control)
  const endGameNow = async (reason: string = 'manual_end') => {
    if (!gameId || ending) return
    try {
      setEnding(true)
      // Try extended update first (if columns exist)
      const { error: err1 } = await supabase
        .from('games')
        .update({ status: 'finished', ended_at: new Date().toISOString(), game_status: 'finished_no_winner', end_reason: reason })
        .eq('id', gameId)
      if (err1) {
        // Fallback to minimal update (status + ended_at only)
        await supabase
          .from('games')
          .update({ status: 'finished', ended_at: new Date().toISOString() })
          .eq('id', gameId)
      }
      await fetchGameData()
    } catch (e) {
      console.error('Failed to end game:', e)
    } finally {
      setEnding(false)
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

  // Compute a 5x5 boolean mask for the winning pattern string (row:X, column:Y, diag:main, diag:anti)
  const getPatternMask = (pattern?: string | null): boolean[][] => {
    const mask = Array(5).fill(null).map(() => Array(5).fill(false))
    if (!pattern) return mask
    const p = pattern.toLowerCase()
    if (p.startsWith('row:')) {
      const r = parseInt(p.split(':')[1] || '0')
      if (!Number.isNaN(r) && r >= 0 && r < 5) {
        for (let c = 0; c < 5; c++) mask[r][c] = true
      }
    } else if (p.startsWith('column:')) {
      const c = parseInt(p.split(':')[1] || '0')
      if (!Number.isNaN(c) && c >= 0 && c < 5) {
        for (let r = 0; r < 5; r++) mask[r][c] = true
      }
    } else if (p === 'diag:main') {
      for (let k = 0; k < 5; k++) mask[k][k] = true
    } else if (p === 'diag:anti') {
      for (let k = 0; k < 5; k++) mask[k][4 - k] = true
    }
    return mask
  }

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

  // Show history view for finished games with winners
  if ((viewMode === 'history' || game.status === 'finished') && game.winner_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Link href="/mgmt-portal-x7k9p2/games" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white">{game.rooms?.name} - Game History</h1>
                  <p className="text-xs text-slate-400">Finished Game</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                <span className="text-slate-300">Completed</span>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Winner Info - Top */}
          <div className="bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 backdrop-blur-md rounded-lg border border-emerald-500/30 p-4 mb-6">
            <p className="text-xs text-slate-400 mb-2">Winner</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                👑
              </div>
              <div>
                <p className="text-white font-bold text-lg">{players.find(p => p.id === game.winner_id)?.username || game.winner_info?.username || 'Unknown'}</p>
                <p className="text-sm text-emerald-400">{formatCurrency(game.net_prize || 0)}</p>
              </div>
            </div>
          </div>

          {/* Winner's Bingo Card - How They Won (compact, like losing dialog) */}
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4 mb-6">
            <h3 className="text-sm font-bold text-white mb-3 text-center">How They Won</h3>
            
            {/* BINGO Header */}
            <div className="grid grid-cols-5 gap-0.5 mb-2">
              {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                <div key={letter} className={`text-center font-black text-sm ${
                  ['text-red-400', 'text-blue-400', 'text-green-400', 'text-yellow-400', 'text-purple-400'][index]
                }`}>
                  {letter}
                </div>
              ))}
            </div>

            {/* Winner's Card Grid - Compact */}
            <div className="w-fit mx-auto grid grid-cols-5 gap-0.5 mb-3 bg-slate-900/30 p-2 rounded">
              {game.winner_card && game.winner_card.map((row: any[], rowIndex: number) => 
                row.map((number: number, colIndex: number) => {
                  const isCalled = calledNumbers.includes(number)
                  const isFreeSpace = number === 0
                  const isWinningCell = getPatternMask(game.winner_pattern)[rowIndex]?.[colIndex]
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`
                        w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 flex items-center justify-center rounded text-[10px] sm:text-xs font-bold transition-all
                        ${isWinningCell
                          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border border-emerald-400 shadow-md'
                          : isFreeSpace
                          ? 'bg-slate-600 text-slate-300'
                          : isCalled
                          ? 'bg-slate-600 text-slate-300'
                          : 'bg-slate-700/50 text-slate-400'
                        }
                      `}
                    >
                      {isFreeSpace ? 'FREE' : number}
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded border border-emerald-400"></div>
                <span className="text-slate-300">Marked & Called</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-slate-600 rounded"></div>
                <span className="text-slate-300">Free Space</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-slate-700/50 rounded"></div>
                <span className="text-slate-300">Not Called</span>
              </div>
            </div>
          </div>


          {/* Game Stats & Players - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Game Stats */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-bold text-white mb-3">Game Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Players</span>
                  <span className="text-white font-bold">{game.player_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Numbers Called</span>
                  <span className="text-cyan-400 font-bold">{calledNumbers.length}/75</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Prize Pool</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(game.prize_pool || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entry Fee</span>
                  <span className="text-slate-300 font-bold">{formatCurrency(game.rooms?.stake || 0)}</span>
                </div>
              </div>
            </div>

            {/* All Players */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-bold text-white mb-3">Players ({players.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {players.map((player, index) => (
                  <div key={player.id || index} className={`p-2 rounded-lg text-sm ${
                    player.id === game.winner_id 
                      ? 'bg-emerald-500/20 border border-emerald-500/30' 
                      : 'bg-slate-700/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{player.username || `Player ${index + 1}`}</span>
                      {player.id === game.winner_id && <span className="text-xs bg-emerald-500/50 text-emerald-200 px-2 py-0.5 rounded">Winner</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Called Numbers History */}
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
            <h3 className="text-sm font-bold text-white mb-3">Called Numbers ({calledNumbers.length})</h3>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {calledNumbers.map((number, index) => {
                const letter = number <= 15 ? 'B' : number <= 30 ? 'I' : number <= 45 ? 'N' : number <= 60 ? 'G' : 'O'
                return (
                  <div
                    key={`${number}-${index}`}
                    className={`
                      px-2 py-1 rounded text-xs font-bold whitespace-nowrap
                      ${index === calledNumbers.length - 1
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                        : 'bg-slate-700/50 text-slate-300'
                      }
                    `}
                  >
                    {letter}-{number}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Redirect if game is not active or finished with winner
  if (game.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Game No Longer Available</h1>
          <p className="text-slate-400 mb-4">This game has {game.status === 'finished' ? 'finished' : 'been canceled'}</p>
          <Link href="/mgmt-portal-x7k9p2/games" className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
            ← Back to Games
          </Link>
        </div>
      </div>
    )
  }

  // Color palette for players
  const playerColors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-green-500 to-green-600',
    'from-yellow-500 to-yellow-600',
    'from-red-500 to-red-600',
    'from-indigo-500 to-indigo-600',
    'from-cyan-500 to-cyan-600',
  ]

  const getPlayerColor = (index: number) => playerColors[index % playerColors.length]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2/games" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">{game.rooms?.name}</h1>
                <p className="text-xs text-slate-400">Live Game Monitor</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {endCountdown != null && (
                <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-semibold">Auto-end in {endCountdown}s</span>
              )}
              <button
                onClick={() => endGameNow('admin_manual_end')}
                className="px-3 py-1.5 rounded bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/30 transition-colors font-semibold"
                disabled={ending}
                title="Force end this game"
              >
                {ending ? 'Ending…' : 'End Now'}
              </button>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-slate-300">Live</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Left Sidebar - Compact Stats & Players */}
          <div className="lg:col-span-1 space-y-4">
            {/* Game Stats - Compact */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Players</p>
                  <p className="text-2xl font-bold text-white">{players.length}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Numbers</p>
                  <p className="text-2xl font-bold text-cyan-400">{calledNumbers.length}/75</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Prize Pool</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(game.prize_pool || 0)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Entry Fee</p>
                  <p className="text-lg font-bold text-slate-300">{formatCurrency(game.rooms?.stake || 0)}</p>
                </div>
              </div>
              {walletSource && (
                <div className="mt-2 text-[11px] text-slate-400">
                  Wallet mix:
                  <span
                    className={`ml-1 inline-flex px-2 py-0.5 rounded-full font-semibold border ${
                      walletSource === 'cash'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40'
                        : walletSource === 'bonus'
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/40'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {walletSource === 'cash' ? 'Cash' : walletSource === 'bonus' ? 'Bonus' : 'Mixed'}
                  </span>
                </div>
              )}
            </div>

            {/* Latest Number - Prominent */}
            {latestNumber && (
              <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-md rounded-lg border border-cyan-500/30 p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">Latest Number</p>
                <div className="text-5xl font-bold text-cyan-400 font-mono">
                  {latestNumber.letter}-{latestNumber.number}
                </div>
              </div>
            )}

            {/* Players List - Compact with Colors */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-bold text-white mb-3">Players</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {players.map((player, index) => (
                  <div key={player.id || index} className="flex items-center gap-2 p-2 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                    <div className={`w-6 h-6 bg-gradient-to-br ${getPlayerColor(index)} rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs`}>
                      {(index + 1)}
                    </div>
                    <span className="text-sm text-white truncate flex-1">{player.username || `Player ${index + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bingo Board - Compact */}
          <div className="lg:col-span-3">
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-bold text-white mb-4 text-center">Bingo Board</h3>
              
              {/* BINGO Header */}
              <div className="grid grid-cols-5 gap-0.5 mb-2 w-full">
                {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                  <div key={letter} className={`text-center font-bold text-sm ${
                    ['text-red-400', 'text-blue-400', 'text-green-400', 'text-yellow-400', 'text-purple-400'][index]
                  }`}>
                    {letter}
                  </div>
                ))}
              </div>

              {/* Numbers Grid - Fits horizontally under BINGO (fixed height) */}
              <div className="grid grid-cols-5 gap-0.5 mb-3 w-full h-[420px] md:h-[520px]">
                {Object.entries(bingoNumbers).map(([letter, numbers]) => (
                  <div key={letter} className="grid" style={{ gridTemplateRows: 'repeat(15, minmax(0, 1fr))', rowGap: '2px' }}>
                    {numbers.map((number) => {
                      const isCalled = calledNumbers.includes(number)
                      const isLatest = latestNumber?.number === number
                      const playerIndex = playerMarkings.get(number)
                      const playerColor = playerIndex !== undefined ? playerColors[playerIndex % playerColors.length] : null
                      
                      return (
                        <div
                          key={number}
                          className={`
                            w-full h-full flex items-center justify-center rounded text-[10px] sm:text-xs font-bold transition-all duration-300 relative
                            ${isLatest 
                              ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg scale-110 animate-pulse' 
                              : isCalled && playerColor
                              ? `bg-gradient-to-br ${playerColor} text-white shadow-sm`
                              : isCalled
                              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                            }
                          `}
                          title={playerIndex !== undefined ? `Marked by Player ${playerIndex + 1}` : ''}
                        >
                          {number}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded"></div>
                  <span className="text-slate-300">Called (No Player)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded"></div>
                  <span className="text-slate-300">Latest</span>
                </div>
                <div className="text-slate-400">•</div>
                {players.slice(0, 4).map((player, index) => (
                  <div key={player.id} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 bg-gradient-to-br ${playerColors[index % playerColors.length]} rounded`}></div>
                    <span className="text-slate-300">{player.username}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Called Numbers History - Compact */}
            <div className="mt-4 bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-bold text-white mb-3">History ({calledNumbers.length})</h3>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {calledNumbers.slice().reverse().map((number, index) => {
                  const letter = number <= 15 ? 'B' : number <= 30 ? 'I' : number <= 45 ? 'N' : number <= 60 ? 'G' : 'O'
                  return (
                    <div
                      key={`${number}-${index}`}
                      className={`
                        px-2 py-1 rounded text-xs font-bold whitespace-nowrap
                        ${index === 0 
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' 
                          : 'bg-slate-700/50 text-slate-300'
                        }
                      `}
                    >
                      {letter}-{number}
                    </div>
                  )
                })}
              </div>
              {calledNumbers.length === 0 && (
                <p className="text-slate-400 text-center py-4 text-sm">No numbers called yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
