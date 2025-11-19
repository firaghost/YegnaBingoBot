"use client"

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type BasicUser = { id: string; username: string }

export default function AdminGamesPage() {
  const [allGames, setAllGames] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    filterGames()
    setCurrentPage(1)
  }, [filter, searchTerm, allGames])

  const fetchGames = async () => {
    try {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      const { data, error } = await supabase
        .from('games')
        .select(`
          id, status, created_at, started_at, ended_at, game_status,
          players, called_numbers, winner_id, latest_number, prize_pool,
          rooms (name, stake)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const gamesRaw = data || []

      // Build a unique set of user IDs (first 5 players per game + winners) to fetch once
      const idSet = new Set<string>()
      for (const g of gamesRaw) {
        if (Array.isArray(g.players)) {
          const top5 = g.players.slice(0, 5)
          for (const pid of top5) idSet.add(pid)
        }
        if (g.winner_id) idSet.add(g.winner_id)
      }
      let userMap = new Map<string, any>()
      if (idSet.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, username')
          .in('id', Array.from(idSet))
        if (users) userMap = new Map((users as BasicUser[]).map((u) => [u.id, u]))
      }

      // First pass: compute lightweight list and update UI immediately
      const baseList = gamesRaw.map((game: any) => {
        // Use the new game_status column from database
        let displayStatus = game.game_status

        // Fallback detection when game_status missing
        if (!displayStatus) {
          const isCanceled = game.status === 'finished' &&
            (!game.started_at || !game.ended_at) &&
            (!game.players || game.players.length === 0) &&
            (!game.called_numbers || game.called_numbers.length === 0) &&
            !game.winner_id

          const isIncomplete = game.status === 'finished' &&
            game.started_at &&
            game.ended_at &&
            !game.winner_id &&
            game.players &&
            game.players.length > 0

          if (isCanceled) displayStatus = 'finished_canceled'
          else if (isIncomplete) displayStatus = 'finished_no_winner'
          else if (game.status === 'finished' && game.winner_id) displayStatus = 'finished_winner'
          else displayStatus = game.status
        }

        // Safety: hide impossible "active" rows (0 players and no calls/latest) to prevent double-counting in Waiting
        const calledCount = Array.isArray(game.called_numbers) ? game.called_numbers.length : 0
        const playerCount = Array.isArray(game.players) ? game.players.length : 0
        const hasLatest = !!game.latest_number
        const impossibleActive = (game.status === 'active') && (playerCount === 0) && (calledCount === 0) && !hasLatest
        if (impossibleActive) return null

        // Hide empty waiting rows (0 players) to avoid showing phantom waiting games
        if (game.status === 'waiting' && playerCount === 0) return null

        // Remove empty canceled games from the UI (never started, no players, no calls)
        const shouldHide = game.status === 'finished' &&
          (!game.started_at || !game.ended_at) &&
          (!game.players || game.players.length === 0) &&
          (!game.called_numbers || game.called_numbers.length === 0) &&
          !game.winner_id
        if (shouldHide) return null

        return {
          ...game,
          player_count: playerCount,
          player_details: [],
          winner_info: null,
          display_status: displayStatus,
          net_prize: game.net_prize || 0,
        }
      }).filter(Boolean) as any[]

      // Update UI fast with base list
      setAllGames(baseList)

      // Second pass: enrich with usernames (non-blocking)
      const gamesWithDetails = baseList.map((game: any) => {
        const playerDetails = (Array.isArray(game.players) ? game.players : [])
          .slice(0, 5)
          .map((id: string) => userMap.get(id))
          .filter(Boolean)
        const winnerInfo = game.winner_id ? userMap.get(game.winner_id) || null : null
        return { ...game, player_details: playerDetails, winner_info: winnerInfo }
      })

      setAllGames(gamesWithDetails)
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  const filterGames = () => {
    let filtered = allGames

    if (filter !== 'all') {
      if (filter === 'finished') {
        filtered = filtered.filter(g => g.display_status === 'finished_winner' || g.display_status === 'finished_no_winner')
      } else if (filter === 'waiting' || filter === 'countdown' || filter === 'active') {
        // Match DB exactly for live states
        filtered = filtered.filter(g => g.status === filter)
        if (filter === 'waiting') {
          filtered = filtered.filter(g => (g.player_count || 0) > 0)
        }
      } else {
        filtered = filtered.filter(g => g.display_status === filter)
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(g =>
        g.rooms?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Deduplicate by id (safety)
    const seen = new Set<string>()
    const unique = filtered.filter((g) => {
      if (seen.has(g.id)) return false
      seen.add(g.id)
      return true
    })

    setGames(unique)
  }

  const totalPages = Math.ceil(games.length / pageSize)
  const paginatedGames = games.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Calculate stats
  const stats = {
    total: allGames.length,
    waiting: allGames.filter(g => g.status === 'waiting' && (g.player_count || 0) > 0).length,
    countdown: allGames.filter(g => g.status === 'countdown').length,
    active: allGames.filter(g => g.status === 'active').length,
    finished: allGames.filter(g => g.display_status === 'finished_winner' || g.display_status === 'finished_no_winner').length,
    totalPrize: allGames.reduce((sum, g) => sum + (g.prize_pool || 0), 0),
    totalPlayers: allGames.reduce((sum, g) => sum + (g.player_count || 0), 0),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-white">Game Monitoring</h1>
            </div>
            <button
              onClick={fetchGames}
              className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors border border-cyan-500/30 flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700/50 p-3 sm:p-4 hover:border-slate-600/50 transition-all">
            <div className="text-xs text-slate-400 mb-1">Total Games</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">{stats.totalPlayers} players</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/30 to-slate-900 rounded-lg border border-yellow-700/30 p-3 sm:p-4 hover:border-yellow-600/50 transition-all">
            <div className="text-xs text-yellow-400 mb-1">Waiting</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.waiting}</div>
            <div className="text-xs text-yellow-600 mt-1">Ready to start</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 rounded-lg border border-emerald-700/30 p-3 sm:p-4 hover:border-emerald-600/50 transition-all">
            <div className="text-xs text-emerald-400 mb-1">Active</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.active}</div>
            <div className="text-xs text-emerald-600 mt-1">In progress</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-900/30 to-slate-900 rounded-lg border border-cyan-700/30 p-3 sm:p-4 hover:border-cyan-600/50 transition-all">
            <div className="text-xs text-cyan-400 mb-1">Finished</div>
            <div className="text-xl sm:text-2xl font-bold text-cyan-400">{stats.finished}</div>
            <div className="text-xs text-cyan-600 mt-1">{formatCurrency(stats.totalPrize)}</div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search room name or game ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            <div className="flex gap-2 flex-wrap">
              {['all', 'waiting', 'countdown', 'active', 'finished'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm ${
                    filter === status
                      ? 'bg-cyan-600/80 text-white border border-cyan-500/50'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Games List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-12 text-center">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading games...</p>
            </div>
          ) : paginatedGames.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-12 text-center text-slate-400">
              No games found
            </div>
          ) : (
            paginatedGames.map((game: any) => {
              const isCanceled = game.display_status === 'finished_canceled'
              const isNoWinner = game.display_status === 'finished_no_winner'
              const isFinishedWinner = game.display_status === 'finished_winner'

              // Badge status: prefer raw status; otherwise derive from counts, but NEVER override finished
              const calledCount = Array.isArray(game.called_numbers) ? game.called_numbers.length : 0
              const playerCount = typeof game.player_count === 'number' ? game.player_count : (Array.isArray(game.players) ? game.players.length : 0)
              const isFinishedDisplay = typeof game.display_status === 'string' && game.display_status.startsWith('finished')
              const isFinishedRaw = game.status === 'finished' || !!game.winner_id || !!game.ended_at || isFinishedDisplay
              let liveStatus: 'waiting' | 'countdown' | 'active' | null = null
              if (!isFinishedRaw) {
                if (game.status === 'waiting' || game.status === 'countdown' || game.status === 'active') {
                  liveStatus = game.status as 'waiting' | 'countdown' | 'active'
                } else if (!isCanceled && !isNoWinner && !isFinishedWinner) {
                  // Heuristic for new schemas only when not finished
                  if (calledCount > 0) liveStatus = 'active'
                  else if (playerCount > 0) liveStatus = 'waiting'
                }
              }
              const finishedKey = game.winner_id ? 'finished_winner' : 'finished_no_winner'
              const badgeKey = liveStatus ?? (isCanceled ? 'finished_canceled' : isNoWinner ? 'finished_no_winner' : isFinishedWinner ? 'finished_winner' : isFinishedRaw ? finishedKey : 'other')
              const badgeText = liveStatus
                ? (liveStatus.charAt(0).toUpperCase() + liveStatus.slice(1))
                : (isCanceled ? 'Canceled' : isNoWinner ? 'No Winner' : isFinishedWinner ? 'Finished' : isFinishedRaw ? (game.winner_id ? 'Finished' : 'No Winner') : 'Other')

              return (
              <div key={game.id} className={`bg-slate-800/50 backdrop-blur-md rounded-lg border p-4 transition-all ${
                isCanceled ? 'border-orange-500/50 shadow-lg shadow-orange-500/20' :
                isNoWinner ? 'border-red-500/50 shadow-lg shadow-red-500/20' :
                (liveStatus === 'active') ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/20' :
                isFinishedWinner ? 'border-cyan-500/30' :
                'border-slate-700/50'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Game Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base">{game.rooms?.name || 'Unknown Room'}</h3>
                        <p className="text-xs text-slate-400">{formatCurrency(game.rooms?.stake || 0)} entry</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                        badgeKey === 'finished_canceled' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        badgeKey === 'finished_no_winner' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        badgeKey === 'waiting' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        badgeKey === 'countdown' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        badgeKey === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse' :
                        'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                      }`}>
                        {badgeText}
                      </span>
                    </div>
                    
                    {/* Players List */}
                    <div className="mt-2">
                      <p className="text-xs text-slate-400 mb-1">{game.player_count} Players:</p>
                      <div className="flex flex-wrap gap-1">
                        {game.player_details && game.player_details.slice(0, 5).map((player: any) => (
                          <span key={player.id} className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-xs rounded border border-slate-600/50">
                            {player.username}
                          </span>
                        ))}
                        {game.player_count > 5 && (
                          <span className="px-2 py-0.5 bg-slate-700/50 text-slate-400 text-xs rounded border border-slate-600/50">
                            +{game.player_count - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Game Details */}
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Numbers Called:</span>
                        <p className="text-slate-300 font-semibold">{Array.isArray(game.called_numbers) ? game.called_numbers.length : 0}/75</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Prize Pool:</span>
                        <p className="text-cyan-400 font-semibold">{formatCurrency(game.prize_pool || 0)}</p>
                      </div>
                      {game.winner_info && (
                        <div>
                          <span className="text-slate-500">Winner:</span>
                          <p className="text-emerald-400 font-semibold">{game.winner_info.username}</p>
                        </div>
                      )}
                      {game.winner_info && game.net_prize > 0 && (
                        <div>
                          <span className="text-slate-500">Prize Won:</span>
                          <p className="text-emerald-300 font-bold">{formatCurrency(game.net_prize)}</p>
                        </div>
                      )}
                      {game.latest_number && (
                        <div>
                          <span className="text-slate-500">Latest:</span>
                          <p className="text-blue-400 font-semibold">{game.latest_number.letter}-{game.latest_number.number}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    {(!isFinishedRaw && liveStatus === 'active') && (
                      <Link
                        href={`/mgmt-portal-x7k9p2/games/${game.id}`}
                        className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-4 py-2 rounded-lg font-semibold transition-colors border border-emerald-500/30 text-sm text-center"
                      >
                        Watch Live
                      </Link>
                    )}
                    {(game.display_status === 'finished_winner' || (game.status === 'finished' && game.winner_id)) && (
                      <Link
                        href={`/mgmt-portal-x7k9p2/games/${game.id}?view=history`}
                        className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-4 py-2 rounded-lg font-semibold transition-colors border border-cyan-500/30 text-sm text-center"
                      >
                        View History
                      </Link>
                    )}
                    {isCanceled && (
                      <div className="bg-orange-600/20 text-orange-400 px-4 py-2 rounded-lg text-sm text-center border border-orange-500/30 font-semibold">
                        Game Canceled
                      </div>
                    )}
                    {isNoWinner && (
                      <div className="bg-red-600/20 text-red-400 px-4 py-2 rounded-lg text-sm text-center border border-red-500/30 font-semibold">
                        No Winner
                      </div>
                    )}
                    <p className="text-xs text-slate-500 text-center sm:text-right">
                      {new Date(game.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 mt-6 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">
              Page {currentPage} of {totalPages} ({games.length} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-slate-700/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600/50 transition-colors text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded bg-slate-700/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600/50 transition-colors text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
