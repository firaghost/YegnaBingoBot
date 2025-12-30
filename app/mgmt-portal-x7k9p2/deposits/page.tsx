"use client"

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { Check, ChevronDown, DollarSign, Download, Hourglass, Search, TrendingUp, X } from 'lucide-react'

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState<any[]>([])
  const [allDeposits, setAllDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useLocalStorage<'pending' | 'completed' | 'failed'>('deposits_filter', 'pending')
  const [searchTerm, setSearchTerm] = useLocalStorage('deposits_search', '')
  const [dateFrom, setDateFrom] = useLocalStorage('deposits_dateFrom', '')
  const [dateTo, setDateTo] = useLocalStorage('deposits_dateTo', '')
  const [methodFilter, setMethodFilter] = useLocalStorage('deposits_method', 'all')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'approve' | null>(null)
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [currentPage, setCurrentPage] = useLocalStorage('deposits_page', 1)
  const [pageSize, setPageSize] = useLocalStorage('deposits_pageSize', 10)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptDeposit, setReceiptDeposit] = useState<any | null>(null)
  const { admin, loading: adminLoading } = useAdminAuth()

  const isDataLoading = loading || adminLoading

  const handleSendReceipt = async (transactionId: string) => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    try {
      const res = await fetch('/api/admin/receipts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({ kind: 'deposit', id: transactionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to send receipt')
      showNotification('success', 'Receipt sent to user')
    } catch (e: any) {
      showNotification('error', e?.message || 'Failed to send receipt')
    }
  }

  const openReceipt = (d: any) => {
    setReceiptDeposit(d)
    setReceiptOpen(true)
  }

  const downloadReceipt = (d: any) => {
    const receipt = {
      id: d?.id,
      user_id: d?.user_id,
      username: d?.users?.username,
      telegram_id: d?.users?.telegram_id,
      amount: d?.amount,
      status: d?.status,
      payment_method: d?.metadata?.payment_method || d?.payment_method,
      transaction_reference: d?.metadata?.transaction_reference,
      proof_url: d?.metadata?.proof_url,
      created_at: d?.created_at,
      processed_at: d?.processed_at,
      admin_note: d?.admin_note,
    }

    const text = JSON.stringify(receipt, null, 2)
    const blob = new Blob([text], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `deposit-receipt-${d?.id || 'unknown'}-${stamp}.json`
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
    fetchDeposits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLoading, admin])

  useEffect(() => {
    filterDeposits()
    setCurrentPage(1)
  }, [filter, searchTerm, dateFrom, dateTo, methodFilter, allDeposits])

  const fetchDeposits = async () => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/deposits?status=all', {
        headers: { 'x-admin-id': admin.id }
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch deposits')
      }

      setAllDeposits(result.data || [])
    } catch (error) {
      console.error('Error fetching deposits:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterDeposits = () => {
    let filtered = allDeposits

    // Filter by status
    filtered = filtered.filter(d => d.status === filter)

    // Filter by date range (created_at)
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : null
    if (fromTs != null || toTs != null) {
      filtered = filtered.filter((d) => {
        const created = d?.created_at ? new Date(d.created_at).getTime() : NaN
        if (!Number.isFinite(created)) return false
        if (fromTs != null && created < fromTs) return false
        if (toTs != null && created > toTs) return false
        return true
      })
    }

    // Filter by payment method
    if (methodFilter && methodFilter !== 'all') {
      const norm = String(methodFilter).toLowerCase()
      filtered = filtered.filter((d) => {
        const method = String(d?.metadata?.payment_method || d?.payment_method || '').toLowerCase()
        return method.includes(norm)
      })
    }

    // Filter by search term (username or telegram ID)
    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.users?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.users?.telegram_id?.includes(searchTerm)
      )
    }

    setDeposits(filtered)
  }

  const handleExportCsv = () => {
    const rows = deposits

    const escapeCsv = (value: any) => {
      const s = value == null ? '' : String(value)
      const escaped = s.replace(/"/g, '""')
      return `"${escaped}"`
    }

    const header = [
      'transaction_id',
      'username',
      'telegram_id',
      'amount',
      'method',
      'status',
      'created_at',
      'reference',
      'proof_url',
    ]

    const lines = [header.map(escapeCsv).join(',')]
    for (const d of rows) {
      const method = d?.metadata?.payment_method || d?.payment_method || ''
      const reference = d?.metadata?.transaction_reference || ''
      const proofUrl = d?.metadata?.proof_url || ''
      lines.push(
        [
          d?.id,
          d?.users?.username,
          d?.users?.telegram_id,
          d?.amount,
          method,
          d?.status,
          d?.created_at,
          reference,
          proofUrl,
        ].map(escapeCsv).join(',')
      )
    }

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `deposits-${filter}-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleApprove = async (depositId: string) => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    setSelectedDepositId(depositId)
    setConfirmAction('approve')
    setShowConfirmDialog(true)
  }

  const confirmApprove = async () => {
    if (!selectedDepositId) return
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    
    setShowConfirmDialog(false)
    try {
      const response = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({
          action: 'approve',
          transactionId: selectedDepositId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve')
      }

      showNotification('success', 'Deposit approved successfully!')
      fetchDeposits()
    } catch (error: any) {
      console.error('Error approving deposit:', error)
      showNotification('error', error.message || 'Failed to approve deposit')
    } finally {
      setSelectedDepositId(null)
      setConfirmAction(null)
    }
  }

  const handleReject = (depositId: string) => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    setSelectedDepositId(depositId)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const confirmReject = async () => {
    if (!selectedDepositId || !rejectionReason.trim()) {
      showNotification('error', 'Please enter a rejection reason')
      return
    }

    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    setShowRejectModal(false)
    try {
      const response = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify({
          action: 'reject',
          transactionId: selectedDepositId,
          reason: rejectionReason.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject')
      }

      showNotification('success', 'Deposit rejected')
      fetchDeposits()
    } catch (error: any) {
      console.error('Error rejecting deposit:', error)
      showNotification('error', error.message || 'Failed to reject deposit')
    } finally {
      setSelectedDepositId(null)
      setRejectionReason('')
    }
  }

  // Calculate stats
  const stats = {
    total: allDeposits.length,
    pending: allDeposits.filter(d => d.status === 'pending').length,
    completed: allDeposits.filter(d => d.status === 'completed').length,
    failed: allDeposits.filter(d => d.status === 'failed').length,
    totalAmount: allDeposits.reduce((sum, d) => sum + (d.amount || 0), 0),
    pendingAmount: allDeposits.filter(d => d.status === 'pending').reduce((sum, d) => sum + (d.amount || 0), 0),
    completedAmount: allDeposits.filter(d => d.status === 'completed').reduce((sum, d) => sum + (d.amount || 0), 0),
  }

  const approvedFromTs = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : null
  const approvedToTs = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : null
  const hasApprovedRange = Boolean(approvedFromTs != null || approvedToTs != null)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const approvedWindowFrom = hasApprovedRange ? approvedFromTs : todayStart.getTime()
  const approvedWindowTo = hasApprovedRange ? approvedToTs : todayEnd.getTime()

  const approvedInWindow = allDeposits.filter((d) => {
    if (String(d?.status || '').toLowerCase() !== 'completed') return false
    const created = d?.created_at ? new Date(d.created_at).getTime() : NaN
    if (!Number.isFinite(created)) return false
    if (approvedWindowFrom != null && created < approvedWindowFrom) return false
    if (approvedWindowTo != null && created > approvedWindowTo) return false
    return true
  })

  const approvedCount = approvedInWindow.length
  const approvedAmount = approvedInWindow.reduce((sum, d) => sum + (d.amount || 0), 0)

  // Pagination
  const totalPages = Math.ceil(deposits.length / pageSize)
  const paginatedDeposits = deposits.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <AdminShell title="Deposits Management">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        {receiptOpen && receiptDeposit && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-lg w-full shadow-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">Receipt</h3>
                  <p className="text-xs text-[#A0A0A0] mt-1">Deposit #{String(receiptDeposit?.id || '').slice(0, 8)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptOpen(false)
                    setReceiptDeposit(null)
                  }}
                  className="p-2 rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#d4af35] transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl border border-[#333333] bg-[#1a1a1a] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">User</span>
                  <span className="text-xs text-white font-semibold break-all">{receiptDeposit?.users?.username || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">Telegram ID</span>
                  <span className="text-xs text-white font-semibold break-all">{receiptDeposit?.users?.telegram_id || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">Amount</span>
                  <span className="text-xs text-white font-semibold">{formatCurrency(receiptDeposit?.amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">Method</span>
                  <span className="text-xs text-white font-semibold break-all">{receiptDeposit?.metadata?.payment_method || receiptDeposit?.payment_method || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">Reference</span>
                  <span className="text-xs text-white font-semibold break-all">{receiptDeposit?.metadata?.transaction_reference || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">Status</span>
                  <span className="text-xs text-white font-semibold">{String(receiptDeposit?.status || '').toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#A0A0A0]">Created</span>
                  <span className="text-xs text-white font-semibold">{receiptDeposit?.created_at ? new Date(receiptDeposit.created_at).toLocaleString() : '—'}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => downloadReceipt(receiptDeposit)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptOpen(false)
                    setReceiptDeposit(null)
                  }}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-20 right-4 z-50 px-5 py-3 rounded-lg font-semibold border shadow-lg text-sm ${
            notification.type === 'success'
              ? 'bg-[#d4af35]/15 text-[#d4af35] border border-[#d4af35]/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            <span className="font-semibold">{notification.message}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-3xl font-bold leading-tight mb-2">Deposits Management</h1>
            <p className="text-[#A0A0A0] text-base">Review and approve incoming wallet deposits.</p>
          </div>
          <div className="w-full lg:w-[420px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
              <input
                className="w-full bg-[#252525] border border-[#333333] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#A0A0A0] focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] transition-all"
                placeholder="Search username or Telegram ID..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <DollarSign className="w-16 h-16 text-[#d4af35]" />
            </div>
            <div className="relative z-10 flex flex-col gap-1">
              <p className="text-[#A0A0A0] text-sm font-medium">Total Volume</p>
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.totalAmount)}</h3>
              </div>
              <p className="text-[#A0A0A0] text-xs mt-2">All time</p>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Hourglass className="w-16 h-16 text-[#d4af35]" />
            </div>
            <div className="relative z-10 flex flex-col gap-1">
              <p className="text-[#A0A0A0] text-sm font-medium">Pending Requests</p>
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold text-white tracking-tight">{stats.pending}</h3>
                <span className="text-[#d4af35] text-xs font-bold bg-[#d4af35]/10 px-2 py-0.5 rounded-full border border-[#d4af35]/20">Action Req.</span>
              </div>
              <p className="text-[#A0A0A0] text-xs mt-2">Pending volume: {formatCurrency(stats.pendingAmount)}</p>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <TrendingUp className="w-16 h-16 text-[#d4af35]" />
            </div>
            <div className="relative z-10 flex flex-col gap-1">
              <p className="text-[#A0A0A0] text-sm font-medium">Completed Deposits</p>
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold text-white tracking-tight">{stats.completed}</h3>
              </div>
              <p className="text-[#A0A0A0] text-xs mt-2">Completed volume: {formatCurrency(stats.completedAmount)}</p>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Check className="w-16 h-16 text-[#d4af35]" />
            </div>
            <div className="relative z-10 flex flex-col gap-1">
              <p className="text-[#A0A0A0] text-sm font-medium">{hasApprovedRange ? 'Approved (Range)' : 'Approved Today'}</p>
              <div className="flex items-baseline gap-3">
                <h3 className="text-3xl font-bold text-white tracking-tight">{formatCurrency(approvedAmount)}</h3>
                <span className="text-[#d4af35] text-xs font-bold bg-[#d4af35]/10 px-2 py-0.5 rounded-full border border-[#d4af35]/20">{approvedCount}</span>
              </div>
              <p className="text-[#A0A0A0] text-xs mt-2">Based on current date filter</p>
            </div>
          </div>
        </section>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Approval</h3>
              <p className="text-[#A0A0A0] mb-6">Are you sure you want to approve this deposit?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setSelectedDepositId(null)
                    setConfirmAction(null)
                  }}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApprove}
                  className="flex-1 bg-[#d4af35] hover:bg-[#bfa030] text-[#1C1C1C] px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Reject Deposit</h3>
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
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedDepositId(null)
                    setRejectionReason('')
                  }}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
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

        {/* Main Table Section */}
        <section className="bg-[#252525] rounded-xl border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden min-w-0">
          <div className="p-6 border-b border-[#333333] flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
            <div className="flex flex-wrap gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-[#333333] w-fit max-w-full min-w-0">
              {([
                { key: 'pending', label: 'Pending', count: stats.pending },
                { key: 'completed', label: 'Completed', count: stats.completed },
                { key: 'failed', label: 'Failed / Rejected', count: stats.failed },
              ] as const).map((t) => {
                const active = filter === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setFilter(t.key)}
                    className={
                      active
                        ? 'px-4 py-2 rounded-md text-sm font-bold bg-[#d4af35] text-[#1C1C1C] shadow-sm transition-all flex items-center gap-2'
                        : 'px-4 py-2 rounded-md text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-white/5 transition-all'
                    }
                  >
                    <span>{t.label}</span>
                    <span className={active ? 'bg-black/20 text-black px-1.5 py-0.5 rounded text-[10px]' : 'bg-white/5 text-[#A0A0A0] px-1.5 py-0.5 rounded text-[10px]'}>
                      {t.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A0A0A0]">From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-[#1a1a1a] border border-[#333333] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-[#d4af35]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A0A0A0]">To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-[#1a1a1a] border border-[#333333] rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-[#d4af35]"
                  />
                </div>

                <div className="relative">
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="bg-[#1a1a1a] border border-[#333333] rounded-lg py-2 pl-3 pr-8 text-xs text-white focus:outline-none focus:border-[#d4af35] appearance-none cursor-pointer"
                  >
                    <option value="all">All Methods</option>
                    <option value="chapa">Chapa</option>
                    <option value="telebirr">Telebirr</option>
                    <option value="manual">Manual Bank Transfer</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-[#A0A0A0] pointer-events-none" />
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333333] text-xs text-[#A0A0A0]">
                <span>Showing</span>
                <span className="text-white font-semibold">{paginatedDeposits.length}</span>
                <span>of</span>
                <span className="text-white font-semibold">{deposits.length}</span>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded-lg text-sm font-bold text-white hover:border-[#d4af35] hover:text-[#d4af35] transition-colors"
              >
                Export
              </button>
            </div>
          </div>

          {isDataLoading ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="w-8 h-8 border-4 border-[#d4af35] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[#A0A0A0] text-sm sm:text-base">Loading deposits...</p>
            </div>
          ) : !admin ? (
            <div className="p-8 sm:p-12 text-center text-[#A0A0A0] text-sm sm:text-base">
              Admin session missing. Please log in again to view deposits.
            </div>
          ) : paginatedDeposits.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[#A0A0A0] text-sm sm:text-base">
              No deposits found
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block max-w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[20%]">User</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[10%]">Amount</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[12%]">Method</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[18%]">Reference</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[10%]">Proof</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[10%]">Status</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[12%]">Date</th>
                      <th className="py-4 px-6 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider w-[18%] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333333]">
                    {paginatedDeposits.map((deposit) => (
                      <tr key={deposit.id} className="group hover:bg-[#2a2a2a] transition-colors">
                        <td className="py-4 px-6 align-top">
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-white">{deposit.users?.username || 'Unknown'}</span>
                            <span className="text-xs text-[#A0A0A0]">{deposit.users?.telegram_id || '—'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 align-top">
                          <span className="text-[#d4af35] font-bold text-base">{formatCurrency(deposit.amount)}</span>
                        </td>
                        <td className="py-4 px-6 align-top">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 text-[#A0A0A0] border border-[#333333]">
                            {deposit.metadata?.payment_method || deposit.payment_method || 'Bank Transfer'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-xs text-[#A0A0A0] break-words align-top">
                          {deposit.metadata?.transaction_reference || '—'}
                        </td>
                        <td className="py-4 px-6 text-xs text-[#A0A0A0] align-top">
                          {deposit.metadata?.proof_url ? (
                            <a
                              href={deposit.metadata.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#d4af35] hover:text-white underline"
                            >
                              View Proof
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-4 px-6 align-top">
                          {(() => {
                            const status = String(deposit.status || '').toLowerCase()
                            if (status === 'completed') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-300 border border-green-500/20">
                                  Completed
                                </span>
                              )
                            }
                            if (status === 'pending') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/20">
                                  <span className="size-1.5 rounded-full bg-[#d4af35] animate-pulse" />
                                  Pending
                                </span>
                              )
                            }
                            return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-300 border border-red-500/20">
                                  Failed
                                </span>
                            )
                          })()}
                        </td>
                        <td className="py-4 px-6 align-top">
                          <div className="flex flex-col">
                            <span className="text-sm text-white">{new Date(deposit.created_at).toLocaleDateString()}</span>
                            <span className="text-xs text-[#A0A0A0]">{new Date(deposit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right align-top min-w-0">
                          {deposit.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleApprove(deposit.id)}
                                className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500 text-green-300 hover:text-black transition-colors border border-transparent"
                                type="button"
                                title="Approve"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleReject(deposit.id)}
                                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition-colors border border-transparent"
                                type="button"
                                title="Reject"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ) : deposit.status === 'completed' ? (
                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={() => openReceipt(deposit)}
                                className="w-full max-w-[140px] px-3 py-1.5 rounded-lg border border-[#333333] bg-[#1a1a1a] text-xs font-semibold text-[#A0A0A0] hover:text-white transition-colors"
                              >
                                View Receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendReceipt(deposit.id)}
                                className="w-full max-w-[140px] px-3 py-1.5 rounded-lg border border-[#333333] bg-[#1a1a1a] text-xs font-semibold text-[#A0A0A0] hover:text-[#d4af35] hover:border-[#d4af35] transition-colors"
                              >
                                Send Receipt
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {paginatedDeposits.map((deposit) => (
                  <div key={deposit.id} className="bg-[#1C1C1C] rounded-lg border border-[#333333] p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-white">{deposit.users?.username || 'Unknown'}</div>
                        <div className="text-xs text-[#A0A0A0]">{deposit.users?.telegram_id || '—'}</div>
                      </div>
                      {(() => {
                        const status = String(deposit.status || '').toLowerCase()
                        if (status === 'completed') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-300 border border-green-500/20">
                              Completed
                            </span>
                          )
                        }
                        if (status === 'pending') {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/20">
                              <span className="size-1.5 rounded-full bg-[#d4af35] animate-pulse" />
                              Pending
                            </span>
                          )
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-300 border border-red-500/20">
                            Failed
                          </span>
                        )
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-[#A0A0A0]">Amount</div>
                        <div className="font-bold text-[#d4af35]">{formatCurrency(deposit.amount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#A0A0A0]">Date</div>
                        <div className="text-white">{new Date(deposit.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-[#A0A0A0] mb-1">Method</div>
                        <div className="text-white">{deposit.metadata?.payment_method || deposit.payment_method || 'Bank Transfer'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#A0A0A0] mb-1">Reference</div>
                        <div className="text-white break-words">{deposit.metadata?.transaction_reference || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#A0A0A0] mb-1">Proof</div>
                        {deposit.metadata?.proof_url ? (
                          <a
                            href={deposit.metadata.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#d4af35] hover:text-white underline"
                          >
                            View Proof
                          </a>
                        ) : (
                          <span className="text-[#666]">No Proof</span>
                        )}
                      </div>
                    </div>
                    {deposit.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleApprove(deposit.id)}
                          className="flex-1 bg-[#d4af35] hover:bg-[#bfa030] text-[#1C1C1C] px-3 py-2 rounded text-xs font-semibold transition-colors"
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(deposit.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-semibold transition-colors"
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {deposit.status === 'completed' && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => openReceipt(deposit)}
                          className="w-full bg-[#1a1a1a] border border-[#333333] text-white px-3 py-2 rounded text-xs font-semibold hover:border-[#d4af35] transition-colors"
                        >
                          View Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReceipt(deposit.id)}
                          className="w-full bg-[#1a1a1a] border border-[#333333] text-[#A0A0A0] px-3 py-2 rounded text-xs font-semibold hover:border-[#d4af35] hover:text-[#d4af35] transition-colors"
                        >
                          Send Receipt
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-[#333333]">
                  <div className="text-sm text-[#A0A0A0]">
                    Page {currentPage} of {totalPages} ({deposits.length} total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-[#333333] text-[#A0A0A0] hover:bg-[#333] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      type="button"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-[#333333] text-[#A0A0A0] hover:bg-[#333] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </AdminShell>
  )
}
