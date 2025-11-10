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

      // Get player counts for each game
      const gamesWithPlayers = await Promise.all(
        (data || []).map(async (game) => {
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)

          return { ...game, player_count: count || 0 }
        })
      )

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
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-2xl font-bold text-white">Game Monitoring</h1>
            </div>
            <button
              onClick={fetchGames}
              className="bg-blue-600/80 backdrop-blur text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Filter Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <div className="flex gap-4">
            {['waiting', 'countdown', 'active', 'completed', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  filter === status
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
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
              <div key={game.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Game Info */}
                  <div>
                    <h3 className="font-semibold text-white mb-3">Game Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID:</span>
                        <span className="font-mono text-xs">{game.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Room:</span>
                        <span className="font-semibold">{game.rooms?.name || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Entry Fee:</span>
                        <span className="font-semibold">{formatCurrency(game.entry_fee)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Players & Prize */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Players & Prize</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Players:</span>
                        <span className="font-bold text-blue-600">{game.player_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prize Pool:</span>
                        <span className="font-bold text-green-600">{formatCurrency(game.prize_pool)}</span>
                      </div>
                      {game.winner_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Winner:</span>
                          <span className="font-semibold text-purple-600">✓</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Game Progress */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Progress</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Numbers Called:</span>
                        <span className="font-semibold">
                          {Array.isArray(game.called_numbers) ? game.called_numbers.length : 0} / 75
                        </span>
                      </div>
                      {game.countdown_time > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Countdown:</span>
                          <span className="font-semibold">{game.countdown_time}s</span>
                        </div>
                      )}
                      {game.latest_number && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Latest:</span>
                          <span className="font-bold text-blue-600">
                            {game.latest_number.letter}-{game.latest_number.number}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Timing */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Status & Timing</h3>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Waiting</div>
            <div className="text-3xl font-bold text-yellow-400">
              {games.filter(g => g.status === 'waiting').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Countdown</div>
            <div className="text-3xl font-bold text-blue-400">
              {games.filter(g => g.status === 'countdown').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Active</div>
            <div className="text-3xl font-bold text-green-400">
              {games.filter(g => g.status === 'active').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Completed</div>
            <div className="text-3xl font-bold text-white">
              {games.filter(g => g.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Prize Pool</div>
            <div className="text-3xl font-bold text-purple-400">
              {formatCurrency(games.reduce((sum, g) => sum + (g.prize_pool || 0), 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
