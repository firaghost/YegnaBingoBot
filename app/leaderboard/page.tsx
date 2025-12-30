"use client"

import { useState, useEffect } from 'react'
import { Player } from '@lottiefiles/react-lottie-player'
import { supabase } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { formatCurrency } from '@/lib/utils'
import BottomNav from '@/app/components/BottomNav'
import { LuTrophy } from 'react-icons/lu'
import { useAuth } from '@/lib/hooks/useAuth'

interface LeaderboardEntry {
  id: string
  username: string
  games_won: number
  total_winnings: number
  games_played: number
  avatar_url?: string | null
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily')
  const [view, setView] = useState<'global' | 'tournament'>('global')
  const [tournamentLoading, setTournamentLoading] = useState(false)
  const [tournamentTitle, setTournamentTitle] = useState<string | null>(null)
  const [tournamentDeposits, setTournamentDeposits] = useState<{ username: string; valueLabel: string }[]>([])
  const [tournamentPlays, setTournamentPlays] = useState<{ username: string; valueLabel: string }[]>([])
  const { user } = useAuth()

  useEffect(() => {
    const loadEnabled = async () => {
      try {
        const v = await getConfig('global_leaderboard')
        setEnabled(Boolean(v))
      } catch {
        setEnabled(true)
      }
    }
    void loadEnabled()
  }, [])

  useEffect(() => {
    if (enabled === false) {
      try {
        window.location.href = '/lobby'
      } catch {}
    }
  }, [enabled])

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
      if (enabled === false) {
        setLeaderboard([])
        return
      }
      if (period === 'all') {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, games_won, total_winnings, games_played, avatar_url')
          .order('games_played', { ascending: false })
          .limit(10)

        if (error) throw error
        setLeaderboard(data || [])
        return
      }

      const now = new Date()
      const since = new Date(now.getTime())
      if (period === 'daily') {
        // Last 24 hours
        since.setDate(since.getDate() - 1)
      } else if (period === 'weekly') {
        // Last 7 days
        since.setDate(since.getDate() - 7)
      } else if (period === 'monthly') {
        // Last 30 days
        since.setDate(since.getDate() - 30)
      }

      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('players, ended_at')
        .eq('status', 'finished')
        .gte('ended_at', since.toISOString())
        .order('ended_at', { ascending: false })
        .limit(5000)

      if (gamesError) throw gamesError

      const counts = new Map<string, number>()
      for (const g of games || []) {
        const players: string[] = Array.isArray((g as any).players) ? (g as any).players : []
        for (const pid of players) {
          counts.set(pid, (counts.get(pid) || 0) + 1)
        }
      }

      const entries = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      if (entries.length === 0) {
        // Fallback: no finished games in this window, use all-time stats
        const { data, error } = await supabase
          .from('users')
          .select('id, username, games_won, total_winnings, games_played, avatar_url')
          .order('games_played', { ascending: false })
          .limit(10)

        if (error) throw error
        setLeaderboard(data || [])
        return
      }

      const userIds = entries.map(([id]) => id)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username, games_won, total_winnings, games_played, avatar_url')
        .in('id', userIds)

      if (usersError) throw usersError

      const userMap = new Map<string, any>((users || []).map((u: any) => [u.id, u]))
      const data: LeaderboardEntry[] = entries.map(([id, played]) => {
        const u = userMap.get(id)
        return {
          id,
          username: u?.username || 'Player',
          games_won: Number(u?.games_won || 0),
          total_winnings: Number(u?.total_winnings || 0),
          games_played: played,
          avatar_url: u?.avatar_url || null,
        }
      })

      setLeaderboard(data)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadTournament = async () => {
      try {
        setTournamentLoading(true)
        const res = await fetch('/api/tournaments')
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        const list = Array.isArray(json?.tournaments) ? json.tournaments : []
        const raw = list.find((t: any) => t.status === 'live') || list[0]
        if (!raw) return

        setTournamentTitle(raw.settings?.display_name || raw.name)
        const deps = (raw.topDepositors || raw.top_depositors || []).map((r: any) => ({
          username: r.username || 'player',
          valueLabel: r.valueLabel || '',
        }))
        const plays = (raw.topPlayers || raw.top_players || []).map((r: any) => ({
          username: r.username || 'player',
          valueLabel: r.valueLabel || '',
        }))

        setTournamentDeposits(deps)
        setTournamentPlays(plays)
      } finally {
        setTournamentLoading(false)
      }
    }

    loadTournament()
  }, [])
  
  const myRow = leaderboard.find(p => p.id === user?.id || p.username === (user?.username || ''))
  const myPlayed = myRow?.games_played ?? (user as any)?.games_played ?? 0
  const myRankIdx = leaderboard.findIndex(p => p.id === user?.id || p.username === (user?.username || ''))
  const myRankLabel = myRankIdx >= 0 ? `#${myRankIdx + 1}` : 'Unranked'

  return (
    enabled === false ? null :
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-50">
      {/* Sticky Header */}
      <div
        className="sticky top-0 bg-slate-950 border-b border-slate-800 z-40 shadow-sm safe-top"
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuTrophy className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold text-slate-50">Leaderboard</h1>
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

        {/* Leaderboard view tabs */}
        <div className="bg-slate-900 rounded-xl p-1.5 border border-slate-800 mb-3 flex items-center">
          <button
            onClick={() => setView('global')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              view === 'global'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Global
          </button>
          <button
            onClick={() => setView('tournament')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              view === 'tournament'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tournament
          </button>
        </div>

        {/* Period chips */}
        {view === 'global' && (
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 mb-4">
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
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top Players list */}
        {view === 'global' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-50">Top Players</h3>
            </div>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {leaderboard.map((player, index) => (
                  <div key={player.id} className="px-4 py-3 hover:bg-slate-800 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 flex items-center justify-center">
                        {index === 0 ? (
                          <Player
                            src="/lottie/Gold.json"
                            autoplay
                            loop
                            style={{ width: 40, height: 40 }}
                          />
                        ) : index === 1 ? (
                          <Player
                            src="/lottie/Silver.json"
                            autoplay
                            loop
                            style={{ width: 40, height: 40 }}
                          />
                        ) : index === 2 ? (
                          <Player
                            src="/lottie/Bronz.json"
                            autoplay
                            loop
                            style={{ width: 40, height: 40 }}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                        )}
                      </div>
                      {(() => {
                        const p: any = player
                        const img = p.avatar_url || '/images/6.svg'
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={player.username}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                              const el = e.currentTarget as HTMLImageElement
                              if (!el.src.endsWith('/images/6.svg')) {
                                el.src = '/images/6.svg'
                              }
                            }}
                          />
                        )
                      })()}
                      <span className="font-medium text-slate-50 truncate">{player.username}</span>
                    </div>
                    <div className="text-right text-sm text-slate-300"><span className="font-semibold text-slate-50">{player.games_played}</span> Played</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(tournamentDeposits.length > 0 || tournamentPlays.length > 0) && (
          <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold text-slate-50">Tournament Leaderboard</h3>
                {tournamentTitle && (
                  <span className="text-xs text-slate-400 truncate">{tournamentTitle}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-slate-300 mb-2">Top Depositors</div>
                {tournamentDeposits.length === 0 && tournamentLoading && (
                  <div className="text-xs text-slate-500">Loading...</div>
                )}
                {tournamentDeposits.map((row, index) => (
                  <div key={`${row.username}-${index}`} className="flex items-center justify-between text-xs text-slate-200 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[11px] text-slate-200 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="truncate">@{row.username}</span>
                    </div>
                    <span className="ml-2 whitespace-nowrap font-semibold text-emerald-300">{row.valueLabel}</span>
                  </div>
                ))}
                {tournamentDeposits.length === 0 && !tournamentLoading && (
                  <div className="text-xs text-slate-500">No tournament deposit data yet.</div>
                )}
              </div>
              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-slate-300 mb-2">Most Played</div>
                {tournamentPlays.length === 0 && tournamentLoading && (
                  <div className="text-xs text-slate-500">Loading...</div>
                )}
                {tournamentPlays.map((row, index) => (
                  <div key={`${row.username}-${index}`} className="flex items-center justify-between text-xs text-slate-200 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[11px] text-slate-200 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="truncate">@{row.username}</span>
                    </div>
                    <span className="ml-2 whitespace-nowrap font-semibold text-blue-300">{row.valueLabel}</span>
                  </div>
                ))}
                {tournamentPlays.length === 0 && !tournamentLoading && (
                  <div className="text-xs text-slate-500">No tournament play data yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

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