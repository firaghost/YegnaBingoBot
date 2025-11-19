"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type BotStat = {
  id: string
  name: string
  active: boolean
  difficulty: 'easy' | 'medium' | 'hard'
  waiting_mode: 'always_waiting' | 'only_when_assigned'
  win_probability: number
  total_games: number
  wins: number
  losses: number
  win_rate_percent?: number
  avg_game_duration_seconds: number | null
  last_played_at: string | null
  total_earnings?: number
}

export default function BotStatsPage() {
  const [stats, setStats] = useState<BotStat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [q, setQ] = useState('')
  const [filterActive, setFilterActive] = useState<'all'|'active'|'inactive'>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<'all'|'easy'|'medium'|'hard'>('all')
  const [filterWaiting, setFilterWaiting] = useState<'all'|'always_waiting'|'only_when_assigned'>('all')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/bots/stats', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load stats')
        setStats(json.stats || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    let list = stats
    if (q.trim()) list = list.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase()))
    if (filterActive !== 'all') list = list.filter(s => filterActive === 'active' ? s.active : !s.active)
    if (filterDifficulty !== 'all') list = list.filter(s => s.difficulty === filterDifficulty)
    if (filterWaiting !== 'all') list = list.filter(s => s.waiting_mode === filterWaiting)
    return list
  }, [stats, q, filterActive, filterDifficulty, filterWaiting])

  const metrics = useMemo(() => {
    const total = stats.length
    const active = stats.filter(s => s.active).length
    const totalGames = stats.reduce((s, x) => s + (x.total_games || 0), 0)
    const earnings = stats.reduce((s, x) => s + (x.total_earnings || 0), 0)
    const withWL = stats.filter(s => (s.wins || 0) + (s.losses || 0) > 0)
    const avgWinRate = withWL.length ? (withWL.reduce((sum, x) => sum + ((x.wins || 0) / ((x.wins || 0) + (x.losses || 0))), 0) / withWL.length) : 0
    return { total, active, totalGames, earnings, avgWinRate }
  }, [stats])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Bot Statistics</h1>
              <p className="text-gray-300 text-sm">Performance overview and quick filters</p>
            </div>
          </div>
          <Link href="/mgmt-portal-x7k9p2/bots" className="text-blue-300 hover:text-blue-200 underline text-sm">← Manage Bots</Link>
        </div>

        {error && <div className="bg-red-500/20 border border-red-500/40 text-red-200 px-3 py-2 rounded mb-3 text-sm">{error}</div>}
        {loading && <div className="text-gray-300 text-sm mb-3">Loading…</div>}

        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Total Bots</div>
            <div className="text-white text-xl font-bold">{metrics.total}</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Active</div>
            <div className="text-white text-xl font-bold">{metrics.active}</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Total Games</div>
            <div className="text-white text-xl font-bold">{metrics.totalGames.toLocaleString()}</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Avg Win Rate</div>
            <div className="text-white text-xl font-bold">{(metrics.avgWinRate*100).toFixed(1)}%</div>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <div className="text-gray-300 text-xs">Total Earnings</div>
            <div className="text-white text-xl font-bold">{(metrics.earnings || 0).toLocaleString()} ETB</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 border border-white/20 rounded-lg p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name" className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder:text-gray-300" />
          <select value={filterActive} onChange={e=>setFilterActive(e.target.value as any)} className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filterDifficulty} onChange={e=>setFilterDifficulty(e.target.value as any)} className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white">
            <option value="all">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select value={filterWaiting} onChange={e=>setFilterWaiting(e.target.value as any)} className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white">
            <option value="all">All Waiting Modes</option>
            <option value="always_waiting">Always Waiting</option>
            <option value="only_when_assigned">Only When Assigned</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white/10 border border-white/20 rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10 text-gray-300">
                <th className="p-3">Name</th>
                <th className="p-3">Status</th>
                <th className="p-3">Difficulty</th>
                <th className="p-3">Waiting</th>
                <th className="p-3">Win%</th>
                <th className="p-3">Games</th>
                <th className="p-3">W/L</th>
                <th className="p-3">AvgDur(s)</th>
                <th className="p-3">Last Played</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-white/10">
                  <td className="p-3 text-white whitespace-nowrap">{s.name}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-semibold ${s.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-3 text-gray-200 capitalize">{s.difficulty}</td>
                  <td className="p-3 text-gray-200">{s.waiting_mode.replace('_',' ')}</td>
                  <td className="p-3 text-gray-200">{(s.win_rate_percent ?? ((s.wins||0)/Math.max(1,(s.wins||0)+(s.losses||0))*100)).toFixed(1)}%</td>
                  <td className="p-3 text-gray-200">{s.total_games}</td>
                  <td className="p-3 text-gray-200">{s.wins}/{s.losses}</td>
                  <td className="p-3 text-gray-200">{s.avg_game_duration_seconds ?? '-'}</td>
                  <td className="p-3 text-gray-200">{s.last_played_at ? new Date(s.last_played_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-300">No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
