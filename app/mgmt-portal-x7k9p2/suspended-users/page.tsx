"use client"

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { Clock, Download, History, Search, Unlock } from 'lucide-react'

export default function SuspendedUsersPage() {
  const { admin } = useAdminAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [suspensionLog, setSuspensionLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'permanent'>('all')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const toCsv = (rows: Array<Record<string, any>>, headers: string[]) => {
    const escape = (v: any) => {
      const s = String(v ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [headers.map(escape).join(',')]
    for (const r of rows) {
      lines.push(headers.map((h) => escape((r as any)[h])).join(','))
    }
    return lines.join('\n')
  }

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const reasons = useMemo(() => {
    const set = new Set<string>()
    for (const u of users) {
      const r = String(u?.suspension_reason || '').trim()
      if (r) set.add(r)
    }
    return Array.from(set).slice(0, 50)
  }, [users])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return users.filter((u: any) => {
      const matchesSearch =
        !q ||
        String(u.id || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.telegram_id || '').toLowerCase().includes(q)

      const matchesReason = reasonFilter === 'all' || String(u.suspension_reason || '').trim() === String(reasonFilter)

      const d = u.suspended_at ? new Date(u.suspended_at) : null
      const from = dateFrom ? new Date(dateFrom) : null
      const to = dateTo ? new Date(dateTo) : null
      const matchesDate = (() => {
        if (!d || Number.isNaN(d.getTime())) return true
        if (from && d < from) return false
        if (to) {
          const end = new Date(to)
          end.setHours(23, 59, 59, 999)
          if (d > end) return false
        }
        return true
      })()

      const matchesStatus = (() => {
        if (statusFilter === 'all') return true
        const r = String(u.suspension_reason || '').toLowerCase()
        if (statusFilter === 'permanent') return r.includes('permanent') || r.includes('ban')
        if (statusFilter === 'expired') return r.includes('expired')
        return statusFilter === 'active'
      })()

      return matchesSearch && matchesReason && matchesDate && matchesStatus
    })
  }, [users, searchTerm, reasonFilter, dateFrom, dateTo, statusFilter])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length])
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, reasonFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchSuspendedUsers()
  }, [])

  const fetchSuspendedUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'inactive')
        .order('suspended_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching suspended users:', err)
    } finally {
      setLoading(false)
    }
  }

  const openSuspensionLog = async (user: any) => {
    setSelectedUser(user)
    setShowLogModal(true)
    setLoadingLog(true)
    try {
      const { data, error } = await supabase
        .from('user_suspensions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setSuspensionLog(data || [])
    } catch (err) {
      console.error('Error loading suspension log:', err)
      setSuspensionLog([])
    } finally {
      setLoadingLog(false)
    }
  }

  const stats = useMemo(() => {
    const total = users.length
    const permanent = users.filter((u: any) => String(u?.suspension_reason || '').toLowerCase().includes('permanent')).length
    const activeTemp = Math.max(0, total - permanent)
    const pendingAppeals = 0
    return { total, permanent, activeTemp, pendingAppeals }
  }, [users])

  const handleReactivate = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users/suspension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin?.id || '' },
        body: JSON.stringify({ userId, action: 'unsuspend' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to reactivate user')
      await fetchSuspendedUsers()
    } catch (err) {
      console.error('Failed to reactivate user:', err)
    }
  }

  return (
    <AdminShell title="Risk & Enforcement">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Suspended Users</h2>
            <p className="text-[#A0A0A0] max-w-2xl">Manage player risk, enforce platform rules, review suspension history, and handle ban appeals.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-[#252525] hover:bg-[#333] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-[#444]"
              onClick={() => {
                const rows = filtered.map((u: any) => ({
                  user_id: u.id,
                  username: u.username || '',
                  telegram_id: u.telegram_id || '',
                  reason: u.suspension_reason || '',
                  suspended_at: u.suspended_at ? new Date(u.suspended_at).toISOString() : '',
                  balance_etb: Number(u.balance || 0),
                  bonus_balance_etb: Number(u.bonus_balance || 0),
                }))
                const csv = toCsv(rows, ['user_id', 'username', 'telegram_id', 'reason', 'suspended_at', 'balance_etb', 'bonus_balance_etb'])
                downloadCsv('suspended_users.csv', csv)
              }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#252525] p-5 rounded-xl border border-[#333] shadow-lg hover:border-[#d4af35]/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#A0A0A0] text-sm font-medium">Total Suspended</span>
              <span className="p-1.5 bg-[#333] rounded-lg text-[#A0A0A0]"> </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-white">{stats.total}</span>
            </div>
          </div>
          <div className="bg-[#252525] p-5 rounded-xl border border-[#333] shadow-lg hover:border-[#d4af35]/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#A0A0A0] text-sm font-medium">Permanent Bans</span>
              <span className="p-1.5 bg-[#333] rounded-lg text-[#A0A0A0]"> </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-white">{stats.permanent}</span>
            </div>
          </div>
          <div className="bg-[#252525] p-5 rounded-xl border border-[#333] shadow-lg hover:border-[#d4af35]/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#A0A0A0] text-sm font-medium">Active Temporary</span>
              <span className="p-1.5 bg-[#333] rounded-lg text-[#A0A0A0]"> </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-white">{stats.activeTemp}</span>
            </div>
          </div>
          <div className="bg-[#252525] p-5 rounded-xl border border-[#333] shadow-lg hover:border-[#d4af35]/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#A0A0A0] text-sm font-medium">Pending Appeals</span>
              <span className="p-1.5 bg-[#333] rounded-lg text-[#A0A0A0]"> </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-white">{stats.pendingAppeals}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-[#252525] p-4 rounded-xl border border-[#333]">
          <div className="relative w-full lg:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-[#A0A0A0]" />
            </div>
            <input
              className="block w-full pl-10 pr-3 py-2.5 bg-[#1C1C1C] border border-[#444] rounded-lg text-white placeholder-[#A0A0A0] focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] sm:text-sm transition-all"
              placeholder="Search by User ID or Username..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative">
              <select
                className="appearance-none bg-[#1C1C1C] border border-[#444] text-white py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] text-sm cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Status: All</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>
            <div className="relative">
              <select
                className="appearance-none bg-[#1C1C1C] border border-[#444] text-white py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] text-sm cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
              >
                <option value="all">Reason: All</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#1C1C1C] border border-[#444] text-white py-2.5 px-3 rounded-lg text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#1C1C1C] border border-[#444] text-white py-2.5 px-3 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="bg-[#252525] rounded-xl border border-[#333] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#2a2a2a] border-b border-[#333]">
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">Username</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">Suspended At</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#A0A0A0]">
                      Loading suspended users...
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#A0A0A0]">
                      No suspended users
                    </td>
                  </tr>
                ) : (
                  paged.map((u: any) => {
                    const reason = String(u.suspension_reason || '')
                    const statusLabel = reason.toLowerCase().includes('expired') ? 'Expired' : reason.toLowerCase().includes('permanent') ? 'Permanent' : 'Active'
                    const statusClass =
                      statusLabel === 'Expired'
                        ? 'bg-[#333] text-[#A0A0A0] border border-[#444]'
                        : statusLabel === 'Permanent'
                          ? 'bg-[#E74C3C]/10 text-[#E74C3C] border border-[#E74C3C]/20'
                          : 'bg-[#E74C3C]/10 text-[#E74C3C] border border-[#E74C3C]/20'

                    return (
                      <tr key={u.id} className="hover:bg-[#2a2a2a] transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-[#A0A0A0]">#{String(u.id).slice(0, 8)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-cover bg-center bg-[#333]" />
                            <span className="text-sm font-medium text-white">{u.username || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-[#A0A0A0]">{reason || '—'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-[#A0A0A0]">{u.suspended_at ? new Date(u.suspended_at).toLocaleString() : '—'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-[#A0A0A0]">—</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="text-[#A0A0A0] hover:text-[#d4af35] transition-colors p-1"
                              title="View History"
                              type="button"
                              onClick={() => openSuspensionLog(u)}
                            >
                              <History className="w-5 h-5" />
                            </button>
                            <button
                              className="text-[#A0A0A0] hover:text-white transition-colors p-1"
                              title="Lift Suspension"
                              type="button"
                              onClick={() => void handleReactivate(u.id)}
                            >
                              <Unlock className="w-5 h-5" />
                            </button>
                            <button
                              className="text-[#A0A0A0] hover:text-[#E74C3C] transition-colors p-1"
                              title="Extend Suspension"
                              type="button"
                              disabled
                            >
                              <Clock className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-[#252525] px-4 py-3 border-t border-[#333] flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-[#A0A0A0]">
                  Showing <span className="font-medium text-white">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium text-white">{Math.min(page * pageSize, filtered.length)}</span> of{' '}
                  <span className="font-medium text-white">{filtered.length}</span> results
                </p>
              </div>
              <div>
                <nav aria-label="Pagination" className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-[#444] bg-[#2a2a2a] text-sm font-medium text-[#A0A0A0] hover:bg-[#333] disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="bg-[#2a2a2a] border-[#444] text-[#A0A0A0] relative inline-flex items-center px-4 py-2 border text-sm font-medium">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-[#444] bg-[#2a2a2a] text-sm font-medium text-[#A0A0A0] hover:bg-[#333] disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>

        {showLogModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333] p-4 sm:p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Suspension history</h3>
                  <p className="text-xs text-[#A0A0A0]">{selectedUser.username} · {selectedUser.telegram_id}</p>
                </div>
                <button onClick={() => setShowLogModal(false)} className="text-[#A0A0A0] hover:text-white transition-colors" type="button">
                  ✕
                </button>
              </div>

              {loadingLog ? (
                <div className="py-8 text-center text-[#A0A0A0]">Loading suspension history...</div>
              ) : suspensionLog.length === 0 ? (
                <div className="py-6 text-center text-[#A0A0A0] text-sm">No suspension entries found.</div>
              ) : (
                <div className="space-y-3 text-sm">
                  {suspensionLog.map((entry) => (
                    <div key={entry.id} className="border border-[#333] rounded-lg p-3 bg-[#1C1C1C]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#A0A0A0]">{new Date(entry.created_at).toLocaleString()}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#333] text-white border border-[#444] uppercase tracking-wide">
                          {entry.source}
                        </span>
                      </div>
                      <div className="text-white mb-1">{entry.reason}</div>
                      {entry.context && (
                        <pre className="mt-1 text-[10px] text-[#A0A0A0] bg-[#1C1C1C] rounded p-2 overflow-x-auto">
                          {JSON.stringify(entry.context, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
