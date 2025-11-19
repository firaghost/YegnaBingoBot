"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminTransactionsPage() {
  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    filterTransactions()
    setCurrentPage(1)
  }, [typeFilter, statusFilter, searchTerm, dateFilter, allTransactions])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          users (username, telegram_id)
        `)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error
      setAllTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterTransactions = () => {
    let filtered = allTransactions

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.type === typeFilter)
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tx => (tx.status || 'completed') === statusFilter)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(tx =>
        tx.users?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.users?.telegram_id?.includes(searchTerm) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate = new Date()
      
      switch (dateFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
      }
      
      filtered = filtered.filter(tx => new Date(tx.created_at) >= startDate)
    }

    setTransactions(filtered)
  }

  const totalPages = Math.ceil(transactions.length / pageSize)
  const paginatedTransactions = transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Calculate stats
  const stats = {
    total: allTransactions.length,
    totalVolume: allTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    wins: allTransactions.filter(tx => tx.type === 'win').reduce((sum, tx) => sum + (tx.amount || 0), 0),
    stakes: allTransactions.filter(tx => tx.type === 'stake').reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0),
    deposits: allTransactions.filter(tx => tx.type === 'deposit').length,
    withdrawals: allTransactions.filter(tx => tx.type === 'withdrawal').length,
    pending: allTransactions.filter(tx => tx.status === 'pending').length,
    completed: allTransactions.filter(tx => (tx.status || 'completed') === 'completed').length,
  }

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
            <h1 className="text-2xl font-bold text-white">Transactions</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700/50 p-3 sm:p-4 hover:border-slate-600/50 transition-all">
            <div className="text-xs text-slate-400 mb-1">Total</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">{formatCurrency(stats.totalVolume)}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 rounded-lg border border-emerald-700/30 p-3 sm:p-4 hover:border-emerald-600/50 transition-all">
            <div className="text-xs text-emerald-400 mb-1">Wins</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">{formatCurrency(stats.wins)}</div>
            <div className="text-xs text-emerald-600 mt-1">{allTransactions.filter(tx => tx.type === 'win').length} games</div>
          </div>
          <div className="bg-gradient-to-br from-red-900/30 to-slate-900 rounded-lg border border-red-700/30 p-3 sm:p-4 hover:border-red-600/50 transition-all">
            <div className="text-xs text-red-400 mb-1">Stakes</div>
            <div className="text-xl sm:text-2xl font-bold text-red-400">{formatCurrency(stats.stakes)}</div>
            <div className="text-xs text-red-600 mt-1">{allTransactions.filter(tx => tx.type === 'stake').length} games</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-900/30 to-slate-900 rounded-lg border border-cyan-700/30 p-3 sm:p-4 hover:border-cyan-600/50 transition-all">
            <div className="text-xs text-cyan-400 mb-1">Deposits</div>
            <div className="text-xl sm:text-2xl font-bold text-cyan-400">{stats.deposits}</div>
            <div className="text-xs text-cyan-600 mt-1">{stats.withdrawals} withdrawals</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search username, Telegram ID, or transaction ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-slate-400 self-center">Type:</span>
                {['all', 'stake', 'win', 'deposit', 'withdrawal'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-2.5 sm:px-3 py-1 rounded text-xs font-semibold transition-all ${
                      typeFilter === type
                        ? 'bg-cyan-600/80 text-white border border-cyan-500/50'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-slate-400 self-center">Status:</span>
                {['all', 'pending', 'completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 sm:px-3 py-1 rounded text-xs font-semibold transition-all ${
                      statusFilter === status
                        ? 'bg-cyan-600/80 text-white border border-cyan-500/50'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-slate-400 self-center">Date:</span>
                {['all', 'today', 'week', 'month'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setDateFilter(period)}
                    className={`px-2.5 sm:px-3 py-1 rounded text-xs font-semibold transition-all ${
                      dateFilter === period
                        ? 'bg-cyan-600/80 text-white border border-cyan-500/50'
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50'
                    }`}
                  >
                    {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table/Cards */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400 text-sm sm:text-base">Loading transactions...</p>
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-400 text-sm sm:text-base">
              No transactions found
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-700/50 bg-slate-900/50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">User</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Type</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Amount</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Status</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {paginatedTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 sm:px-6 py-4">
                          <div>
                            <div className="font-semibold text-white text-sm">{tx.users?.username || 'Unknown'}</div>
                            <div className="text-xs text-slate-400">{tx.users?.telegram_id}</div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            tx.type === 'win' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            tx.type === 'stake' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            tx.type === 'deposit' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className={`font-bold text-sm ${
                            tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            (tx.status || 'completed') === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            {(tx.status || 'completed').charAt(0).toUpperCase() + (tx.status || 'completed').slice(1)}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-slate-400">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {paginatedTransactions.map((tx: any) => (
                  <div key={tx.id} className="bg-slate-700/30 rounded-lg border border-slate-700/50 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-white">{tx.users?.username || 'Unknown'}</div>
                        <div className="text-xs text-slate-400">{tx.users?.telegram_id}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        tx.type === 'win' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        tx.type === 'stake' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        tx.type === 'deposit' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-400">Amount</div>
                        <div className={`font-bold ${
                          tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Date</div>
                        <div className="text-slate-300">{new Date(tx.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-slate-400 mb-1">Status</div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${
                          (tx.status || 'completed') === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {(tx.status || 'completed').charAt(0).toUpperCase() + (tx.status || 'completed').slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-700/50">
                  <div className="text-sm text-slate-400">
                    Page {currentPage} of {totalPages} ({transactions.length} total)
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
