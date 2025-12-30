"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { formatCurrency } from '@/lib/utils'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import {
  Search,
  Plus,
  Eye,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

type SortField = 'username' | 'balance' | 'games_played' | 'games_won' | 'created_at' | 'total_referrals' | 'referral_earnings'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'pending' | 'inactive'

const timeAgo = (value: any): string => {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const sec = Math.max(0, Math.floor(diffMs / 1000))
  if (sec < 60) return `${sec} sec ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} mins ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hrs ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return `${months} months ago`
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { admin } = useAdminAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [canViewWallets, setCanViewWallets] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        if (admin?.role === 'super_admin') {
          setCanViewWallets(true)
          return
        }
        const enabled = Boolean(await getConfig('support_can_view_wallets'))
        setCanViewWallets(enabled)
      } catch {
        setCanViewWallets(true)
      }
    }
    void load()
  }, [admin?.role])

  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('userMgmt_pageSize')
      return saved ? parseInt(saved) : 50
    }
    return 50
  })
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('userMgmt_currentPage')
      return saved ? parseInt(saved) : 1
    }
    return 1
  })

  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('userMgmt_searchTerm') || ''
    }
    return ''
  })
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('userMgmt_sortField')
      return (saved as SortField) || 'created_at'
    }
    return 'created_at'
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('userMgmt_sortOrder')
      return (saved as SortOrder) || 'desc'
    }
    return 'desc'
  })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('userMgmt_statusFilter')
      return (saved as StatusFilter) || 'all'
    }
    return 'all'
  })
  const [referralStats, setReferralStats] = useState<{ total: number; earnings: number } | null>(null)

  // Save preferences to sessionStorage (only for current session)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('userMgmt_pageSize', pageSize.toString())
      sessionStorage.setItem('userMgmt_currentPage', currentPage.toString())
      sessionStorage.setItem('userMgmt_searchTerm', searchTerm)
      sessionStorage.setItem('userMgmt_sortField', sortField)
      sessionStorage.setItem('userMgmt_sortOrder', sortOrder)
      sessionStorage.setItem('userMgmt_statusFilter', statusFilter)
    }
  }, [pageSize, currentPage, searchTerm, sortField, sortOrder, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Fetch ALL users with pagination (Supabase has 1000 row limit per query)
      let allUsers: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error

        if (!data || data.length === 0) {
          hasMore = false
        } else {
          allUsers = [...allUsers, ...data]
          page++
          // Stop if we got less than pageSize (means we reached the end)
          if (data.length < pageSize) {
            hasMore = false
          }
        }
      }

      console.log(`Fetched ${allUsers.length} total users (across ${page} pages)`)
      setUsers(allUsers)

      // Fetch global referral stats from referrals table to match dashboard
      try {
        const referralRes = await supabase
          .from('referrals')
          .select('bonus_amount', { count: 'exact', head: false })
          .eq('status', 'completed')

        if (!referralRes.error) {
          const firstReferralPage = referralRes.data || []
          const totalReferrals =
            (referralRes.count as number | null) ?? (firstReferralPage.length || 0)

          // Compute total referral earnings across all completed referrals, not just the first 1000 rows
          let totalReferralEarnings = firstReferralPage.reduce(
            (sum: number, row: any) => sum + Number(row?.bonus_amount || 0),
            0
          )

          if (referralRes.count && referralRes.count > firstReferralPage.length) {
            const pageSize = 1000
            let page = 1
            let fetched = firstReferralPage.length
            let hasMore = true

            while (hasMore) {
              const { data, error } = await supabase
                .from('referrals')
                .select('bonus_amount')
                .eq('status', 'completed')
                .range(page * pageSize, (page + 1) * pageSize - 1)

              if (error) throw error
              if (!data || data.length === 0) {
                hasMore = false
              } else {
                totalReferralEarnings += data.reduce(
                  (sum: number, row: any) => sum + Number(row?.bonus_amount || 0),
                  0
                )

                fetched += data.length
                page++

                if (data.length < pageSize || (referralRes.count && fetched >= referralRes.count)) {
                  hasMore = false
                }
              }
            }
          }

          setReferralStats({ total: totalReferrals, earnings: totalReferralEarnings })
        }
      } catch (refErr) {
        console.error('Error fetching global referral stats:', refErr)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = 
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.telegram_id?.toString().includes(searchTerm) ||
        user.phone?.toString().includes(searchTerm) ||
        (user.last_seen_city || user.registration_city || '')
          .toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.last_seen_country || user.registration_country || '')
          .toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (aVal === null || aVal === undefined) aVal = 0
      if (bVal === null || bVal === undefined) bVal = 0
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  
  const totalPages = Math.ceil(filteredUsers.length / pageSize)

  const stats = {
    total: users.length,
    active: users.filter(u => u.status !== 'inactive').length,
    totalBalance: canViewWallets ? users.reduce((sum, u) => sum + (u.balance || 0), 0) : 0,
    totalBonusBalance: canViewWallets ? users.reduce((sum, u) => sum + (u.bonus_balance || 0), 0) : 0,
    totalGames: users.reduce((sum, u) => sum + (u.games_played || 0), 0),
    totalWins: users.reduce((sum, u) => sum + (u.games_won || 0), 0),
    withPhone: users.filter(u => u.phone).length,
    totalReferrals: referralStats?.total ?? users.reduce((sum, u) => sum + (u.total_referrals || 0), 0),
    totalReferralEarnings: referralStats?.earnings ?? users.reduce((sum, u) => sum + Number(u.referral_earnings || 0), 0),
  }

  return (
    <AdminShell title="User Management">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8">

        {/* Page Title Section */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">User Management</h1>
            <p className="text-[#A0A0A0] mt-1">Control and inspect all registered players on the platform.</p>
          </div>
          <button
            type="button"
            className="bg-[#d4af35] hover:bg-yellow-500 text-black font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-[0_0_15px_rgba(212,175,53,0.3)]"
            onClick={() => alert('Create User UI only (not implemented yet).')}
          >
            <Plus className="w-5 h-5" />
            Create User
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#252525] rounded-xl p-5 border border-[#333333] shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-white/10" />
            </div>
            <p className="text-[#A0A0A0] text-sm font-medium">Total Users</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-white">{stats.total.toLocaleString()}</h3>
              <span className="text-green-500 text-xs font-medium flex items-center bg-green-500/10 px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3 mr-1" /> 0%
              </span>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-5 border border-[#333333] shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-[#d4af35]/15" />
            </div>
            <p className="text-[#A0A0A0] text-sm font-medium">Active Users (24h)</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-white">{stats.active.toLocaleString()}</h3>
              <span className="text-green-500 text-xs font-medium flex items-center bg-green-500/10 px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3 mr-1" /> 0%
              </span>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-5 border border-[#333333] shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-[#d4af35]/15" />
            </div>
            <p className="text-[#A0A0A0] text-sm font-medium">Real-Money Players</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-[#d4af35]">{canViewWallets ? users.filter((u) => (u.balance || 0) > 0).length.toLocaleString() : '—'}</h3>
              <span className="text-green-500 text-xs font-medium flex items-center bg-green-500/10 px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3 mr-1" /> 0%
              </span>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-5 border border-[#333333] shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-yellow-500/15" />
            </div>
            <p className="text-[#A0A0A0] text-sm font-medium">Bonus-Only Users</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-yellow-500">{canViewWallets ? users.filter((u) => (u.balance || 0) <= 0 && (u.bonus_balance || 0) > 0).length.toLocaleString() : '—'}</h3>
              <span className="text-red-500 text-xs font-medium flex items-center bg-red-500/10 px-1.5 py-0.5 rounded">
                <TrendingDown className="w-3 h-3 mr-1" /> 0%
              </span>
            </div>
          </div>
        </div>

        {/* Filters & Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#252525] p-4 rounded-xl border border-[#333333]">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-[#A0A0A0]" />
            </div>
            <input
              className="block w-full pl-10 pr-3 py-2 border border-[#333333] rounded-lg leading-5 bg-[#1C1C1C] text-white placeholder-[#A0A0A0] focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] sm:text-sm"
              placeholder="Search by User ID, Username, or Email..."
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border-[#333333] bg-[#1C1C1C] text-white focus:outline-none focus:ring-[#d4af35] focus:border-[#d4af35] sm:text-sm rounded-lg"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter)
                setCurrentPage(1)
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Suspended</option>
              <option value="pending">Pending</option>
            </select>
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-[#333333] text-sm font-medium rounded-lg text-white bg-[#1C1C1C] hover:bg-[#333333] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d4af35] transition-colors"
              onClick={() => alert('Activity filter UI only (not implemented yet).')}
            >
              Activity
            </button>
          </div>
        </div>

        {/* Desktop Users Table - Hidden on Mobile */}
        <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#333333]">
              <thead className="bg-[#2c2a24]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">User ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">Username</th>
                  {canViewWallets && (
                    <>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">Real Balance</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">Bonus Balance</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">Locked</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider" scope="col">Last Activity</th>
                  <th className="relative px-6 py-4" scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#333333] bg-[#252525]">
                {loading ? (
                  <tr>
                    <td colSpan={canViewWallets ? 8 : 5} className="px-6 py-10 text-center text-[#A0A0A0]">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#d4af35] border-t-transparent rounded-full animate-spin" />
                        Loading users...
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={canViewWallets ? 8 : 5} className="px-6 py-10 text-center text-[#A0A0A0]">No users found</td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {

                    const status = String(user.status || 'active')
                    const statusStyle =
                      status === 'inactive'
                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                        : status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          : 'bg-green-500/10 text-green-500 border-green-500/20'

                    const lockedAmount = Number(user.locked_balance || user.bonus_win_balance || 0)
                    const lastActivity = timeAgo(user.last_seen_at || user.updated_at || user.created_at)

                    return (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[#A0A0A0]">#{String(user.id).slice(0, 4)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">

                          <div className="flex items-center">
                            <div className="h-9 w-9 rounded-full bg-[#1C1C1C] border border-[#333333] shrink-0 flex items-center justify-center text-[#d4af35] font-bold">
                              {String(user.username || 'U').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">@{user.username || 'unknown'}</div>
                              <div className="text-xs text-[#A0A0A0]">telegram</div>
                            </div>
                          </div>
                        </td>
                        {canViewWallets && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#d4af35]">{formatCurrency(user.balance || 0)} G</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-500">{formatCurrency(user.bonus_balance || 0)} B</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-[#A0A0A0] gap-1" title="Locked">
                                {formatCurrency(lockedAmount)}
                                {lockedAmount > 0 ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 opacity-20" />}
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                            {status === 'inactive' ? 'Suspended' : status === 'pending' ? 'Pending' : 'Active'}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#A0A0A0]">{lastActivity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1 text-[#A0A0A0] hover:text-white hover:bg-white/10 rounded"
                              title="View Profile"
                              type="button"
                              onClick={() => router.push(`/mgmt-portal-x7k9p2/users/${user.id}`)}
                            >
                              <Eye className="w-5 h-5" />
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

          <div className="bg-[#252525] px-4 py-3 flex items-center justify-between border-t border-[#333333] sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-[#A0A0A0]">
                  Showing <span className="font-medium text-white">{filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium text-white">{Math.min(currentPage * pageSize, filteredUsers.length)}</span> of{' '}
                  <span className="font-medium text-white">{filteredUsers.length}</span> results
                </p>
              </div>
              <div>
                {totalPages > 1 && (
                  <nav aria-label="Pagination" className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-[#333333] bg-[#1C1C1C] text-sm font-medium text-[#A0A0A0] hover:bg-white/5 disabled:opacity-50"
                      type="button"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <span className="sr-only">Previous</span>
                      ‹
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1
                      if (totalPages > 5) {
                        if (currentPage <= 3) pageNum = i + 1
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                        else pageNum = currentPage - 2 + i
                      }
                      const active = currentPage === pageNum
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={
                            active
                              ? 'z-10 bg-[#d4af35]/20 border-[#d4af35] text-[#d4af35] relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                              : 'bg-[#1C1C1C] border-[#333333] text-[#A0A0A0] hover:bg-white/5 relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                          }
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    <button
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-[#333333] bg-[#1C1C1C] text-sm font-medium text-[#A0A0A0] hover:bg-white/5 disabled:opacity-50"
                      type="button"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <span className="sr-only">Next</span>
                      ›
                    </button>
                  </nav>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Users Cards - Visible on Mobile Only */}
        <div className="lg:hidden space-y-4 mb-6">
          {loading ? (
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-8 text-center">
              <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading users...</p>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-8 text-center">
              <p className="text-slate-400">No users found</p>
            </div>
          ) : (
            paginatedUsers.map((user) => (
              <div key={user.id} className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {user.username?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-white text-lg">{user.username || 'Unknown'}</div>
                      {user.status === 'inactive' && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                          Suspended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">ID: {user.id.slice(0, 8)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">

                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 text-xs font-medium mb-1">Telegram ID</div>
                    <div className="text-white font-mono text-sm">{user.telegram_id}</div>
                  </div>
                  {user.phone && (
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <div className="text-slate-400 text-xs font-medium mb-2">Phone</div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-cyan-400 font-mono text-sm">{user.phone}</div>
                        <div className="flex gap-1.5">
                          <a href={`tel:${user.phone}`} className="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-2 py-1 rounded transition-colors border border-emerald-500/30 font-medium">Call</a>
                          <button
                            onClick={() => navigator.clipboard.writeText(String(user.phone))}
                            className="text-xs bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 px-2 py-1 rounded transition-colors border border-slate-600/50 font-medium"
                          >Copy</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 text-xs font-medium mb-1">Balance</div>
                    <div className="text-emerald-400 font-semibold">{canViewWallets ? formatCurrency(user.balance || 0) : '—'}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 text-xs font-medium mb-1">Games</div>
                    <div className="text-white font-medium">{user.games_played || 0} / {user.games_won || 0}</div>
                  </div>
                  <div className="col-span-2 bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 text-xs font-medium mb-1">Joined</div>
                    <div className="text-white font-medium">{new Date(user.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Mobile Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-700/30">
                  <button
                    onClick={() => router.push(`/mgmt-portal-x7k9p2/users/${user.id}`)}
                    className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-cyan-500/30"
                  >
                    View
                  </button>
                  {user.phone && (
                    <a
                      href={`tel:${user.phone}`}
                      className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-emerald-500/30 text-center"
                    >
                      Call
                    </a>
                  )}
                  <button
                    onClick={() => {
                      const tgLink = `tg://user?id=${user.telegram_id}`
                      const httpLink = `https://t.me/${user.telegram_id}`
                      const w = window.open(tgLink, '_blank')
                      setTimeout(() => {
                        if (!w || w.closed) window.open(httpLink, '_blank')
                      }, 300)
                    }}
                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-blue-500/30"
                  >
                    Telegram
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </AdminShell>
  )
}