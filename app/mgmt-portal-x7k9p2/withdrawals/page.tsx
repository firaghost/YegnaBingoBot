"use client"

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import {
  AlertTriangle,
  Check,
  Download,
  Hourglass,
  Lock,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useLocalStorage<'all' | 'pending' | 'approved' | 'rejected' | 'locked' | 'high_risk'>(
    'withdrawals_filter',
    'all'
  )
  const [searchTerm, setSearchTerm] = useLocalStorage('withdrawals_search', '')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<{id: string, userId: string, amount: number} | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [currentPage, setCurrentPage] = useLocalStorage('withdrawals_page', 1)
  const [pageSize, setPageSize] = useLocalStorage('withdrawals_pageSize', 10)
  const [isEnforcing, setIsEnforcing] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptWithdrawal, setReceiptWithdrawal] = useState<any | null>(null)
  const { admin, loading: adminLoading } = useAdminAuth()

  const isDataLoading = loading || adminLoading

  const handleSendReceipt = async (withdrawalId: string) => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    try {
      const res = await fetch('/api/admin/receipts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({ kind: 'withdrawal', id: withdrawalId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to send receipt')
      showNotification('success', 'Receipt sent to user')
    } catch (e: any) {
      showNotification('error', e?.message || 'Failed to send receipt')
    }
  }

  const openReceipt = (w: any) => {
    setReceiptWithdrawal(w)
    setReceiptOpen(true)
  }

  const downloadReceipt = (w: any) => {
    const receipt = {
      id: w?.id,
      user_id: w?.user_id,
      username: w?.users?.username,
      telegram_id: w?.users?.telegram_id,
      amount: w?.amount,
      status: w?.status,
      bank_name: w?.bank_name,
      account_number: w?.account_number,
      account_holder: w?.account_holder,
      created_at: w?.created_at,
      processed_at: w?.processed_at,
      admin_note: w?.admin_note,
    }

    const text = JSON.stringify(receipt, null, 2)
    const blob = new Blob([text], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `withdrawal-receipt-${w?.id || 'unknown'}-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (adminLoading) return
    if (!admin) {
      setLoading(false)
      return
    }

    fetchWithdrawals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLoading, admin])

  useEffect(() => {
    filterWithdrawals()
    setCurrentPage(1)
  }, [filter, searchTerm, allWithdrawals])

  const fetchWithdrawals = async () => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/withdrawals?status=all', {
        headers: { 'x-admin-id': admin.id }
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch withdrawals')
      }
      setAllWithdrawals(result.data || [])
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
      showNotification('error', (error as any)?.message || 'Failed to fetch withdrawals')
    } finally {
      setLoading(false)
    }
  }

  const filterWithdrawals = () => {
    let filtered = allWithdrawals

    // Filter by status
    if (filter === 'pending' || filter === 'approved' || filter === 'rejected') {
      filtered = filtered.filter(w => w.status === filter)
    } else if (filter === 'locked') {
      filtered = filtered.filter((w) => {
        const maybeLocked = Boolean(w?.is_locked) || String(w?.status || '').toLowerCase() === 'locked'
        const source = String(w?.source || w?.metadata?.source || w?.metadata?.funds_source || '').toLowerCase()
        return maybeLocked || source.includes('bonus')
      })
    } else if (filter === 'high_risk') {
      filtered = filtered.filter((w) => {
        const riskScore = Number(w?.risk_score ?? w?.metadata?.risk_score ?? 0)
        const flagged = Boolean(w?.is_high_risk ?? w?.metadata?.is_high_risk)
        return flagged || riskScore >= 80
      })
    }

    // Filter by search term (username or telegram ID)
    if (searchTerm) {
      filtered = filtered.filter(w =>
        w.users?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.users?.telegram_id?.includes(searchTerm)
      )
    }

    setWithdrawals(filtered)
  }

  const handleExportCsv = () => {
    const rows = withdrawals

    const escapeCsv = (value: any) => {
      const s = value == null ? '' : String(value)
      const escaped = s.replace(/"/g, '""')
      return `"${escaped}"`
    }

    const header = [
      'withdrawal_id',
      'user_id',
      'username',
      'telegram_id',
      'amount',
      'status',
      'bank_name',
      'account_number',
      'account_holder',
      'created_at',
      'processed_at',
      'admin_note',
      'source',
      'risk_score',
    ]

    const lines = [header.map(escapeCsv).join(',')]
    for (const w of rows) {
      const source = w?.source || w?.metadata?.source || w?.metadata?.funds_source || ''
      const riskScore = w?.risk_score ?? w?.metadata?.risk_score ?? ''
      lines.push(
        [
          w?.id,
          w?.user_id,
          w?.users?.username,
          w?.users?.telegram_id,
          w?.amount,
          w?.status,
          w?.bank_name,
          w?.account_number,
          w?.account_holder,
          w?.created_at,
          w?.processed_at,
          w?.admin_note,
          source,
          riskScore,
        ].map(escapeCsv).join(',')
      )
    }

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `withdrawals-${filter}-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const enforceRules = async () => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    try {
      setIsEnforcing(true)
      const res = await fetch('/api/admin/withdrawals/enforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to enforce rules')
      showNotification('success', `Processed ${data.processed} withdrawal(s) using bonus rules`)
      await fetchWithdrawals()
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to enforce rules')
    } finally {
      setIsEnforcing(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleApprove = (withdrawalId: string) => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    setSelectedWithdrawal({ id: withdrawalId, userId: '', amount: 0 })
    setShowConfirmDialog(true)
  }

  const confirmApprove = async () => {
    if (!selectedWithdrawal) return
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    setShowConfirmDialog(false)
    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({
          action: 'approve',
          withdrawalId: selectedWithdrawal.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve')
      }

      showNotification('success', 'Withdrawal approved!')
      fetchWithdrawals()
    } catch (error: any) {
      console.error('Error approving withdrawal:', error)
      showNotification('error', error.message || 'Failed to approve withdrawal')
    } finally {
      setSelectedWithdrawal(null)
    }
  }

  const handleReject = (withdrawalId: string, userId: string, amount: number) => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    setSelectedWithdrawal({ id: withdrawalId, userId, amount })
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const confirmReject = async () => {
    if (!selectedWithdrawal || !rejectionReason.trim()) {
      showNotification('error', 'Please enter a rejection reason')
      return
    }

    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    setShowRejectModal(false)
    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({
          action: 'reject',
          withdrawalId: selectedWithdrawal.id,
          adminNote: rejectionReason.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject')
      }

      showNotification('success', 'Withdrawal rejected and balance refunded')
      fetchWithdrawals()
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error)
      showNotification('error', error.message || 'Failed to reject withdrawal')
    } finally {
      setSelectedWithdrawal(null)
      setRejectionReason('')
    }
  }

  // Calculate stats
  const stats = {
    total: allWithdrawals.length,
    pending: allWithdrawals.filter(w => w.status === 'pending').length,
    approved: allWithdrawals.filter(w => w.status === 'approved').length,
    rejected: allWithdrawals.filter(w => w.status === 'rejected').length,
    totalAmount: allWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0),
    pendingAmount: allWithdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + (w.amount || 0), 0),
    approvedAmount: allWithdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + (w.amount || 0), 0),
  }

  const todayApprovedAmount = allWithdrawals
    .filter((w) => {
      if (String(w.status || '').toLowerCase() !== 'approved') return false
      const ts = w?.processed_at || w?.updated_at || w?.created_at
      if (!ts) return false
      const d = new Date(ts)
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    })
    .reduce((sum, w) => sum + (w.amount || 0), 0)

  const lockedCount = allWithdrawals.filter((w) => {
    const maybeLocked = Boolean(w?.is_locked) || String(w?.status || '').toLowerCase() === 'locked'
    const source = String(w?.source || w?.metadata?.source || w?.metadata?.funds_source || '').toLowerCase()
    return maybeLocked || source.includes('bonus')
  }).length

  const highRiskCount = allWithdrawals.filter((w) => {
    const riskScore = Number(w?.risk_score ?? w?.metadata?.risk_score ?? 0)
    const flagged = Boolean(w?.is_high_risk ?? w?.metadata?.is_high_risk)
    return flagged || riskScore >= 80
  }).length

  // Pagination
  const totalPages = Math.ceil(withdrawals.length / pageSize)
  const paginatedWithdrawals = withdrawals.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <AdminShell title="Withdrawals Management">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        {receiptOpen && receiptWithdrawal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-lg w-full shadow-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Withdrawal Receipt</h3>
                  <p className="text-xs text-[#A0A0A0] break-all">{receiptWithdrawal.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptOpen(false)
                    setReceiptWithdrawal(null)
                  }}
                  className="p-2 rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#d4af35] transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="min-w-0">
                  <div className="text-xs text-[#A0A0A0]">User</div>
                  <div className="text-white font-semibold break-all">{receiptWithdrawal.users?.username || 'Unknown'}</div>
                  <div className="text-xs text-[#A0A0A0] break-all">{receiptWithdrawal.users?.telegram_id || '—'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[#A0A0A0]">Amount</div>
                  <div className="text-white font-bold">{formatCurrency(receiptWithdrawal.amount)}</div>
                  <div className="text-xs text-[#A0A0A0]">Status: {String(receiptWithdrawal.status || '—')}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[#A0A0A0]">Bank</div>
                  <div className="text-white break-all">{receiptWithdrawal.bank_name || '—'}</div>
                  <div className="text-xs text-[#A0A0A0] break-all">{receiptWithdrawal.account_number || '—'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[#A0A0A0]">Account Holder</div>
                  <div className="text-white break-all">{receiptWithdrawal.account_holder || '—'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[#A0A0A0]">Requested At</div>
                  <div className="text-white">
                    {receiptWithdrawal.created_at ? new Date(receiptWithdrawal.created_at).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[#A0A0A0]">Processed At</div>
                  <div className="text-white">
                    {receiptWithdrawal.processed_at ? new Date(receiptWithdrawal.processed_at).toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {receiptWithdrawal.admin_note ? (
                <div className="mt-4">
                  <div className="text-xs text-[#A0A0A0]">Admin Note</div>
                  <div className="text-sm text-red-300 break-all">{String(receiptWithdrawal.admin_note)}</div>
                </div>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => downloadReceipt(receiptWithdrawal)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptOpen(false)
                    setReceiptWithdrawal(null)
                  }}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {notification && (
          <div className={`fixed top-20 right-4 z-50 px-5 py-3 rounded-lg font-semibold border shadow-lg text-sm ${
            notification.type === 'success'
              ? 'bg-[#d4af35]/15 text-[#d4af35] border border-[#d4af35]/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            <span className="font-semibold">{notification.message}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm mb-4">
          <span className="text-[#A0A0A0]">Dashboard</span>
          <span className="text-[#555]">/</span>
          <span className="font-medium text-white">Withdrawals</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Withdrawals Management</h1>
            <p className="text-[#A0A0A0] max-w-2xl">
              Monitor and approve outgoing fund requests. Ensure compliance with anti-fraud and bonus policies.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-lg bg-[#252525] border border-[#333333] px-4 py-2 text-sm font-bold text-white hover:bg-[#333] transition-colors"
          >
            <Download className="w-4 h-4 text-[#A0A0A0]" />
            <span>Export Report</span>
          </button>
        </div>

        <div className="rounded-lg border-l-4 border-[#F39C12] bg-[#F39C12]/10 p-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F39C12] mt-0.5" />
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-[#F39C12]">Compliance Policy Enforced</h3>
                <p className="text-sm text-[#A0A0A0] mt-1">
                  Withdrawals allowed only from real deposits. Funds originating from promotional bonuses are strictly locked until wager requirements are met.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={enforceRules}
              disabled={isEnforcing}
              className={
                isEnforcing
                  ? 'px-4 py-2 rounded-lg font-semibold border bg-[#1a1a1a] text-[#666] border-[#333333] cursor-not-allowed'
                  : 'px-4 py-2 rounded-lg font-semibold border bg-[#252525] hover:bg-[#333] text-white border-[#333333] transition-colors'
              }
            >
              {isEnforcing ? 'Enforcing…' : 'Enforce Rules'}
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col rounded-xl bg-[#252525] p-4 shadow-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#A0A0A0]">Pending Requests</span>
              <span className="p-1 rounded-lg bg-[#F39C12]/20">
                <Hourglass className="w-4 h-4 text-[#F39C12]" />
              </span>
            </div>
            <span className="text-2xl font-bold text-white">{stats.pending}</span>
            <span className="text-xs text-[#F39C12] mt-1">Pending amount: {formatCurrency(stats.pendingAmount)}</span>
          </div>
          <div className="flex flex-col rounded-xl bg-[#252525] p-4 shadow-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#A0A0A0]">Total Approved Today</span>
              <span className="p-1 rounded-lg bg-[#d4af35]/20">
                <Check className="w-4 h-4 text-[#d4af35]" />
              </span>
            </div>
            <span className="text-2xl font-bold text-white">{formatCurrency(todayApprovedAmount)}</span>
            <span className="text-xs text-[#A0A0A0] mt-1">All approved total: {formatCurrency(stats.approvedAmount)}</span>
          </div>
          <div className="flex flex-col rounded-xl bg-[#252525] p-4 shadow-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#A0A0A0]">Locked (Bonus)</span>
              <span className="p-1 rounded-lg bg-red-500/20">
                <Lock className="w-4 h-4 text-red-300" />
              </span>
            </div>
            <span className="text-2xl font-bold text-white">{lockedCount}</span>
            <span className="text-xs text-red-300 mt-1">Require manual review</span>
          </div>
          <div className="flex flex-col rounded-xl bg-[#252525] p-4 shadow-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#A0A0A0]">High Risk</span>
              <span className="p-1 rounded-lg bg-red-500/20">
                <ShieldAlert className="w-4 h-4 text-red-300" />
              </span>
            </div>
            <span className="text-2xl font-bold text-white">{highRiskCount}</span>
            <span className="text-xs text-[#A0A0A0] mt-1">Flagged by rules</span>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#252525] p-3 border border-[#333333] mb-6 min-w-0">
          <div className="flex flex-wrap items-center gap-2 max-w-full min-w-0">
            {([
              { key: 'all', label: 'All Requests' },
              { key: 'pending', label: 'Pending' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'locked', label: 'Locked' },
              { key: 'high_risk', label: 'High Risk' },
            ] as const).map((t) => {
              const active = filter === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilter(t.key)}
                  className={
                    active
                      ? 'rounded-lg bg-[#d4af35] text-[#1C1C1C] px-4 py-2 text-sm font-bold shadow-md hover:bg-[#c29d2b] transition-colors'
                      : 'rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#A0A0A0] px-4 py-2 text-sm font-medium hover:text-white hover:border-[#d4af35]/50 transition-colors'
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
              <input
                className="w-full h-10 rounded-lg bg-[#1a1a1a] border border-[#333333] pl-10 pr-4 text-sm text-white placeholder-[#A0A0A0] focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] outline-none"
                placeholder="Search by username / Telegram ID..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
              }}
              className="flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#333333] p-2 text-[#A0A0A0] hover:text-white hover:border-[#d4af35] transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-[#333333] bg-[#252525] overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] min-w-0">
          {isDataLoading ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="w-8 h-8 border-4 border-[#d4af35] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[#A0A0A0] text-sm sm:text-base">Loading withdrawals...</p>
            </div>
          ) : !admin ? (
            <div className="p-8 sm:p-12 text-center text-[#A0A0A0] text-sm sm:text-base">
              Admin session missing. Please log in again to view withdrawals.
            </div>
          ) : paginatedWithdrawals.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[#A0A0A0] text-sm sm:text-base">
              No withdrawals found
            </div>
          ) : (
            <>
              <div className="hidden lg:block max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-[#1a1a1a] border-b border-[#333333]">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] w-[32%]">User</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] text-right w-[14%]">Amount</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] text-center w-[10%]">Source</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] w-[14%]">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] w-[18%]">Requested At</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0] text-right w-[12%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333333]">
                    {paginatedWithdrawals.map((w) => {
                      const status = String(w.status || '').toLowerCase()
                      const sourceRaw = String(w?.source || w?.metadata?.source || w?.metadata?.funds_source || '')
                      const source = sourceRaw.toLowerCase().includes('bonus') || Boolean(w?.is_locked)
                        ? 'Bonus'
                        : 'Real'
                      const isPending = status === 'pending'

                      return (
                        <tr key={w.id} className="group hover:bg-[#2a2a2a] transition-colors">
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-[#333333] flex items-center justify-center text-xs font-bold text-[#d4af35]">
                                {(String(w?.users?.username || 'U').slice(0, 1) || 'U').toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white">{w.users?.username || 'Unknown'}</div>
                                <div className="text-xs text-[#A0A0A0] break-all">ID: {String(w.user_id || '').slice(0, 8) || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right align-top">
                            <div className="text-sm font-bold text-white font-mono">{formatCurrency(w.amount)}</div>
                          </td>
                          <td className="px-6 py-4 text-center align-top">
                            {source === 'Bonus' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300 border border-purple-500/20">
                                Bonus
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-300 border border-green-500/20">
                                Real
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {status === 'pending' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F39C12]/10 px-2.5 py-0.5 text-xs font-medium text-[#F39C12] border border-[#F39C12]/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#F39C12]"></span>
                                Pending
                              </span>
                            ) : status === 'approved' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-300 border border-green-500/20">
                                <Check className="w-3.5 h-3.5" />
                                Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#333333] px-2.5 py-0.5 text-xs font-medium text-[#A0A0A0] border border-[#444444]">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-[#A0A0A0] align-top">
                            {w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}
                            <br />
                            <span className="text-xs opacity-60">
                              {w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right align-top">
                            {isPending ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReject(w.id, w.user_id, w.amount)}
                                  className="flex items-center justify-center rounded-lg p-2 text-red-300 hover:bg-red-500/10 transition-colors"
                                  title="Reject"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(w.id)}
                                  className="flex items-center justify-center rounded-lg bg-[#d4af35] p-2 text-[#1C1C1C] shadow-sm hover:bg-[#c29d2b] transition-colors"
                                  title="Approve"
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                              </div>
                            ) : status === 'rejected' ? (
                              <span className="text-xs text-red-300 break-all inline-block max-w-full">{w.admin_note || ''}</span>
                            ) : status === 'approved' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openReceipt(w)}
                                  className="px-3 py-1.5 rounded-lg border border-[#333333] bg-[#1a1a1a] text-xs font-semibold text-[#A0A0A0] hover:text-white transition-colors"
                                >
                                  View Receipt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendReceipt(w.id)}
                                  className="px-3 py-1.5 rounded-lg border border-[#333333] bg-[#1a1a1a] text-xs font-semibold text-[#A0A0A0] hover:text-[#d4af35] hover:border-[#d4af35] transition-colors"
                                >
                                  Send Receipt
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden p-4 space-y-3">
                {paginatedWithdrawals.map((w) => {
                  const status = String(w.status || '').toLowerCase()
                  const sourceRaw = String(w?.source || w?.metadata?.source || w?.metadata?.funds_source || '')
                  const source = sourceRaw.toLowerCase().includes('bonus') || Boolean(w?.is_locked)
                    ? 'Bonus'
                    : 'Real'
                  const isPending = status === 'pending'

                  return (
                    <div key={w.id} className="bg-[#1C1C1C] rounded-lg border border-[#333333] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white break-all">{w.users?.username || 'Unknown'}</div>
                          <div className="text-xs text-[#A0A0A0] break-all">ID: {String(w.user_id || '').slice(0, 8) || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white font-mono">{formatCurrency(w.amount)}</div>
                          <div className="mt-1">
                            {status === 'pending' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F39C12]/10 px-2.5 py-0.5 text-xs font-medium text-[#F39C12] border border-[#F39C12]/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#F39C12]"></span>
                                Pending
                              </span>
                            ) : status === 'approved' ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-300 border border-green-500/20">
                                <Check className="w-3.5 h-3.5" />
                                Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#333333] px-2.5 py-0.5 text-xs font-medium text-[#A0A0A0] border border-[#444444]">
                                Rejected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {source === 'Bonus' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-300 border border-purple-500/20">
                            Bonus
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-300 border border-green-500/20">
                            Real
                          </span>
                        )}
                        <span className="text-xs text-[#A0A0A0]">
                          {w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}{' '}
                          {w.created_at ? new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      {status === 'rejected' && w.admin_note ? (
                        <div className="mt-3 text-xs text-red-300 break-all">{String(w.admin_note)}</div>
                      ) : null}

                      {isPending ? (
                        <div className="flex gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => handleReject(w.id, w.user_id, w.amount)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-semibold transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(w.id)}
                            className="flex-1 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] px-3 py-2 rounded text-xs font-semibold transition-colors"
                          >
                            Approve
                          </button>
                        </div>
                      ) : status === 'approved' ? (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openReceipt(w)}
                            className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-3 py-2 rounded text-xs font-semibold hover:border-[#d4af35] transition-colors"
                          >
                            View Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendReceipt(w.id)}
                            className="w-full bg-[#1a1a1a] border border-[#333333] text-[#A0A0A0] px-3 py-2 rounded text-xs font-semibold hover:border-[#d4af35] hover:text-[#d4af35] transition-colors"
                          >
                            Send Receipt
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#333333] bg-[#1a1a1a] px-6 py-4">
                  <div className="text-sm text-[#A0A0A0]">
                    Page <span className="font-medium text-white">{currentPage}</span> of{' '}
                    <span className="font-medium text-white">{totalPages}</span>
                    <span className="ml-2">({withdrawals.length} results)</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-[#333333] bg-[#252525] px-4 py-2 text-sm font-medium text-[#A0A0A0] hover:bg-[#333] hover:text-white disabled:opacity-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-[#333333] bg-[#252525] px-4 py-2 text-sm font-medium text-white hover:bg-[#333] disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Approval</h3>
              <p className="text-[#A0A0A0] mb-6">Are you sure you want to approve this withdrawal?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setSelectedWithdrawal(null)
                  }}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmApprove}
                  className="flex-1 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Reject Withdrawal</h3>
              <p className="text-[#A0A0A0] mb-4">Please provide a reason for rejection:</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-4 py-3 text-white placeholder-[#666] focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] mb-6 min-h-[100px] resize-none"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedWithdrawal(null)
                    setRejectionReason('')
                  }}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmReject}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
