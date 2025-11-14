"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminGamesPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    fetchGames()
    const interval = setInterval(fetchGames, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [filter])

  const fetchGames = async () => {
    try {
      let query = supabase
        .from('games')
        .select(`
          *,
          rooms (name, stake)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      // Get player counts from the players array in games table
      const gamesWithPlayers = (data || []).map((game) => ({
        ...game,
        player_count: game.players?.length || 0
      }))

      setGames(gamesWithPlayers)
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="text-xl sm:text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-lg sm:text-2xl font-bold text-white">Game Monitoring</h1>
            </div>
            <button
              onClick={fetchGames}
              className="bg-blue-600/80 backdrop-blur text-white px-3 sm:px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Filter Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {['waiting', 'countdown', 'active', 'finished', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 sm:px-6 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  filter === status
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {status === 'finished' ? 'Finished' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Games List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              Loading games...
            </div>
          ) : games.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              No {filter !== 'all' ? filter : ''} games found
            </div>
          ) : (
            games.map((game) => (
              <div key={game.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* Game Info */}
                  <div>
                    <h3 className="font-semibold text-white mb-3">Game Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">ID:</span>
                        <span className="font-mono text-xs text-white">{game.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Room:</span>
                        <span className="font-semibold text-white">{game.rooms?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Entry Fee:</span>
                        <span className="font-semibold text-white">{formatCurrency(game.rooms?.stake || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Players & Prize */}
                  <div>
                    <h3 className="font-semibold text-white mb-3">Players & Prize</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Players:</span>
                        <span className="font-bold text-blue-400">{game.player_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Prize Pool:</span>
                        <span className="font-bold text-green-400">
                          {game.prize_pool > 0 ? formatCurrency(game.prize_pool) : 'Dynamic'}
                        </span>
                      </div>
                      {game.winner_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Winner:</span>
                          <span className="font-semibold text-purple-400">Yes</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Game Progress */}
                  <div>
                    <h3 className="font-semibold text-white mb-3">Progress</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Numbers Called:</span>
                        <span className="font-semibold text-white">
                          {Array.isArray(game.called_numbers) ? game.called_numbers.length : 0} / 75
                        </span>
                      </div>
                      {game.countdown_time > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Countdown:</span>
                          <span className="font-semibold text-white">{game.countdown_time}s</span>
                        </div>
                      )}
                      {game.latest_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Latest:</span>
                          <span className="font-bold text-blue-400">
                            {game.latest_number.letter}-{game.latest_number.number}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div>
                    <h3 className="font-semibold text-white mb-3">Status & Actions</h3>
                    <div className="space-y-3">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          game.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                          game.status === 'countdown' ? 'bg-blue-100 text-blue-700' :
                          game.status === 'active' ? 'bg-green-100 text-green-700 animate-pulse' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {game.status}
                        </span>
                      </div>
                      
                      {/* Live Watch Button - Only for truly active games */}
                      {game.status === 'active' && (
                        <Link
                          href={`/mgmt-portal-x7k9p2/games/${game.id}`}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Watch Live
                        </Link>
                      )}
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Created: {new Date(game.created_at).toLocaleString()}</div>
                        {game.started_at && (
                          <div>Started: {new Date(game.started_at).toLocaleString()}</div>
                        )}
                        {game.ended_at && (
                          <div>Ended: {new Date(game.ended_at).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Waiting</div>
            <div className="text-xl sm:text-3xl font-bold text-yellow-400">
              {games.filter(g => g.status === 'waiting').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Countdown</div>
            <div className="text-xl sm:text-3xl font-bold text-blue-400">
              {games.filter(g => g.status === 'countdown').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Active</div>
            <div className="text-xl sm:text-3xl font-bold text-green-400">
              {games.filter(g => g.status === 'active').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Completed</div>
            <div className="text-xl sm:text-3xl font-bold text-white">
              {games.filter(g => g.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6 col-span-2 sm:col-span-1">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Total Prize Pool</div>
            <div className="text-xl sm:text-3xl font-bold text-purple-400">
              {formatCurrency(games.reduce((sum, g) => sum + (g.prize_pool || 0), 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
