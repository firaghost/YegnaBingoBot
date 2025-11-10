"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

interface LeaderboardEntry {
  id: string
  username: string
  games_won: number
  total_winnings: number
  games_played: number
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all')

  useEffect(() => {
    fetchLeaderboard()
  }, [period])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('users')
        .select('id, username, games_won, total_winnings, games_played')
        .order('total_winnings', { ascending: false })
        .limit(10)

      const { data, error } = await query

      if (error) throw error
      setLeaderboard(data || [])
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/lobby" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Lobby
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4 text-gray-800">
          🏆 Leaderboard
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Top players competing for glory and prizes!
        </p>

        {/* Period Selector */}
        <div className="flex justify-center gap-4 mb-12">
          {[
            { label: 'Daily', value: 'daily' as const },
            { label: 'Weekly', value: 'weekly' as const },
            { label: 'Monthly', value: 'monthly' as const },
            { label: 'All Time', value: 'all' as const }
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                period === p.value
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Table Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="grid grid-cols-12 gap-4 font-bold text-sm md:text-base">
                <div className="col-span-1">Rank</div>
                <div className="col-span-3">Player</div>
                <div className="col-span-2 text-center">Wins</div>
                <div className="col-span-2 text-center">Games</div>
                <div className="col-span-2 text-center">Win Rate</div>
                <div className="col-span-2 text-right">Winnings</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : leaderboard.map((player, index) => (
                <div 
                  key={player.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-4 items-center text-sm md:text-base">
                    <div className="col-span-1">
                      <div className={`text-2xl font-bold ${
                        index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                        index === 2 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {getMedalEmoji(index + 1)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          index < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                          'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}>
                          {player.username.charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-800 truncate">{player.username}</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-bold text-green-600">{player.games_won}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-gray-600">{player.games_played}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-semibold text-blue-600">
                        {player.games_played > 0 ? ((player.games_won / player.games_played) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-bold text-purple-600">{formatCurrency(player.total_winnings)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-6xl mb-4">🏆</div>
              <p className="text-xl">No leaderboard data yet</p>
              <p className="text-sm mt-2">Be the first to make the list!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
