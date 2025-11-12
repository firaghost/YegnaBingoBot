"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    fetchTransactions()
  }, [filter, currentPage, dateFilter])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [filter, searchTerm, dateFilter])

  const fetchTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          users (username)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('type', filter)
      }

      // Date filtering
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
        
        query = query.gte('created_at', startDate.toISOString())
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error
      setTransactions(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(tx =>
    tx.users?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="text-xl sm:text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-lg sm:text-2xl font-bold text-white">Transactions</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Enhanced Filters */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 sm:p-6 mb-6 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username or transaction ID..."
              className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg focus:border-blue-400 focus:outline-none text-white placeholder-gray-400"
            />
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 rounded-lg bg-white/10 border-2 border-white/20 text-gray-300 hover:bg-white/20"
            >
              Clear
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {['all', 'stake', 'win', 'deposit', 'withdrawal'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 sm:px-6 py-2 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  filter === type
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <span className="text-gray-300 text-sm font-medium">Time Period:</span>
            {['all', 'today', 'week', 'month'].map((period) => (
              <button
                key={period}
                onClick={() => setDateFilter(period)}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  dateFilter === period
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Results Info */}
          <div className="flex justify-between items-center text-sm text-gray-400">
            <span>Showing {filteredTransactions.length} of {totalCount} transactions</span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-gray-300 font-mono text-xs">{tx.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-white">{tx.users?.username || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tx.type === 'win' ? 'bg-green-500/20 text-green-400' :
                          tx.type === 'stake' ? 'bg-red-500/20 text-red-400' :
                          tx.type === 'deposit' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${
                          tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {tx.status || 'completed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
            <div className="text-3xl font-bold text-white">{transactions.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Volume</div>
            <div className="text-3xl font-bold text-blue-400">
              {formatCurrency(transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0))}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Deposits</div>
            <div className="text-3xl font-bold text-green-400">
              {transactions.filter(tx => tx.type === 'deposit').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Withdrawals</div>
            <div className="text-3xl font-bold text-yellow-400">
              {transactions.filter(tx => tx.type === 'withdrawal').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
