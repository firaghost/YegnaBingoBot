"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import BottomNav from '@/app/components/BottomNav'
import { LuTrophy, LuCrown, LuMedal, LuAward } from 'react-icons/lu'
import { useAuth } from '@/lib/hooks/useAuth'

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
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily')
  const { user } = useAuth()

  useEffect(() => {
    fetchLeaderboard()
  }, [period])

  // Ensure Telegram Mini App expands like other pages
  useEffect(() => {
    try { (window as any)?.Telegram?.WebApp?.expand?.() } catch {}
  }, [])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      
      // Rank by games played for now to match the requested layout (top 10)
      let query = supabase
        .from('users')
        .select('id, username, games_won, total_winnings, games_played')
        .order('games_played', { ascending: false })
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
  
  const myRow = leaderboard.find(p => p.id === user?.id || p.username === (user?.username || ''))
  const myPlayed = myRow?.games_played ?? (user as any)?.games_played ?? 0
  const myRankIdx = leaderboard.findIndex(p => p.id === user?.id || p.username === (user?.username || ''))
  const myRankLabel = myRankIdx >= 0 ? `#${myRankIdx + 1}` : 'Unranked'

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuTrophy className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold text-slate-900">Leaderboard</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Status card with gradient */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-4 mb-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            {(() => {
              const me: any = user || {}
              const meImg = me.avatar_url || me.profile_image_url || me.photo_url || null
              return meImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meImg} alt="me" className="w-10 h-10 rounded-full object-cover border-2 border-white" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 text-white text-sm font-semibold flex items-center justify-center">
                  {user?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )
            })()}
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user?.username || 'Player'}</span>
              <span className="text-xs text-white/80">{myPlayed} Played</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{myRankLabel}</span>
            <LuTrophy className="w-5 h-5 text-yellow-300" />
          </div>
        </div>

        {/* Period chips */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 mb-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Daily', value: 'daily' as const },
              { label: 'Weekly', value: 'weekly' as const },
              { label: 'Monthly', value: 'monthly' as const },
              { label: 'All Time', value: 'all' as const }
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top Players list */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Top Players</h3>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaderboard.map((player, index) => (
                <div key={player.id} className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 flex items-center justify-center">
                      {index === 0 ? <LuCrown className="w-4 h-4 text-amber-500" /> : index === 1 ? <LuMedal className="w-4 h-4 text-slate-400" /> : index === 2 ? <LuAward className="w-4 h-4 text-orange-500" /> : <span className="text-xs font-semibold text-slate-600">#{index + 1}</span>}
                    </div>
                    {(() => {
                      const p: any = player
                      const img = p.avatar_url || p.profile_image_url || p.photo_url || null
                      return img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={player.username} className="w-8 h-8 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-xs font-semibold flex items-center justify-center">
                          {player.username?.charAt(0) || '?'}
                        </div>
                      )
                    })()}
                    <span className="font-medium text-slate-900 truncate">{player.username}</span>
                  </div>
                  <div className="text-right text-sm text-slate-600"><span className="font-semibold text-slate-900">{player.games_played}</span> Played</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {leaderboard.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-500">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-base">No leaderboard data yet</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}