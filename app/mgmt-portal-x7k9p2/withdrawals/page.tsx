"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<{id: string, userId: string, amount: number} | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)

  useEffect(() => {
    fetchWithdrawals()
  }, [filter])

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch(`/api/admin/withdrawals?status=${filter}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch withdrawals')
      }

      setWithdrawals(result.data || [])
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="text-xl sm:text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-lg sm:text-2xl font-bold text-white">Withdrawal Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border animate-slide-in ${
            notification.type === 'success'
              ? 'bg-green-500/90 border-green-400 text-white'
              : 'bg-red-500/90 border-red-400 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{notification.type === 'success' ? '✓' : '✗'}</span>
              <span className="font-semibold">{notification.message}</span>
            </div>
          </div>
        )}

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

        {/* Filter Tabs - Mobile Responsive */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {['pending', 'approved', 'rejected', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  filter === status
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Withdrawals List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-500">
              Loading withdrawals...
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-500">
              No {filter !== 'all' ? filter : ''} withdrawals found
            </div>
          ) : (
            withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="bg-gray rounded-xl shadow-lg p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* User Info */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">User Information</h3>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Username:</span>
                        <span className="font-semibold">{withdrawal.users?.username || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Telegram ID:</span>
                        <span className="font-semibold">{withdrawal.users?.telegram_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-bold text-green-600">{formatCurrency(withdrawal.amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Bank Details</h3>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bank:</span>
                        <span className="font-semibold">{withdrawal.bank_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Account:</span>
                        <span className="font-semibold">{withdrawal.account_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Holder:</span>
                        <span className="font-semibold">{withdrawal.account_holder}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Status & Actions</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          withdrawal.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {withdrawal.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested: {new Date(withdrawal.created_at).toLocaleString()}
                      </div>
                      {withdrawal.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleApprove(withdrawal.id)}
                            className="flex-1 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-green-700 transition-colors"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleReject(withdrawal.id, withdrawal.user_id, withdrawal.amount)}
                            className="flex-1 bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-red-700 transition-colors"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      )}
                      {withdrawal.admin_notes && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          Note: {withdrawal.admin_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats - Mobile Responsive */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mt-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-1">Pending</div>
            <div className="text-3xl font-bold text-yellow-600">
              {withdrawals.filter(w => w.status === 'pending').length}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-1">Approved</div>
            <div className="text-3xl font-bold text-green-600">
              {withdrawals.filter(w => w.status === 'approved').length}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-1">Rejected</div>
            <div className="text-3xl font-bold text-red-600">
              {withdrawals.filter(w => w.status === 'rejected').length}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-sm text-gray-500 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
