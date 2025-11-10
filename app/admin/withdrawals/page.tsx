"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    fetchWithdrawals()
  }, [filter])

  const fetchWithdrawals = async () => {
    try {
      let query = supabase
        .from('withdrawals')
        .select(`
          *,
          users (username, telegram_id)
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setWithdrawals(data || [])
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (withdrawalId: string) => {
    if (!confirm('Approve this withdrawal?')) return

    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ 
          status: 'approved',
          processed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId)

      if (error) throw error
      
      alert('Withdrawal approved!')
      fetchWithdrawals()
    } catch (error) {
      console.error('Error approving withdrawal:', error)
      alert('Failed to approve withdrawal')
    }
  }

  const handleReject = async (withdrawalId: string, userId: string, amount: number) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    try {
      // Reject withdrawal
      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .update({ 
          status: 'rejected',
          admin_notes: reason,
          processed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId)

      if (withdrawalError) throw withdrawalError

      // Refund balance to user
      const { error: userError } = await supabase.rpc('increment', {
        row_id: userId,
        x: amount
      })

      if (userError) throw userError

      alert('Withdrawal rejected and balance refunded')
      fetchWithdrawals()
    } catch (error) {
      console.error('Error rejecting withdrawal:', error)
      alert('Failed to reject withdrawal')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-2xl font-bold text-white">Withdrawal Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Filter Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <div className="flex gap-4">
            {['pending', 'approved', 'rejected', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
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
            <div className="bg-white rounded-xl shadow-lg p-12 text-center text-gray-500">
              Loading withdrawals...
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center text-gray-500">
              No {filter !== 'all' ? filter : ''} withdrawals found
            </div>
          ) : (
            withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="bg-white rounded-xl shadow-lg p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* User Info */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">User Information</h3>
                    <div className="space-y-2 text-sm">
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
                    <h3 className="font-semibold text-gray-800 mb-3">Bank Details</h3>
                    <div className="space-y-2 text-sm">
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
                    <h3 className="font-semibold text-gray-800 mb-3">Status & Actions</h3>
                    <div className="space-y-3">
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(withdrawal.id)}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(withdrawal.id, withdrawal.user_id, withdrawal.amount)}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                          >
                            Reject
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
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
