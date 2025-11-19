"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [allWithdrawals, setAllWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<{id: string, userId: string, amount: number} | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchWithdrawals()
  }, [])

  useEffect(() => {
    filterWithdrawals()
    setCurrentPage(1)
  }, [filter, searchTerm, allWithdrawals])

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch('/api/admin/withdrawals?status=all')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch withdrawals')
      }

      setAllWithdrawals(result.data || [])
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterWithdrawals = () => {
    let filtered = allWithdrawals

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(w => w.status === filter)
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

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleApprove = (withdrawalId: string) => {
    setSelectedWithdrawal({ id: withdrawalId, userId: '', amount: 0 })
    setShowConfirmDialog(true)
  }

  const confirmApprove = async () => {
    if (!selectedWithdrawal) return
    
    setShowConfirmDialog(false)
    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    setSelectedWithdrawal({ id: withdrawalId, userId, amount })
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const confirmReject = async () => {
    if (!selectedWithdrawal || !rejectionReason.trim()) {
      showNotification('error', 'Please enter a rejection reason')
      return
    }

    setShowRejectModal(false)
    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Pagination
  const totalPages = Math.ceil(withdrawals.length / pageSize)
  const paginatedWithdrawals = withdrawals.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/mgmt-portal-x7k9p2" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-white">Withdrawal Management</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border ${
            notification.type === 'success'
              ? 'bg-emerald-500/90 border-emerald-400 text-white'
              : 'bg-red-500/90 border-red-400 text-white'
          }`}>
            <span className="font-semibold">{notification.message}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700/50 p-3 sm:p-4 hover:border-slate-600/50 transition-all">
            <div className="text-xs text-slate-400 mb-1">Total</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">{formatCurrency(stats.totalAmount)}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/30 to-slate-900 rounded-lg border border-yellow-700/30 p-3 sm:p-4 hover:border-yellow-600/50 transition-all">
            <div className="text-xs text-yellow-400 mb-1">Pending</div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-xs text-yellow-600 mt-1">{formatCurrency(stats.pendingAmount)}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 rounded-lg border border-emerald-700/30 p-3 sm:p-4 hover:border-emerald-600/50 transition-all">
            <div className="text-xs text-emerald-400 mb-1">Approved</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.approved}</div>
            <div className="text-xs text-emerald-600 mt-1">{formatCurrency(stats.approvedAmount)}</div>
          </div>
          <div className="bg-gradient-to-br from-red-900/30 to-slate-900 rounded-lg border border-red-700/30 p-3 sm:p-4 hover:border-red-600/50 transition-all">
            <div className="text-xs text-red-400 mb-1">Rejected</div>
            <div className="text-xl sm:text-2xl font-bold text-red-400">{stats.rejected}</div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Approval</h3>
              <p className="text-gray-300 mb-6">Are you sure you want to approve this withdrawal?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setSelectedWithdrawal(null)
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApprove}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
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
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Reject Withdrawal</h3>
              <p className="text-gray-300 mb-4">Please provide a reason for rejection:</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-6 min-h-[100px] resize-none"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedWithdrawal(null)
                    setRejectionReason('')
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
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

        {/* Search and Filter */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search username or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            <div className="flex gap-2 flex-wrap">
              {['all', 'pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm ${
                    filter === status
                      ? 'bg-cyan-600/80 text-white border border-cyan-500/50'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Withdrawals Table/Cards */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400 text-sm sm:text-base">Loading withdrawals...</p>
            </div>
          ) : paginatedWithdrawals.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-400 text-sm sm:text-base">
              No withdrawals found
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-700/50 bg-slate-900/50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">User</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Amount</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Bank</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Status</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Date</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {paginatedWithdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 sm:px-6 py-4">
                          <div>
                            <div className="font-semibold text-white text-sm">{withdrawal.users?.username || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{withdrawal.users?.telegram_id}</div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className="font-bold text-cyan-400 text-sm">{formatCurrency(withdrawal.amount)}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="text-sm text-slate-300">{withdrawal.bank_name}</div>
                          <div className="text-xs text-slate-500">{withdrawal.account_number}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            withdrawal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            withdrawal.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-slate-400">
                          {new Date(withdrawal.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          {withdrawal.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(withdrawal.id)}
                                className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-2 sm:px-3 py-1 rounded text-xs font-semibold transition-colors border border-emerald-500/30"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(withdrawal.id, withdrawal.user_id, withdrawal.amount)}
                                className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-2 sm:px-3 py-1 rounded text-xs font-semibold transition-colors border border-red-500/30"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {paginatedWithdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="bg-slate-700/30 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-white">{withdrawal.users?.username || 'Unknown'}</div>
                        <div className="text-xs text-slate-400">{withdrawal.users?.telegram_id}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        withdrawal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        withdrawal.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-400">Amount</div>
                        <div className="font-bold text-cyan-400">{formatCurrency(withdrawal.amount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Date</div>
                        <div className="text-slate-300">{new Date(withdrawal.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-slate-400 mb-1">Bank</div>
                        <div className="text-slate-300">{withdrawal.bank_name}</div>
                        <div className="text-xs text-slate-500">{withdrawal.account_number}</div>
                      </div>
                    </div>
                    {withdrawal.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleApprove(withdrawal.id)}
                          className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-3 py-2 rounded text-xs font-semibold transition-colors border border-emerald-500/30"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(withdrawal.id, withdrawal.user_id, withdrawal.amount)}
                          className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded text-xs font-semibold transition-colors border border-red-500/30"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-700/50">
                  <div className="text-sm text-slate-400">
                    Page {currentPage} of {totalPages} ({withdrawals.length} total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded bg-slate-700/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600/50 transition-colors text-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded bg-slate-700/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600/50 transition-colors text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
