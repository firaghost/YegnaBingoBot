"use client"

import { useState, useEffect, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { Calendar, ChevronDown, Download, Search } from 'lucide-react'

export default function AdminTransactionsPage() {
  const [allTransactions, setAllTransactions] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useLocalStorage('transactions_typeFilter', 'all')
  const [statusFilter, setStatusFilter] = useLocalStorage('transactions_statusFilter', 'all')
  const [searchTerm, setSearchTerm] = useLocalStorage('transactions_search', '')
  const [dateFilter, setDateFilter] = useLocalStorage('transactions_dateFilter', 'all')
  const [walletFilter, setWalletFilter] = useLocalStorage('transactions_walletFilter', 'all')
  const [currentPage, setCurrentPage] = useLocalStorage('transactions_page', 1)
  const [pageSize, setPageSize] = useLocalStorage('transactions_pageSize', 10)
  const [referralStats, setReferralStats] = useState({ totalAmount: 0, totalInvites: 0, uniqueReferrers: 0 })

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    filterTransactions()
    setCurrentPage(1)
  }, [typeFilter, statusFilter, searchTerm, dateFilter, walletFilter, allTransactions])

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

  const aggregateReferralTransactions = (original: any[]) => {
    const referralMap = new Map<string, {
      userId: string
      totalAmount: number
      count: number
      latestDate: string
      status: string | null
      users: any
    }>()
    const normalized: any[] = []

    for (const tx of original) {
      if (tx.type === 'referral_bonus') {
        const key = tx.user_id || tx.users?.id || tx.id
        if (!key) {
          normalized.push(tx)
          continue
        }
        if (!referralMap.has(key)) {
          referralMap.set(key, {
            userId: key,
            totalAmount: 0,
            count: 0,
            latestDate: tx.created_at,
            status: tx.status || 'completed',
            users: tx.users || null
          })
        }
        const entry = referralMap.get(key)!
        entry.totalAmount += Number(tx.amount) || 0
        entry.count += 1
        entry.status = tx.status || entry.status
        if (!entry.users && tx.users) entry.users = tx.users
        if (!entry.latestDate || new Date(tx.created_at) > new Date(entry.latestDate)) {
          entry.latestDate = tx.created_at
        }
      } else {
        normalized.push(tx)
      }
    }

    const referralEntries = Array.from(referralMap.values()).map((entry) => ({
      id: `referral-${entry.userId}`,
      user_id: entry.userId,
      type: 'referral_bonus',
      amount: entry.totalAmount,
      status: entry.status || 'completed',
      created_at: entry.latestDate,
      metadata: {
        referral_count: entry.count
      },
      users: entry.users
    }))

    const normalizedTransactions = [...normalized, ...referralEntries].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime()
      const bTime = new Date(b.created_at).getTime()
      return bTime - aTime
    })

    const summary = {
      totalAmount: referralEntries.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
      totalInvites: referralEntries.reduce((sum, tx) => sum + (tx.metadata?.referral_count || 0), 0),
      uniqueReferrers: referralEntries.length
    }

    return { normalizedTransactions, referralSummary: summary }
  }

  const filterTransactions = () => {
    const { normalizedTransactions, referralSummary } = aggregateReferralTransactions(allTransactions)
    setReferralStats(referralSummary)

    let filtered = normalizedTransactions

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

    // Filter by wallet (derived)
    if (walletFilter !== 'all') {
      filtered = filtered.filter((tx: any) => {
        const meta = tx?.metadata || {}
        const source = meta?.source as string | undefined
        const stakeSource = meta?.stake_source as string | undefined
        const creditedTo = meta?.credited_to as string | undefined

        const resolved = (() => {
          if (tx.type === 'bonus' || tx.type === 'referral_bonus') return 'bonus'
          if (tx.type === 'stake') {
            const s = stakeSource || source
            if (s === 'bonus') return 'bonus'
            if (s === 'mixed') return 'mixed'
            return 'real'
          }
          if (tx.type === 'win') {
            if (creditedTo === 'bonus_win') return 'bonus'
            return 'real'
          }
          return 'real'
        })()

        if (walletFilter === 'real') return resolved === 'real'
        if (walletFilter === 'bonus') return resolved === 'bonus'
        return true
      })
    }

    setTransactions(filtered)
  }

  const totalPages = Math.ceil(transactions.length / pageSize)
  const paginatedTransactions = transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const exportCsv = () => {
    const rows = transactions.map((tx: any) => ({
      transaction_id: tx.id,
      user: tx.users?.username || '',
      telegram_id: tx.users?.telegram_id || '',
      type: tx.type,
      status: tx.status || 'completed',
      amount: Number(tx.amount || 0),
      created_at: tx.created_at,
    }))

    const headers = ['transaction_id', 'user', 'telegram_id', 'type', 'status', 'amount', 'created_at']
    const escape = (v: any) => {
      const s = String(v ?? '')
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const csv = [headers.join(',')]
      .concat(rows.map(r => headers.map(h => escape((r as any)[h])).join(',')))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const typeMeta = (type: string) => {
    switch (type) {
      case 'deposit':
        return { label: 'Deposit', badge: 'bg-green-500/10 text-green-400 border-green-500/20', dot: 'bg-green-400' }
      case 'withdrawal':
        return { label: 'Withdrawal', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400' }
      case 'stake':
        return { label: 'Game Play', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' }
      case 'bonus':
        return { label: 'Bonus', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', dot: 'bg-purple-400' }
      case 'referral_bonus':
        return { label: 'Referral Bonus', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', dot: 'bg-purple-400' }
      case 'win':
        return { label: 'Win', badge: 'bg-green-500/10 text-green-400 border-green-500/20', dot: 'bg-green-400' }
      default:
        return { label: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown', badge: 'bg-gray-500/10 text-gray-300 border-gray-500/20', dot: 'bg-gray-300' }
    }
  }

  const pageItems = useMemo(() => {
    if (totalPages <= 1) return [] as (number | 'ellipsis')[]
    const current = Number(currentPage)
    const pages: (number | 'ellipsis')[] = []
    const push = (p: number | 'ellipsis') => pages.push(p)

    push(1)
    const start = Math.max(2, current - 1)
    const end = Math.min(totalPages - 1, current + 1)

    if (start > 2) push('ellipsis')
    for (let p = start; p <= end; p++) push(p)
    if (end < totalPages - 1) push('ellipsis')
    if (totalPages > 1) push(totalPages)
    return pages
  }, [currentPage, totalPages])

  return (
    <AdminShell title="Transactions">
      <div className="container mx-auto px-4 py-8 md:px-8 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Transactions History</h1>
            <p className="text-[#A0A0A0]">View and audit all financial activities across the platform.</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 bg-[#eec02b] hover:bg-[#d4aa24] text-black px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-[0_0_15px_rgba(238,192,43,0.15)]"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-6">
          <div className="lg:col-span-4">
            <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
              <input
                className="w-full bg-[#252525] border border-[#333333] text-white text-sm rounded-lg focus:ring-1 focus:ring-[#eec02b] focus:border-[#eec02b] block pl-10 p-3 placeholder-gray-500"
                placeholder="Search by Transaction ID or User..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5 uppercase tracking-wider">Type</label>
            <div className="relative">
              <select
                className="w-full bg-[#252525] border border-[#333333] text-white text-sm rounded-lg focus:ring-1 focus:ring-[#eec02b] focus:border-[#eec02b] block p-3 appearance-none cursor-pointer"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="stake">Game Play</option>
                <option value="bonus">Bonus</option>
                <option value="referral_bonus">Referral Bonus</option>
                <option value="win">Win</option>
              </select>
              <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] pointer-events-none" />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5 uppercase tracking-wider">Wallet</label>
            <div className="relative">
              <select
                className="w-full bg-[#252525] border border-[#333333] text-white text-sm rounded-lg focus:ring-1 focus:ring-[#eec02b] focus:border-[#eec02b] block p-3 appearance-none cursor-pointer"
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value)}
              >
                <option value="all">All Wallets</option>
                <option value="real">Real Money</option>
                <option value="bonus">Bonus Balance</option>
              </select>
              <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] pointer-events-none" />
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className="block text-xs font-medium text-[#A0A0A0] mb-1.5 uppercase tracking-wider">Date Range</label>
            <div className="relative">
              <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
              <select
                className="w-full bg-[#252525] border border-[#333333] text-white text-sm rounded-lg focus:ring-1 focus:ring-[#eec02b] focus:border-[#eec02b] block pl-10 p-3 appearance-none cursor-pointer"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-[#A0A0A0] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Transactions Table/Cards */}
        <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-[#A0A0A0]">Loading transactions...</div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="p-10 text-center text-[#A0A0A0]">No transactions found</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider bg-[#2A2A2A] border-b border-[#333333]">Transaction ID</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider bg-[#2A2A2A] border-b border-[#333333]">User</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider bg-[#2A2A2A] border-b border-[#333333]">Type</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider bg-[#2A2A2A] border-b border-[#333333]">Wallet</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider bg-[#2A2A2A] border-b border-[#333333]">Date &amp; Time</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider bg-[#2A2A2A] border-b border-[#333333] text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333333]">
                    {paginatedTransactions.map((tx: any) => {
                      const rBefore = tx?.metadata?.real_balance_before
                      const rAfter = tx?.metadata?.real_balance_after
                      const bwBefore = tx?.metadata?.bonus_win_balance_before
                      const bwAfter = tx?.metadata?.bonus_win_balance_after
                      const hasReal = typeof rBefore === 'number' && typeof rAfter === 'number'
                      const hasBonusWin = typeof bwBefore === 'number' && typeof bwAfter === 'number'
                      const source = tx?.metadata?.source as string | undefined
                      const creditedTo = tx?.metadata?.credited_to as string | undefined
                      let walletBadge: string | null = null
                      if (tx.type === 'stake') {
                        walletBadge = source === 'main' ? 'Cash' : source === 'bonus' ? 'Bonus' : source === 'mixed' ? 'Mixed' : null
                      } else if (tx.type === 'win') {
                        walletBadge = creditedTo === 'real' ? 'Cash Win' : creditedTo === 'bonus_win' ? 'Bonus Win' : null
                      }

                      let walletLabel: string = '—'
                      if (walletBadge) walletLabel = walletBadge
                      else if (hasReal) walletLabel = 'Real Money'
                      else if (hasBonusWin) walletLabel = 'Bonus Balance'
                      else if (tx.metadata?.wallet) walletLabel = String(tx.metadata.wallet)

                      const meta = typeMeta(tx.type)
                      const isBonusWallet = walletLabel.toLowerCase().includes('bonus')
                      const amountText = tx.amount < 0 ? 'text-red-400' : isBonusWallet ? 'text-[#eec02b]' : 'text-white'

                      return (
                        <tr key={tx.id} className="hover:bg-[#2e2e2e] transition-colors group">
                          <td className="px-6 py-4 text-sm text-[#A0A0A0] font-mono">{String(tx.id).slice(0, 8)}…</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#eec02b]/20 text-[#eec02b] flex items-center justify-center font-bold text-xs">
                                {String(tx.users?.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-white text-sm">{tx.users?.username || 'Unknown'}</div>
                                <div className="text-xs text-[#A0A0A0]">{tx.users?.telegram_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-sm ${isBonusWallet ? 'text-[#eec02b]' : 'text-gray-300'}`}>{walletLabel}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-[#A0A0A0]">
                              {new Date(tx.created_at).toLocaleDateString()} <span className="text-[#555] mx-1">|</span> {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-sm font-bold font-mono ${amountText}`}>
                              {tx.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </td>
                        </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {paginatedTransactions.map((tx: any) => {
                  const source = tx?.metadata?.source as string | undefined
                  const creditedTo = tx?.metadata?.credited_to as string | undefined
                  let walletBadge: string | null = null
                  if (tx.type === 'stake') {
                    walletBadge = source === 'main' ? 'Cash' : source === 'bonus' ? 'Bonus' : source === 'mixed' ? 'Mixed' : null
                  } else if (tx.type === 'win') {
                    walletBadge = creditedTo === 'real' ? 'Cash Win' : creditedTo === 'bonus_win' ? 'Bonus Win' : null
                  }

                  let walletLabel: string = '—'
                  if (walletBadge) walletLabel = walletBadge
                  else if (tx.metadata?.wallet) walletLabel = String(tx.metadata.wallet)
                  const username = tx.users?.username || 'Unknown'
                  const initial = String(username || 'U').charAt(0).toUpperCase()
                  const meta = typeMeta(tx.type)
                  const isBonusWallet = walletLabel.toLowerCase().includes('bonus')
                  const amountText = tx.amount < 0 ? 'text-red-400' : isBonusWallet ? 'text-[#eec02b]' : 'text-white'
                  return (
                    <div key={tx.id} className="bg-[#2A2A2A] rounded-xl border border-[#333333] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#eec02b]/20 text-[#eec02b] flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white text-sm truncate">{username}</div>
                            <div className="text-xs text-[#A0A0A0] truncate">{tx.users?.telegram_id}</div>
                          </div>
                        </div>
                        <div className="text-xs text-[#A0A0A0] font-mono flex-shrink-0">{String(tx.id).slice(0, 8)}…</div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[11px] text-[#A0A0A0] uppercase tracking-wider">Wallet</div>
                          <div className={`text-sm mt-0.5 ${isBonusWallet ? 'text-[#eec02b]' : 'text-gray-300'}`}>{walletLabel}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#A0A0A0] uppercase tracking-wider">Date &amp; Time</div>
                          <div className="text-sm text-[#A0A0A0] mt-0.5">
                            {new Date(tx.created_at).toLocaleDateString()} <span className="text-[#555] mx-1">|</span> {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-between">
                          <div className="text-[11px] text-[#A0A0A0] uppercase tracking-wider">Amount</div>
                          <div className={`text-sm font-bold font-mono ${amountText}`}>
                            {tx.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </div>
                        </div>
                      </div>
                    </div>
                )})}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-[#333333] flex items-center justify-between bg-[#282828]">
                  <div className="hidden sm:block">
                    <p className="text-sm text-[#A0A0A0]">
                      Showing <span className="font-medium text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                      <span className="font-medium text-white">{Math.min(currentPage * pageSize, transactions.length)}</span> of{' '}
                      <span className="font-medium text-white">{transactions.length}</span> results
                    </p>
                  </div>
                  <div className="flex flex-1 justify-between sm:justify-end gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-lg bg-[#252525] px-3 py-2 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-[#333333] hover:bg-[#333] transition-colors disabled:opacity-50"
                    >
                      Previous
                    </button>

                    <div className="hidden sm:flex gap-1">
                      {pageItems.map((p, idx) =>
                        p === 'ellipsis' ? (
                          <span key={`e-${idx}`} className="relative inline-flex items-center px-2 py-2 text-sm font-semibold text-gray-500">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={
                              p === currentPage
                                ? 'relative inline-flex items-center rounded-lg bg-[#eec02b] px-3 py-2 text-sm font-bold text-black focus:z-20'
                                : 'relative inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-[#333] transition-colors focus:z-20'
                            }
                          >
                            {p}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-lg bg-[#252525] px-3 py-2 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-[#333333] hover:bg-[#333] transition-colors disabled:opacity-50"
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
    </AdminShell>
  )
}
