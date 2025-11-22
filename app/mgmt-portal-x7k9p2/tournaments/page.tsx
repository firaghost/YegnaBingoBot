"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { formatCurrency } from '@/lib/utils'

interface AdminTournamentRow {
  id: string
  name: string
  type: string
  status: string
  is_enabled: boolean
  start_at: string
  end_at: string
  prize_mode: string
  prize_config: any
  eligibility: any
  settings: any
  metrics_summary?: {
    total_deposits: number
    total_plays: number
    participants: number
  }
  winners?: Array<{
    user_id: string
    rank: number
    metric: string
    prize_amount: number
    paid: boolean
    paid_at: string | null
    metric_value: number
  }>
}

export default function AdminTournamentsPage() {
  const { admin, loading: adminLoading } = useAdminAuth()
  const [loading, setLoading] = useState(false)
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([])
  const [selected, setSelected] = useState<AdminTournamentRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [previewWinners, setPreviewWinners] = useState<any[] | null>(null)
  const [winnersFor, setWinnersFor] = useState<AdminTournamentRow | null>(null)
  const [extraAward, setExtraAward] = useState<{ userId: string; metric: string; rank: number; amount: string } | null>(null)
  const [awardingExtra, setAwardingExtra] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (adminLoading) return
    if (!admin) return
    fetchTournaments()
  }, [adminLoading, admin])

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const fetchTournaments = async () => {
    if (!admin) return
    try {
      setLoading(true)
      const res = await fetch('/api/admin/tournaments', {
        headers: { 'x-admin-id': admin.id },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load tournaments')
      setTournaments(Array.isArray(json.data) ? json.data : [])
    } catch (e: any) {
      console.error('Error loading tournaments:', e)
      showNotification('error', e.message || 'Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row?: AdminTournamentRow) => {
    setWinnersFor(null)
    setPreviewWinners(null)
    if (row) {
      setSelected(row)
      setCreating(false)
    } else {
      const now = new Date()
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      setSelected({
        id: '',
        name: '',
        type: 'weekly',
        status: 'upcoming',
        is_enabled: true,
        start_at: now.toISOString(),
        end_at: end.toISOString(),
        prize_mode: 'fixed',
        prize_config: {
          mode: 'fixed',
          deposits: { positions: [{ rank: 1, amount: 500 }] },
          plays: { positions: [{ rank: 1, amount: 300 }] },
        },
        eligibility: {
          min_deposit_total: 10,
          min_plays: 5,
          require_deposit: true,
        },
        settings: {
          display_name: 'Weekly Showdown',
          prize_label: 'Top depositor 500 ETB, Most played 300 ETB',
          eligibility_label: 'Deposit 10 ETB and play 5 games to qualify',
        },
        metrics_summary: { total_deposits: 0, total_plays: 0, participants: 0 },
        winners: [],
      })
      setCreating(true)
    }
  }

  const handleSave = async () => {
    if (!admin || !selected) return
    if (!selected.name) {
      showNotification('error', 'Tournament name is required')
      return
    }
    try {
      setSaving(true)
      const action = creating ? 'create' : 'update'
      const payload = {
        action,
        id: creating ? undefined : selected.id,
        tournament: {
          name: selected.name,
          type: selected.type,
          status: selected.status,
          is_enabled: selected.is_enabled,
          start_at: selected.start_at,
          end_at: selected.end_at,
          prize_mode: selected.prize_mode,
          prize_config: selected.prize_config,
          eligibility: selected.eligibility,
          settings: selected.settings,
        },
      }

      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save tournament')
      showNotification('success', creating ? 'Tournament created' : 'Tournament updated')
      setSelected(null)
      setCreating(false)
      fetchTournaments()
    } catch (e: any) {
      console.error('Error saving tournament:', e)
      showNotification('error', e.message || 'Failed to save tournament')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLive = async (row: AdminTournamentRow, live: boolean) => {
    if (!admin) return
    try {
      const payload: any = {
        action: 'toggle',
        id: row.id,
        is_enabled: live,
        status: live ? 'live' : 'ended',
      }
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to toggle tournament')
      showNotification('success', live ? 'Tournament set to Live' : 'Tournament ended')
      fetchTournaments()
    } catch (e: any) {
      console.error('Error toggling tournament:', e)
      showNotification('error', e.message || 'Failed to toggle tournament')
    }
  }

  const handlePreviewFinalize = async (row: AdminTournamentRow) => {
    if (!admin) return
    try {
      setFinalizing(true)
      setWinnersFor(row)
      setPreviewWinners(null)
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({ action: 'preview_finalize', id: row.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to preview winners')
      setPreviewWinners(json.preview || [])
    } catch (e: any) {
      console.error('Error previewing finalize:', e)
      showNotification('error', e.message || 'Failed to preview winners')
    } finally {
      setFinalizing(false)
    }
  }

  const handleExtraAwardSubmit = async () => {
    if (!admin || !winnersFor || !extraAward) return
    const amountNum = Number(extraAward.amount || 0)
    if (!amountNum || amountNum <= 0) {
      showNotification('error', 'Enter a valid extra prize amount')
      return
    }

    try {
      setAwardingExtra(true)
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({
          action: 'manual_award',
          tournamentId: winnersFor.id,
          userId: extraAward.userId,
          amount: amountNum,
          metric: extraAward.metric,
          rank: extraAward.rank,
          reason: 'extra_prize',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to award extra prize')
      showNotification('success', 'Extra prize awarded')
      setExtraAward(null)
      fetchTournaments()
    } catch (e: any) {
      console.error('Error awarding extra prize:', e)
      showNotification('error', e.message || 'Failed to award extra prize')
    } finally {
      setAwardingExtra(false)
    }
  }

  const handleFinalize = async (row: AdminTournamentRow) => {
    if (!admin) return
    try {
      setFinalizing(true)
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({ action: 'finalize', id: row.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to finalize tournament')
      showNotification('success', 'Tournament finalized and prizes credited')
      setPreviewWinners(null)
      setWinnersFor(null)
      fetchTournaments()
    } catch (e: any) {
      console.error('Error finalizing tournament:', e)
      showNotification('error', e.message || 'Failed to finalize tournament')
    } finally {
      setFinalizing(false)
    }
  }

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        Loading admin session…
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Admin Login Required</h1>
          <p className="text-slate-400">Please sign in to manage tournaments.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/mgmt-portal-x7k9p2" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Tournament Management</h1>
              <p className="text-xs text-slate-400 mt-1">
                Configure tournaments, start/end events, and automate prize payouts.
              </p>
            </div>
          </div>
          <button
            onClick={fetchTournaments}
            className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors border border-cyan-500/40 text-xs sm:text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center">
          <button
            onClick={() => handleEdit(undefined)}
            className="bg-emerald-600/80 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Tournament</span>
          </button>
          <p className="text-xs text-slate-400 max-w-xl">
            Only <span className="font-semibold text-emerald-300">Live</span> and <span className="font-semibold text-slate-100">enabled</span> tournaments
            are visible in the player lobby. Use finalize to automatically credit prizes to winners.
          </p>
        </div>

        {/* Tournaments list */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/60 p-3 sm:p-4 space-y-3">
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Loading tournaments…</div>
          ) : tournaments.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No tournaments configured yet.</div>
          ) : (
            tournaments.map((t) => {
              const metrics = t.metrics_summary || { total_deposits: 0, total_plays: 0, participants: 0 }
              const isLive = t.status === 'live' && t.is_enabled
              const isUpcoming = t.status === 'upcoming'
              const isEnded = t.status === 'ended'
              return (
                <div
                  key={t.id}
                  className={`rounded-lg border px-3 py-3 sm:px-4 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center ${
                    isLive
                      ? 'border-emerald-500/40 bg-emerald-900/10'
                      : isUpcoming
                      ? 'border-amber-500/30 bg-amber-900/5'
                      : isEnded
                      ? 'border-slate-600/40 bg-slate-900/40'
                      : 'border-slate-700/50 bg-slate-900/40'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md">
                        {t.settings?.display_name || t.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-600/60 text-slate-200 uppercase tracking-[0.12em]">
                        {t.type}
                      </span>
                      {isLive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          Live
                        </span>
                      )}
                      {isUpcoming && !isLive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/40">
                          Upcoming
                        </span>
                      )}
                      {isEnded && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/40 text-slate-200 border border-slate-500/40">
                          Ended
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-2">
                      <span>
                        Start: {new Date(t.start_at).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>
                        End: {new Date(t.end_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-300">
                      <span>Participants: {metrics.participants}</span>
                      <span>|</span>
                      <span>Total plays: {metrics.total_plays}</span>
                      <span>|</span>
                      <span>Total deposits: {formatCurrency(metrics.total_deposits)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleEdit(t)}
                      className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleLive(t, !isLive)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border ${
                        isLive
                          ? 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                          : 'bg-emerald-600/80 text-white border-emerald-500/80 hover:bg-emerald-700'
                      }`}
                    >
                      {isLive ? 'End Tournament' : 'Set Live'}
                    </button>
                    <button
                      onClick={() => handlePreviewFinalize(t)}
                      className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-cyan-600/80 text-white border border-cyan-500/80 hover:bg-cyan-700"
                    >
                      Preview Winners
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Edit / Create Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 py-8">
            <div className="bg-slate-900 rounded-2xl border border-slate-700/70 max-w-3xl w-full max-h-full overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {creating ? 'Create Tournament' : 'Edit Tournament'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure schedule, prizes, and eligibility. Players only see Live + enabled tournaments.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelected(null)
                    setCreating(false)
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Name</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => setSelected({ ...(selected as any), name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/70"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Display Name (Lobby)</label>
                  <input
                    type="text"
                    value={selected.settings?.display_name || ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        settings: { ...(selected.settings || {}), display_name: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/70"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Type</label>
                  <select
                    value={selected.type}
                    onChange={(e) => setSelected({ ...(selected as any), type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Prize Copy (Lobby)</label>
                  <input
                    type="text"
                    value={selected.settings?.prize_label || ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        settings: { ...(selected.settings || {}), prize_label: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/70"
                    placeholder="e.g. Top depositor 500 ETB, Most played 300 ETB"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Eligibility Copy (Lobby)</label>
                  <input
                    type="text"
                    value={selected.settings?.eligibility_label || ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        settings: { ...(selected.settings || {}), eligibility_label: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/70"
                    placeholder="e.g. Deposit 10 ETB & play 5 games to qualify"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Start At</label>
                  <input
                    type="datetime-local"
                    value={selected.start_at.slice(0, 16)}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        start_at: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">End At</label>
                  <input
                    type="datetime-local"
                    value={selected.end_at.slice(0, 16)}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        end_at: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Enabled</label>
                  <button
                    type="button"
                    onClick={() => setSelected({ ...(selected as any), is_enabled: !selected.is_enabled })}
                    className={`w-full h-9 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                      selected.is_enabled
                        ? 'bg-emerald-600/80 border-emerald-500/80 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {selected.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-300 text-xs font-medium">Prize Mode</label>
                  <select
                    value={selected.prize_mode}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        prize_mode: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="fixed">Fixed Amounts</option>
                    <option value="percentage">% of Deposits</option>
                  </select>
                </div>
              </div>

              {/* Simple prize + eligibility config (top1 only for now) */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Top Depositor Prize (Rank 1)</label>
                  <input
                    type="number"
                    value={selected.prize_config?.deposits?.positions?.[0]?.amount || ''}
                    onChange={(e) => {
                      const amt = Number(e.target.value || 0)
                      const pc = { ...(selected.prize_config || {}) }
                      const dep = pc.deposits || { positions: [{ rank: 1, amount: 0 }] }
                      if (!Array.isArray(dep.positions) || dep.positions.length === 0) {
                        dep.positions = [{ rank: 1, amount: amt }]
                      } else {
                        dep.positions[0] = { rank: 1, amount: amt }
                      }
                      pc.deposits = dep
                      setSelected({ ...(selected as any), prize_config: pc })
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Most Played Prize (Rank 1)</label>
                  <input
                    type="number"
                    value={selected.prize_config?.plays?.positions?.[0]?.amount || ''}
                    onChange={(e) => {
                      const amt = Number(e.target.value || 0)
                      const pc = { ...(selected.prize_config || {}) }
                      const plays = pc.plays || { positions: [{ rank: 1, amount: 0 }] }
                      if (!Array.isArray(plays.positions) || plays.positions.length === 0) {
                        plays.positions = [{ rank: 1, amount: amt }]
                      } else {
                        plays.positions[0] = { rank: 1, amount: amt }
                      }
                      pc.plays = plays
                      setSelected({ ...(selected as any), prize_config: pc })
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Min Deposit (Eligibility)</label>
                  <input
                    type="number"
                    value={selected.eligibility?.min_deposit_total ?? ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        eligibility: {
                          ...(selected.eligibility || {}),
                          min_deposit_total: Number(e.target.value || 0),
                        },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setCreating(false)
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 border border-emerald-500/80"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Winners Drawer */}
        {winnersFor && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 py-6">
            <div className="bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-700/70 max-w-lg w-full max-h-full overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Tournament Winners</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {winnersFor.settings?.display_name || winnersFor.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setWinnersFor(null)
                    setPreviewWinners(null)
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              {/* Existing winners (if any) */}
              <div className="space-y-2 text-[11px] sm:text-xs text-slate-200">
                <h3 className="font-semibold text-slate-100">Existing Winners</h3>
                {Array.isArray(winnersFor.winners) && winnersFor.winners.length > 0 ? (
                  winnersFor.winners.map((w, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span>
                          {w.metric === 'deposits' ? 'Top Depositor' : 'Most Played'} #{w.rank}
                        </span>
                        <span className="text-[10px] text-slate-400">User: {w.user_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-300">{formatCurrency(w.prize_amount)}</span>
                        {w.paid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Paid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-200 border border-amber-500/40">
                            Pending
                          </span>
                        )}
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700"
                          onClick={() =>
                            setExtraAward({
                              userId: w.user_id,
                              metric: w.metric,
                              rank: w.rank,
                              amount: extraAward && extraAward.userId === w.user_id && extraAward.metric === w.metric && extraAward.rank === w.rank ? extraAward.amount : '',
                            })
                          }
                        >
                          Extra Prize
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-500">No winners recorded yet.</p>
                )}
              </div>

              {extraAward && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-[11px] sm:text-xs text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>
                      Extra prize for {extraAward.metric === 'deposits' ? 'Top Depositor' : 'Most Played'} #{extraAward.rank}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      User: {extraAward.userId}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={extraAward.amount}
                      onChange={(e) =>
                        setExtraAward({
                          ...(extraAward as any),
                          amount: e.target.value,
                        })
                      }
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/70"
                      placeholder="Extra prize amount (ETB)"
                    />
                    <button
                      type="button"
                      disabled={awardingExtra}
                      onClick={handleExtraAwardSubmit}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 border border-emerald-500/80"
                    >
                      {awardingExtra ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              {/* Preview winners from current metrics */}
              {previewWinners && previewWinners.length > 0 && (
                <div className="pt-3 border-t border-slate-700 space-y-2">
                  <h3 className="text-[11px] sm:text-xs font-semibold text-slate-100">Preview (if finalized now)</h3>
                  <div className="text-[11px] sm:text-xs text-slate-200 space-y-1">
                    {previewWinners.map((w: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>
                          {w.metric === 'deposits' ? 'Top Depositor' : 'Most Played'} #{w.rank}
                        </span>
                        <span className="font-semibold text-emerald-300">{formatCurrency(w.prize)}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={finalizing}
                    onClick={() => winnersFor && handleFinalize(winnersFor)}
                    className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 border border-cyan-500/80 w-full"
                  >
                    {finalizing ? 'Finalizing…' : 'Finalize & Pay Prizes'}
                  </button>
                </div>
              )}

              {!previewWinners && (
                <button
                  type="button"
                  disabled={finalizing}
                  onClick={() => handlePreviewFinalize(winnersFor)}
                  className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600 w-full"
                >
                  {finalizing ? 'Loading…' : 'Refresh Preview from Metrics'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
