"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending')

  useEffect(() => {
    fetchDeposits()
  }, [filter])

  const fetchDeposits = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/deposits?status=${filter}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch deposits')
      }

      setDeposits(result.data || [])
    } catch (error) {
      console.error('Error fetching deposits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (depositId: string) => {
    if (!confirm('Approve this deposit?')) return

    try {
      const response = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          transactionId: depositId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve')
      }

      alert('Deposit approved successfully!')
      fetchDeposits()
    } catch (error: any) {
      console.error('Error approving deposit:', error)
      alert(error.message || 'Failed to approve deposit')
    }
  }

  const handleReject = async (depositId: string) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    try {
      const response = await fetch('/api/admin/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          transactionId: depositId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject')
      }

      alert('Deposit rejected')
      fetchDeposits()
    } catch (error: any) {
      console.error('Error rejecting deposit:', error)
      alert(error.message || 'Failed to reject deposit')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <Link href="/admin" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white">💵 Deposit Management</h1>
          <p className="text-gray-400 text-sm">Approve or reject deposit requests</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Filter Tabs - Mobile Responsive */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
          {(['all', 'pending', 'completed', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 sm:px-6 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Deposits List - Mobile Responsive */}
        {loading ? (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading deposits...</p>
          </div>
        ) : deposits.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-400 text-lg">No deposits found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View - Hidden on Mobile */}
            <div className="hidden lg:block bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Payment Method</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Reference</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Proof</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {deposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-white">{deposit.users?.username || 'Unknown'}</div>
                          <div className="text-sm text-gray-400">ID: {deposit.users?.telegram_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-400">{formatCurrency(deposit.amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">{deposit.payment_method || 'Bank Transfer'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300 text-sm">{deposit.transaction_reference || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {deposit.proof_url ? (
                          <a
                            href={deposit.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm underline"
                          >
                            View Proof
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">No proof</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400 text-sm">
                          {new Date(deposit.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            deposit.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : deposit.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {deposit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {deposit.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(deposit.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleReject(deposit.id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                              ✗ Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Mobile Card View - Visible on Mobile Only */}
            <div className="lg:hidden space-y-4">
              {deposits.map((deposit) => (
                <div key={deposit.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-white">{deposit.users?.username || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">ID: {deposit.users?.telegram_id}</div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        deposit.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : deposit.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {deposit.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Amount:</span>
                      <span className="font-bold text-green-400">{formatCurrency(deposit.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Method:</span>
                      <span className="text-gray-300 text-sm">{deposit.metadata?.payment_method || 'Bank Transfer'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Reference:</span>
                      <span className="text-gray-300 text-sm">{deposit.metadata?.transaction_reference || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Date:</span>
                      <span className="text-gray-400 text-sm">
                        {new Date(deposit.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {deposit.metadata?.proof_url && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Proof:</span>
                        <a
                          href={deposit.metadata.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                          View Proof
                        </a>
                      </div>
                    )}
                  </div>

                  {deposit.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(deposit.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(deposit.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
