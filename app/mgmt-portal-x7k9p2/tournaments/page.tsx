"use client"

import { useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { formatCurrency } from '@/lib/utils'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import {
  Bell,
  CalendarClock,
  ChevronDown,
  Crown,
  Edit3,
  Filter,
  MoreVertical,
  Plus,
  Search,
  SortAsc,
  Trash2,
} from 'lucide-react'

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
  const [tab, setTab] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminTournamentRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [previewWinners, setPreviewWinners] = useState<any[] | null>(null)
  const [winnersFor, setWinnersFor] = useState<AdminTournamentRow | null>(null)
  const [extraAward, setExtraAward] = useState<{ userId: string; metric: string; rank: number; amount: string } | null>(null)
  const [awardingExtra, setAwardingExtra] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({ title: '', message: '' })

  useEffect(() => {
    if (adminLoading) return
    if (!admin) return
    fetchTournaments()
  }, [adminLoading, admin])

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleDelete = (row: AdminTournamentRow) => {
    if (!admin) return
    setConfirmConfig({
      title: 'Delete tournament',
      message: `Delete "${row.settings?.display_name || row.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const res = await fetch('/api/admin/tournaments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
              body: JSON.stringify({ action: 'delete', id: row.id }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to delete tournament')
            showNotification('success', 'Tournament deleted')
            fetchTournaments()
          } catch (e: any) {
            console.error('Error deleting tournament:', e)
            showNotification('error', e.message || 'Failed to delete tournament')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = tournaments
    if (tab !== 'all') list = list.filter((t) => t.status === tab)
    if (q) {
      list = list.filter((t) => {
        const name = String(t.settings?.display_name || t.name || '').toLowerCase()
        const type = String(t.type || '').toLowerCase()
        return name.includes(q) || type.includes(q)
      })
    }
    return list
  }, [tournaments, tab, search])

  const stats = useMemo(() => {
    const active = tournaments.filter((t) => t.status === 'live' && t.is_enabled).length
    const upcoming = tournaments.filter((t) => t.status === 'upcoming' && t.is_enabled).length
    const playersJoined = tournaments.reduce((sum, t) => sum + Number(t.metrics_summary?.participants || 0), 0)
    const totalPrize = tournaments.reduce((sum, t) => {
      const cfg = (t.prize_config || {}) as any
      const deposits = Array.isArray(cfg?.deposits?.positions)
        ? cfg.deposits.positions.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
        : 0
      const plays = Array.isArray(cfg?.plays?.positions)
        ? cfg.plays.positions.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
        : 0
      return sum + deposits + plays
    }, 0)
    return { active, upcoming, playersJoined, totalPrize }
  }, [tournaments])

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
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center text-[#A0A0A0]">
        Loading admin session…
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <div className="bg-[#252525] border border-[#333333] rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Admin Login Required</h1>
          <p className="text-[#A0A0A0]">Please sign in to manage tournaments.</p>
        </div>
      </div>
    )
  }

  return (
    <AdminShell title="Tournaments">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <AdminConfirmModal
          open={confirmOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={confirmConfig.cancelLabel}
          variant={confirmConfig.variant}
          onConfirm={() => {
            setConfirmOpen(false)
            confirmConfig.onConfirm?.()
          }}
          onCancel={() => setConfirmOpen(false)}
        />

        {/* Notification */}
        {notification && (
          <div
            className={
              'fixed top-4 right-4 z-50 rounded-lg border px-5 py-3 text-sm font-semibold ' +
              (notification.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                : 'bg-red-500/15 text-red-200 border-red-500/30')
            }
          >
            {notification.message}
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">Tournaments Management</h1>
            <p className="text-sm text-[#A0A0A0]">Create, configure and monitor competitive events</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0A0]" />
              <input
                className="h-10 w-64 rounded-lg border border-[#333333] bg-[#252525] pl-10 pr-4 text-sm text-white placeholder-[#A0A0A0] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all"
                placeholder="Search tournaments..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="relative rounded-full bg-[#252525] p-2 text-[#A0A0A0] hover:text-white border border-[#333333] hover:border-white/20 transition-all"
              title="Refresh"
              onClick={fetchTournaments}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#1C1C1C]" />
            </button>
            <button
              type="button"
              className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#C5A028] transition-colors shadow-lg shadow-[#D4AF37]/20"
              onClick={() => handleEdit(undefined)}
            >
              <Plus className="w-4 h-4" />
              Create Tournament
            </button>
          </div>
        </header>

        {/* Stats Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0] uppercase tracking-wider">Active Events</p>
              <Crown className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{stats.active}</span>
              <span className="text-sm font-medium text-green-500">+0 today</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0] uppercase tracking-wider">Total Prize Pool</p>
              <Crown className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{formatCurrency(stats.totalPrize)} ETB</span>
              <span className="text-sm font-medium text-green-500">+0%</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0] uppercase tracking-wider">Players Joined</p>
              <Crown className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{stats.playersJoined.toLocaleString()}</span>
              <span className="text-sm font-medium text-[#A0A0A0]">Across all events</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0] uppercase tracking-wider">Upcoming</p>
              <CalendarClock className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{stats.upcoming}</span>
              <span className="text-sm font-medium text-[#A0A0A0]">Next 7 days</span>
            </div>
          </div>
        </div>

        {/* Filters & Grid */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 p-1 bg-[#252525] border border-[#333333] rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setTab('all')}
                className={
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors ' +
                  (tab === 'all' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-[#A0A0A0] hover:text-white')
                }
              >
                All Events
              </button>
              <button
                type="button"
                onClick={() => setTab('live')}
                className={
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors ' +
                  (tab === 'live' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-[#A0A0A0] hover:text-white')
                }
              >
                Live
              </button>
              <button
                type="button"
                onClick={() => setTab('upcoming')}
                className={
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors ' +
                  (tab === 'upcoming' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-[#A0A0A0] hover:text-white')
                }
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setTab('ended')}
                className={
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors ' +
                  (tab === 'ended' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-[#A0A0A0] hover:text-white')
                }
              >
                Ended
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#A0A0A0] bg-[#252525] border border-[#333333] rounded-lg hover:text-white hover:border-white/30 transition-colors">
                <Filter className="w-4 h-4" />
                Filter
                <ChevronDown className="w-4 h-4" />
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#A0A0A0] bg-[#252525] border border-[#333333] rounded-lg hover:text-white hover:border-white/30 transition-colors">
                <SortAsc className="w-4 h-4" />
                Sort
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-[#333333] bg-[#252525] p-10 text-center text-[#A0A0A0]">Loading tournaments...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-[#333333] bg-[#252525] p-10 text-center text-[#A0A0A0]">No tournaments found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((t) => {
                const isLive = t.status === 'live' && t.is_enabled
                const isUpcoming = t.status === 'upcoming'
                const isEnded = t.status === 'ended' || t.status === 'cancelled'
                const displayName = t.settings?.display_name || t.name

                const startMs = new Date(t.start_at).getTime()
                const endMs = new Date(t.end_at).getTime()
                const durationMs = Math.max(1, endMs - startMs)
                const remainingMs = Math.max(0, endMs - Date.now())
                const remHours = Math.floor(remainingMs / 3600000)
                const remMins = Math.floor((remainingMs % 3600000) / 60000)
                const remSecs = Math.floor((remainingMs % 60000) / 1000)
                const remainingText = `${String(remHours).padStart(2, '0')}h ${String(remMins).padStart(2, '0')}m ${String(remSecs).padStart(2, '0')}s`

                const startsInMs = Math.max(0, startMs - Date.now())
                const startsDays = Math.ceil(startsInMs / (24 * 3600000))

                const prizeConfig = (t.prize_config || {}) as any
                const prizePool =
                  (Array.isArray(prizeConfig?.deposits?.positions)
                    ? prizeConfig.deposits.positions.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
                    : 0) +
                  (Array.isArray(prizeConfig?.plays?.positions)
                    ? prizeConfig.plays.positions.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
                    : 0)

                const elapsedMs = Math.min(durationMs, Math.max(0, Date.now() - startMs))
                const progressPct = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100))

                return (
                  <div
                    key={t.id}
                    className={
                      'group relative flex flex-col overflow-hidden rounded-xl border border-[#333333] bg-[#252525] shadow-xl transition-colors duration-300 ' +
                      (isLive ? 'hover:border-[#D4AF37]/50' : isUpcoming ? 'hover:border-white/30' : 'opacity-75 hover:opacity-100')
                    }
                  >
                    <div className={'h-32 w-full bg-cover bg-center relative ' + (isEnded ? 'grayscale' : '')}>
                      <div
                        className={
                          'absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md border ' +
                          (isLive ? 'border-green-500/30' : isUpcoming ? 'border-blue-500/30' : 'border-white/10')
                        }
                      >
                        {isLive ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Live</span>
                          </>
                        ) : isUpcoming ? (
                          <>
                            <CalendarClock className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Upcoming</span>
                          </>
                        ) : (
                          <span className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider">Ended</span>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-4">
                        <div className="flex items-center gap-2 rounded bg-black/50 px-2 py-1 backdrop-blur-md">
                          <Crown className="w-4 h-4 text-[#D4AF37]" />
                          <span className="text-xs font-medium text-white">{t.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 p-5 pt-2">
                      <div className="flex justify-between items-start">
                        <h3 className={
                          'text-lg font-bold transition-colors ' +
                          (isEnded ? 'text-[#A0A0A0] group-hover:text-white' : 'text-white group-hover:text-[#D4AF37]')
                        }>
                          {displayName}
                        </h3>
                        <button type="button" className="text-[#A0A0A0] hover:text-white" title="More">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-[#A0A0A0] uppercase tracking-wider font-semibold">Prize Pool</p>
                        <p className={'text-2xl font-bold ' + (isUpcoming ? 'text-white' : isEnded ? 'text-[#A0A0A0]' : 'text-[#D4AF37]')}>
                          {formatCurrency(prizePool)} ETB
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg bg-black/20 p-3 border border-white/5">
                        {isLive ? (
                          <>
                            <div className="flex justify-between text-xs text-[#A0A0A0]">
                              <span>Time Remaining</span>
                              <span className="font-mono text-white">{remainingText}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10">
                              <div
                                className="h-1.5 rounded-full bg-[#D4AF37]"
                                style={{ width: `${Math.max(1, Math.min(100, progressPct))}%` }}
                              />
                            </div>
                          </>
                        ) : isUpcoming ? (
                          <>
                            <div className="flex justify-between text-xs text-[#A0A0A0]">
                              <span>Starts In</span>
                              <span className="font-mono text-white">{startsDays <= 1 ? 'Today' : `${startsDays} Days`}</span>
                            </div>
                            <div className="flex justify-between text-xs text-[#A0A0A0]">
                              <span>Date</span>
                              <span className="text-white">{new Date(t.start_at).toLocaleString()}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-xs text-[#A0A0A0]">
                              <span>Winner</span>
                              <span className="font-bold text-[#D4AF37]">{t.winners?.[0]?.user_id ? `#${String(t.winners[0].user_id).slice(0, 6)}` : '—'}</span>
                            </div>
                            <div className="flex justify-between text-xs text-[#A0A0A0]">
                              <span>Ended</span>
                              <span className="text-[#A0A0A0]">{new Date(t.end_at).toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        {!isEnded ? (
                          <button
                            type="button"
                            onClick={() => handleEdit(t)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePreviewFinalize(t)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-white/10 hover:text-white transition-colors"
                          >
                            View Results
                          </button>
                        )}

                        {!isEnded && (
                          <button
                            type="button"
                            onClick={() => handleDelete(t)}
                            className="flex items-center justify-center rounded-lg bg-white/5 p-2 text-white hover:bg-red-500/20 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Edit / Create Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 py-8">
            <div className="bg-[#252525] rounded-2xl border border-[#333333] max-w-3xl w-full max-h-full overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {creating ? 'Create Tournament' : 'Edit Tournament'}
                  </h2>
                  <p className="text-xs text-[#A0A0A0] mt-1">
                    Configure schedule, prizes, and eligibility. Players only see Live + enabled tournaments.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelected(null)
                    setCreating(false)
                  }}
                  className="w-8 h-8 rounded-lg bg-[#1C1C1C] hover:bg-white/10 flex items-center justify-center text-[#A0A0A0] hover:text-white border border-[#333333]"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Tournament Name</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => setSelected({ ...(selected as any), name: e.target.value })}
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A0A0A0] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Display Name (Lobby)</label>
                  <input
                    type="text"
                    value={selected.settings?.display_name || ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        settings: { ...(selected.settings || {}), display_name: e.target.value },
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A0A0A0] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Tournament Type</label>
                  <select
                    value={selected.type}
                    onChange={(e) => setSelected({ ...(selected as any), type: e.target.value })}
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Prize Copy (Lobby)</label>
                  <input
                    type="text"
                    value={selected.settings?.prize_label || ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        settings: { ...(selected.settings || {}), prize_label: e.target.value },
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A0A0A0] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="e.g. Top depositor 500 ETB, Most played 300 ETB"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Eligibility Copy (Lobby)</label>
                  <input
                    type="text"
                    value={selected.settings?.eligibility_label || ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        settings: { ...(selected.settings || {}), eligibility_label: e.target.value },
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A0A0A0] focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="e.g. Deposit 10 ETB & play 5 games to qualify"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={selected.start_at.slice(0, 16)}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        start_at: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={selected.end_at.slice(0, 16)}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        end_at: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Enable Tournament</label>
                  <button
                    type="button"
                    onClick={() => setSelected({ ...(selected as any), is_enabled: !selected.is_enabled })}
                    className={`w-full h-9 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                      selected.is_enabled
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                        : 'bg-[#1C1C1C] border-[#333333] text-[#A0A0A0]'
                    }`}
                  >
                    {selected.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="block text-[#A0A0A0] text-xs font-semibold">Prize Mode</label>
                  <select
                    value={selected.prize_mode}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        prize_mode: e.target.value,
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="fixed">Fixed Amounts</option>
                    <option value="percentage">% of Deposits</option>
                    <option value="pool">Shared Pool</option>
                  </select>
                </div>
              </div>

              {/* Simple prize + eligibility config (top1 only for now) */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-[#A0A0A0] text-xs font-semibold mb-1">Top Depositor Prize (Rank 1)</label>
                  <input
                    type="number"
                    value={selected.prize_config?.deposits?.positions?.[0]?.amount || ''}
                    onChange={(e) => {
                      const amount = Number(e.target.value || 0)
                      const pc = { ...(selected.prize_config || {}) } as any
                      const dep = { ...(pc.deposits || {}) }
                      const positions = Array.isArray(dep.positions) ? dep.positions.slice() : []
                      positions[0] = { rank: 1, amount }
                      dep.positions = positions
                      pc.deposits = dep
                      setSelected({ ...(selected as any), prize_config: pc })
                    }}
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="500"
                  />
                </div>

                <div>
                  <label className="block text-[#A0A0A0] text-xs font-semibold mb-1">Most Played Prize (Rank 1)</label>
                  <input
                    type="number"
                    value={selected.prize_config?.plays?.positions?.[0]?.amount || ''}
                    onChange={(e) => {
                      const amount = Number(e.target.value || 0)
                      const pc = { ...(selected.prize_config || {}) } as any
                      const pl = { ...(pc.plays || {}) }
                      const positions = Array.isArray(pl.positions) ? pl.positions.slice() : []
                      positions[0] = { rank: 1, amount }
                      pl.positions = positions
                      pc.plays = pl
                      setSelected({ ...(selected as any), prize_config: pc })
                    }}
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="300"
                  />
                </div>

                <div>
                  <label className="block text-[#A0A0A0] text-xs font-semibold mb-1">Min Deposit Total (Eligibility)</label>
                  <input
                    type="number"
                    value={selected.eligibility?.min_deposit_total ?? ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        eligibility: { ...(selected.eligibility || {}), min_deposit_total: Number(e.target.value || 0) },
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-[#A0A0A0] text-xs font-semibold mb-1">Min Plays (Eligibility)</label>
                  <input
                    type="number"
                    value={selected.eligibility?.min_plays ?? ''}
                    onChange={(e) =>
                      setSelected({
                        ...(selected as any),
                        eligibility: { ...(selected.eligibility || {}), min_plays: Number(e.target.value || 0) },
                      })
                    }
                    className="w-full bg-black/20 border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="5"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected({
                        ...(selected as any),
                        eligibility: { ...(selected.eligibility || {}), require_deposit: !Boolean(selected.eligibility?.require_deposit) },
                      })
                    }
                    className={
                      'w-full h-11 rounded-xl border text-sm font-semibold transition-colors ' +
                      (Boolean(selected.eligibility?.require_deposit)
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                        : 'bg-black/20 border-[#333333] text-[#A0A0A0] hover:text-white')
                    }
                  >
                    {Boolean(selected.eligibility?.require_deposit) ? 'Require Deposit: ON' : 'Require Deposit: OFF'}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setSelected(null)
                    setCreating(false)
                  }}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-[#A0A0A0] hover:bg-white/5 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#C5A028] shadow-lg shadow-[#D4AF37]/20 transition-all disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : creating ? 'Create Tournament' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Winners Drawer */}
        {winnersFor && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 py-6">
            <div className="bg-[#252525] rounded-t-2xl sm:rounded-2xl border border-[#333333] max-w-lg w-full max-h-full overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Tournament Winners</h2>
                  <p className="text-xs text-[#A0A0A0] mt-1">
                    {winnersFor.settings?.display_name || winnersFor.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setWinnersFor(null)
                    setPreviewWinners(null)
                  }}
                  className="w-8 h-8 rounded-lg bg-[#1C1C1C] hover:bg-white/10 flex items-center justify-center text-[#A0A0A0] hover:text-white border border-[#333333]"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              {/* Existing winners (if any) */}
              <div className="space-y-2 text-[11px] sm:text-xs text-white">
                <h3 className="font-semibold text-white">Existing Winners</h3>
                {Array.isArray(winnersFor.winners) && winnersFor.winners.length > 0 ? (
                  winnersFor.winners.map((w, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span>
                          {w.metric === 'deposits' ? 'Top Depositor' : 'Most Played'} #{w.rank}
                        </span>
                        <span className="text-[10px] text-[#A0A0A0]">User: {w.user_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#D4AF37]">{formatCurrency(w.prize_amount)} ETB</span>
                        {w.paid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#0bda1d]/15 text-[#0bda1d] border border-[#0bda1d]/30">
                            Paid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                            Pending
                          </span>
                        )}
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded-full text-[10px] bg-[#1C1C1C] text-white border border-[#333333] hover:bg-white/10"
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
                  <p className="text-[11px] text-[#A0A0A0]">No winners recorded yet.</p>
                )}
              </div>

              {extraAward && (
                <div className="mt-3 pt-3 border-t border-[#333333] space-y-2 text-[11px] sm:text-xs text-white">
                  <div className="flex items-center justify-between">
                    <span>
                      Extra prize for {extraAward.metric === 'deposits' ? 'Top Depositor' : 'Most Played'} #{extraAward.rank}
                    </span>
                    <span className="text-[10px] text-[#A0A0A0] truncate max-w-[180px]">
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
                      className="flex-1 bg-black/20 border border-[#333333] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                      placeholder="Extra prize amount (ETB)"
                    />
                    <button
                      type="button"
                      disabled={awardingExtra}
                      onClick={handleExtraAwardSubmit}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-[#D4AF37] text-black hover:bg-[#C5A028] disabled:opacity-60 border border-[#D4AF37]/60"
                    >
                      {awardingExtra ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              {/* Preview winners from current metrics */}
              {previewWinners && previewWinners.length > 0 && (
                <div className="pt-3 border-t border-[#333333] space-y-2">
                  <h3 className="text-[11px] sm:text-xs font-semibold text-white">Preview (if finalized now)</h3>
                  <div className="text-[11px] sm:text-xs text-white space-y-1">
                    {previewWinners.map((w: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>
                          {w.metric === 'deposits' ? 'Top Depositor' : 'Most Played'} #{w.rank}
                        </span>
                        <span className="font-semibold text-[#D4AF37]">{formatCurrency(w.prize)} ETB</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={finalizing}
                    onClick={() => winnersFor && handleFinalize(winnersFor)}
                    className="mt-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#C5A028] shadow-lg shadow-[#D4AF37]/20 transition-all disabled:opacity-60 w-full"
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
                  className="mt-2 rounded-lg border border-[#333333] bg-[#1C1C1C] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 w-full"
                >
                  {finalizing ? 'Loading…' : 'Refresh Preview from Metrics'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
