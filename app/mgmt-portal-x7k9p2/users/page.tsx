"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

type SortField = 'username' | 'balance' | 'games_played' | 'games_won' | 'created_at' | 'total_referrals' | 'referral_earnings'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'pending' | 'inactive'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)
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
  const [userGames, setUserGames] = useState<any[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [showGameHistory, setShowGameHistory] = useState(false)
  const [userTransactions, setUserTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
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
  const { admin } = useAdminAuth()
  const [walletActionLoading, setWalletActionLoading] = useState(false)

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

  // Auto-fetch games when user modal opens
  useEffect(() => {
    if (showUserModal && selectedUser && userGames.length === 0) {
      fetchUserGames(selectedUser)
    }
  }, [showUserModal, selectedUser?.id])

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

  const handleToggleSuspend = async () => {
    if (!selectedUser) return

    setDeletingUser(true)
    try {
      const nextStatus = selectedUser.status === 'inactive' ? 'active' : 'inactive'

      const finalReason = suspendReason.trim() || 'Manual suspension from admin Users page'
      const nowIso = new Date().toISOString()
      const updates: any =
        nextStatus === 'inactive'
          ? {
              status: nextStatus,
              suspension_reason: finalReason,
              suspended_at: nowIso,
            }
          : {
              status: nextStatus,
              suspension_reason: null,
            }

      const { error: userError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', selectedUser.id)

      if (userError) throw userError

      if (nextStatus === 'inactive') {
        try {
          await supabase
            .from('user_suspensions')
            .insert({
              user_id: selectedUser.id,
              reason: finalReason,
              source: 'manual_admin',
              context: { from: 'users_page' },
            } as any)
        } catch (logErr) {
          console.error('Failed to log manual suspension:', logErr)
        }
      }

      await fetchUsers()
      setSelectedUser((prev: any) => (prev ? { ...prev, status: nextStatus } : prev))
      setShowDeleteModal(false)
      const msg = nextStatus === 'inactive'
        ? 'User suspended successfully.'
        : 'User re-activated successfully.'
      alert(msg)
    } catch (error: any) {
      console.error('Error updating user status:', error)
      alert(error.message || 'Failed to update user status')
    } finally {
      setDeletingUser(false)
    }
  }

  const handleConvertBonusWins = async () => {
    if (!selectedUser) return
    if (!admin) {
      alert('Admin session missing. Please log in again.')
      return
    }

    const bonusWins = Number(selectedUser.bonus_win_balance || 0)
    if (!bonusWins || bonusWins <= 0) {
      alert('This user has no Bonus Wins to convert.')
      return
    }

    const confirmMsg = `Convert ${formatCurrency(bonusWins)} Bonus Wins to Cash for ${selectedUser.username || 'this user'}?` 
      + '\n\nThis will move funds from Bonus Wins to the Cash Wallet and will be logged.'
    if (!window.confirm(confirmMsg)) return

    try {
      setWalletActionLoading(true)
      const res = await fetch('/api/admin/wallet/convert-bonus-wins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': admin.id
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: bonusWins,
          reason: 'manual_admin_conversion'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to convert Bonus Wins')
      }

      if (data.user) {
        setSelectedUser((prev: any) => (prev && prev.id === data.user.id ? { ...prev, ...data.user } : prev))
        setUsers(prev => prev.map(u => (u.id === data.user.id ? { ...u, ...data.user } : u)))
      }

      alert(`Converted ${formatCurrency(data.convertedAmount || bonusWins)} Bonus Wins to Cash Wallet.`)
    } catch (error: any) {
      console.error('Error converting Bonus Wins:', error)
      alert(error.message || 'Failed to convert Bonus Wins')
    } finally {
      setWalletActionLoading(false)
    }
  }

  const fetchUserGames = async (user: any) => {
    setLoadingGames(true)
    try {
      if (!user) throw new Error('Missing user for game history')

      const userId = String(user.id)
      const tgIdStr = user.telegram_id ? String(user.telegram_id) : null
      const tgIdNum = user.telegram_id ? Number(user.telegram_id) : null
      const uname = user.username ? String(user.username) : null

      // 1) Find game IDs from this user's stake/win transactions
      const { data: txRows, error: txError } = await supabase
        .from('transactions')
        .select('game_id, type')
        .eq('user_id', userId)
        .in('type', ['stake', 'win'])
        .not('game_id', 'is', null)
        .limit(200)

      if (txError) throw txError

      const gameIds = Array.from(
        new Set(
          (txRows || [])
            .map((r: any) => r.game_id)
            .filter((id: any) => !!id)
        )
      ) as string[]

      // 2) Fetch finished games for those IDs (or fallback by players contains)
      let gamesQuery = supabase
        .from('games')
        .select(`
          *,
          rooms (
            name,
            color,
            stake,
            game_level
          )
        `)
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(200)

      if (gameIds.length > 0) {
        gamesQuery = gamesQuery.in('id', gameIds)
      }

      const { data: gamesData, error: gamesError } = await gamesQuery
      if (gamesError) throw gamesError

      const games = (gamesData || []) as any[]

      // 3) Final filter: match against players array (id, telegram, username)
      const playerGames = games.filter((g: any) => {
        const players: any[] = Array.isArray(g.players) ? g.players : []
        if (players.length === 0) return false
        return (
          players.includes(userId) ||
          (tgIdStr && players.includes(tgIdStr)) ||
          (tgIdNum !== null && players.includes(tgIdNum)) ||
          (uname && players.includes(uname))
        )
      })

      setUserGames(playerGames)
    } catch (error) {
      console.error('Error fetching user games:', error)
      console.error('Error details:', error)
      alert('Failed to load game history')
    } finally {
      setLoadingGames(false)
    }
  }

  // Fetch recent transactions for a user
  const fetchUserTransactions = async (userId: string) => {
    setLoadingTransactions(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setUserTransactions(data || [])
    } catch (error) {
      console.error('Error fetching user transactions:', error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  // Open history modal and load data in parallel
  const openUserHistory = (user: any) => {
    setSelectedUser(user)
    setShowGameHistory(true)
    setUserGames([])
    setUserTransactions([])
    fetchUserGames(user)
    fetchUserTransactions(user.id)
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.status !== 'inactive').length,
    totalBalance: users.reduce((sum, u) => sum + (u.balance || 0), 0),
    totalBonusBalance: users.reduce((sum, u) => sum + (u.bonus_balance || 0), 0),
    totalGames: users.reduce((sum, u) => sum + (u.games_played || 0), 0),
    totalWins: users.reduce((sum, u) => sum + (u.games_won || 0), 0),
    withPhone: users.filter(u => u.phone).length,
    totalReferrals: users.reduce((sum, u) => sum + (u.total_referrals || 0), 0),
    totalReferralEarnings: users.reduce((sum, u) => sum + Number(u.referral_earnings || 0), 0),
  }

  // City aggregation (prefer last_seen_city then registration_city)
  const cityCountsMap = new Map<string, number>()
  for (const u of users) {
    const city = (u.last_seen_city || u.registration_city || 'Unknown') as string
    cityCountsMap.set(city, (cityCountsMap.get(city) || 0) + 1)
  }
  const cityCounts = Array.from(cityCountsMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
  const topCities = cityCounts.slice(0, 10)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" /></svg>
    return sortOrder === 'asc' 
      ? <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" /></svg>
      : <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8v12m0 0l-4-4m4 4l4-4" /></svg>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Premium Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 shadow-2xl sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-white">User Management</h1>
                  <p className="text-slate-400 text-xs sm:text-sm">Professional user analytics & control</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/mgmt-portal-x7k9p2/games" className="flex items-center gap-2 bg-emerald-600/20 text-emerald-400 px-3 py-2 rounded-lg hover:bg-emerald-600/30 transition-colors text-sm font-medium border border-emerald-500/30">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline">Live Games</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700/50 p-3 sm:p-4 hover:border-slate-600/50 transition-all">
            <div className="text-xs text-slate-400 mb-1">Total Users</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 rounded-lg border border-emerald-700/30 p-3 sm:p-4 hover:border-emerald-600/50 transition-all">
            <div className="text-xs text-emerald-400 mb-1">Active</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">{stats.active}</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-900/30 to-slate-900 rounded-lg border border-cyan-700/30 p-3 sm:p-4 hover:border-cyan-600/50 transition-all">
            <div className="text-xs text-cyan-400 mb-1">With Phone</div>
            <div className="text-xl sm:text-2xl font-bold text-cyan-400">{stats.withPhone}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 rounded-lg border border-purple-700/30 p-3 sm:p-4 hover:border-purple-600/50 transition-all">
            <div className="text-xs text-purple-400 mb-1">Total Wallet</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-400">{formatCurrency(stats.totalBalance)}</div>
            <div className="text-xs text-purple-300 mt-1">Bonus: {formatCurrency(stats.totalBonusBalance)}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-lg border border-orange-700/30 p-3 sm:p-4 hover:border-orange-600/50 transition-all">
            <div className="text-xs text-orange-400 mb-1">Games Played</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-400">{stats.totalGames}</div>
          </div>
          <div className="bg-gradient-to-br from-pink-900/30 to-slate-900 rounded-lg border border-pink-700/30 p-3 sm:p-4 hover:border-pink-600/50 transition-all">
            <div className="text-xs text-pink-400 mb-1">Total Wins</div>
            <div className="text-xl sm:text-2xl font-bold text-pink-400">{stats.totalWins}</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900 rounded-lg border border-indigo-700/30 p-3 sm:p-4 hover:border-indigo-600/50 transition-all">
            <div className="text-xs text-indigo-300 mb-1">Referrals</div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-200">{stats.totalReferrals}</div>
            <div className="text-xs text-indigo-400 mt-1">{formatCurrency(stats.totalReferralEarnings)} earned</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 sm:p-6 mb-6 shadow-lg">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Search Users</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by username, Telegram ID, or phone..."
                className="w-full px-4 py-3 bg-slate-700/50 border-2 border-slate-600/50 rounded-lg focus:border-cyan-400 focus:outline-none text-white placeholder-slate-500 transition-colors"
              />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:border-cyan-400 focus:outline-none text-white text-sm transition-colors"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Sort By</label>
                <select
                  value={sortField}
                  onChange={(e) => {
                    setSortField(e.target.value as SortField)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:border-cyan-400 focus:outline-none text-white text-sm transition-colors"
                >
                  <option value="created_at">Joined Date</option>
                  <option value="username">Username</option>
                  <option value="balance">Balance</option>
                  <option value="games_played">Games Played</option>
                  <option value="games_won">Games Won</option>
                  <option value="total_referrals">Referrals</option>
                  <option value="referral_earnings">Referral Earnings</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Order</label>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg hover:bg-slate-600/50 text-white text-sm font-medium transition-colors"
                >
                  {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Per Page</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:border-cyan-400 focus:outline-none text-white text-sm transition-colors"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-slate-400">
              Showing <span className="font-semibold text-cyan-400">{paginatedUsers.length}</span> of <span className="font-semibold text-cyan-400">{filteredUsers.length}</span> users
            </div>
          </div>
        </div>

        {/* City Summary */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 sm:p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-white">Users by City</h3>
            <span className="text-xs text-slate-400">Top {Math.min(10, topCities.length)}</span>
          </div>
          {topCities.length === 0 ? (
            <div className="text-slate-400 text-sm">No location data yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topCities.map(({ city, count }) => (
                <div key={city} className="flex items-center justify-between bg-slate-900/40 border border-slate-700/50 rounded-lg px-3 py-2">
                  <span className="text-slate-200 text-sm truncate">{city}</span>
                  <span className="text-cyan-400 text-sm font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Users Table - Hidden on Mobile */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl overflow-hidden">
          <table className="w-full">
              <thead className="bg-slate-900/80 border-b border-slate-700/50 sticky top-0">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">User</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">Telegram</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">Phone</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 cursor-pointer hover:text-cyan-400 whitespace-nowrap" onClick={() => handleSort('balance')}>
                    <div className="flex items-center gap-0.5">Wallet <SortIcon field="balance" /></div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 cursor-pointer hover:text-cyan-400 whitespace-nowrap" onClick={() => handleSort('games_played')}>
                    <div className="flex items-center gap-0.5">Games <SortIcon field="games_played" /></div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 cursor-pointer hover:text-cyan-400 whitespace-nowrap" onClick={() => handleSort('games_won')}>
                    <div className="flex items-center gap-0.5">Wins <SortIcon field="games_won" /></div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">Lost</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 cursor-pointer hover:text-cyan-400 whitespace-nowrap" onClick={() => handleSort('total_referrals')}>
                    <div className="flex items-center gap-0.5">Refs <SortIcon field="total_referrals" /></div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">City</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">Country</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 cursor-pointer hover:text-cyan-400 whitespace-nowrap" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-0.5">Joined <SortIcon field="created_at" /></div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-slate-300 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        Loading users...
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                            {user.username?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-white">{user.username || 'Unknown'}</div>
                              {user.status === 'inactive' && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">ID: {user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-slate-300 font-mono text-xs">{user.telegram_id}</td>
                      <td className="px-2 py-3 text-slate-300">
                        {user.phone ? (
                          <a href={`tel:${user.phone}`} className="text-cyan-400 hover:text-cyan-300 underline font-mono text-sm">
                            {user.phone}
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-xs text-slate-400 mb-0.5">Real / Bonus</div>
                        <div className="font-semibold text-emerald-400 text-xs">
                          {formatCurrency(user.balance || 0)}
                          <span className="text-slate-400"> / </span>
                          <span className="text-emerald-300">{formatCurrency(user.bonus_balance || 0)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-slate-300 font-medium text-xs">{user.games_played || 0}</td>
                      <td className="px-2 py-3 text-slate-300 font-medium text-xs">{user.games_won || 0}</td>
                      <td className="px-2 py-3 text-red-400 font-medium text-xs">{(user.games_played || 0) - (user.games_won || 0)}</td>
                      <td className="px-2 py-3 text-slate-300 text-xs">
                        <div className="font-medium text-indigo-300 text-xs">{user.total_referrals || 0}</div>
                        <div className="text-xs text-indigo-400">{formatCurrency(Number(user.referral_earnings || 0))}</div>
                      </td>
                      <td className="px-2 py-3 text-slate-300 text-xs">{user.last_seen_city || user.registration_city || '—'}</td>
                      <td className="px-2 py-3 text-slate-300 text-xs">{user.last_seen_country || user.registration_country || '—'}</td>
                      <td className="px-2 py-3 text-xs text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => setActionMenuUserId(actionMenuUserId === user.id ? null : user.id)}
                            className="p-1.5 rounded-full hover:bg-slate-700/70 text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                          >
                            <span className="sr-only">Open user actions</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                            </svg>
                          </button>
                          {actionMenuUserId === user.id && (
                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-lg shadow-2xl bg-slate-900/95 border border-slate-700/80 z-20">
                              <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                User actions
                              </div>
                              <div className="py-1 text-xs text-slate-200 border-t border-slate-700/80">
                                <button
                                  onClick={() => {
                                    setSelectedUser(user)
                                    setShowUserModal(true)
                                    setActionMenuUserId(null)
                                  }}
                                  className="block w-full text-left px-3 py-1.5 hover:bg-slate-800/90 transition-colors"
                                >
                                  View profile
                                </button>
                                <button
                                  onClick={() => {
                                    openUserHistory(user)
                                    setActionMenuUserId(null)
                                  }}
                                  className="block w-full text-left px-3 py-1.5 hover:bg-slate-800/80"
                                >
                                  History
                                </button>
                                {user.phone && (
                                  <button
                                    onClick={() => {
                                      window.location.href = `tel:${user.phone}`
                                      setActionMenuUserId(null)
                                    }}
                                    className="block w-full text-left px-3 py-1.5 hover:bg-slate-800/90 transition-colors"
                                  >
                                    Call
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    const tgLink = `tg://user?id=${user.telegram_id}`
                                    const httpLink = `https://t.me/${user.telegram_id}`
                                    const w = window.open(tgLink, '_blank')
                                    setTimeout(() => {
                                      if (!w || w.closed) window.open(httpLink, '_blank')
                                    }, 300)
                                    setActionMenuUserId(null)
                                  }}
                                  className="block w-full text-left px-3 py-1.5 hover:bg-slate-800/80"
                                >
                                  Open Telegram
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedUser(user)
                                    setSuspendReason('Manual suspension from admin Users page')
                                    setShowDeleteModal(true)
                                    setActionMenuUserId(null)
                                  }}
                                  className="block w-full text-left px-3 py-1.5 text-red-300 hover:bg-red-500/15 border-t border-slate-800/80 mt-1"
                                >
                                  {user.status === 'inactive' ? 'Reactivate user' : 'Suspend user'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Page <span className="font-semibold text-cyan-400">{currentPage}</span> of <span className="font-semibold text-cyan-400">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-600/50"
                >
                  ← Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1
                    if (totalPages > 5) {
                      if (currentPage <= 3) pageNum = i + 1
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                      else pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-600/50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
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
                    <div className="text-slate-400 mb-1 text-xs">Telegram ID</div>
                    <div className="text-white font-medium font-mono text-xs">{user.telegram_id}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 mb-1 text-xs">Phone</div>
                    <div className="text-cyan-400 font-medium font-mono text-xs">{user.phone || '—'}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 mb-1 text-xs">Balance</div>
                    <div className="text-emerald-400 font-semibold">{formatCurrency(user.balance || 0)}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 mb-1 text-xs">Games</div>
                    <div className="text-white font-medium">{user.games_played || 0} / {user.games_won || 0}</div>
                  </div>
                  <div className="col-span-2 bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 mb-1 text-xs">Joined</div>
                    <div className="text-white font-medium">{new Date(user.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Mobile Action Buttons */}
                <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-700/30">
                  <button
                    onClick={() => openUserHistory(user)}
                    className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-purple-500/30"
                  >
                    History
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowUserModal(true)
                    }}
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
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setSuspendReason('Manual suspension from admin Users page')
                      setShowDeleteModal(true)
                    }}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-red-500/30"
                  >
                    {user.status === 'inactive' ? 'Reactivate' : 'Suspend'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User Details Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 max-w-2xl w-full shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 px-6 py-5 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {selectedUser.username?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedUser.username || 'Unknown'}</h3>
                    <p className="text-slate-400 text-sm">ID: {selectedUser.id.slice(0, 12)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto space-y-6">

                {/* Key Stats */}
                {(() => {
                  let gamesPlayed = selectedUser.games_played || 0
                  let gamesWon = selectedUser.games_won || 0
                  let totalWinnings = selectedUser.total_winnings || 0
                  
                  if (userGames.length > 0) {
                    const playerGames = userGames.filter(g => g.players?.includes(selectedUser.id))
                    gamesPlayed = playerGames.length
                    gamesWon = playerGames.filter(g => g.winner_id === selectedUser.id).length
                    totalWinnings = playerGames
                      .filter(g => g.winner_id === selectedUser.id)
                      .reduce((sum, g) => sum + (g.net_prize || 0), 0)
                  }
                  
                  const gamesLost = gamesPlayed - gamesWon
                  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                        <div className="text-slate-400 text-xs font-medium mb-1">Balance</div>
                        <div className="text-emerald-400 font-bold text-lg">{formatCurrency(selectedUser.balance || 0)}</div>
                      </div>
                      <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                        <div className="text-slate-400 text-xs font-medium mb-1">Games</div>
                        <div className="text-white font-bold text-lg">{gamesPlayed}</div>
                      </div>
                      <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
                        <div className="text-emerald-400 text-xs font-medium mb-1">Won</div>
                        <div className="text-emerald-400 font-bold text-lg">{gamesWon}</div>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 hover:border-red-500/50 transition-colors">
                        <div className="text-red-400 text-xs font-medium mb-1">Lost</div>
                        <div className="text-red-400 font-bold text-lg">{gamesLost}</div>
                      </div>
                      <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/30 hover:border-cyan-500/50 transition-colors">
                        <div className="text-cyan-400 text-xs font-medium mb-1">Win Rate</div>
                        <div className="text-cyan-400 font-bold text-lg">{winRate}%</div>
                      </div>
                      <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                        <div className="text-slate-400 text-xs font-medium mb-1">Total Won</div>
                        <div className="text-emerald-300 font-bold text-lg">{formatCurrency(totalWinnings)}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Contact Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-700/20 rounded-lg p-3 border border-slate-700/50">
                      <div className="text-slate-400 text-xs font-medium mb-1">Telegram ID</div>
                      <div className="text-white font-mono text-sm">{selectedUser.telegram_id}</div>
                    </div>
                    {selectedUser.phone && (
                      <div className="bg-slate-700/20 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-slate-400 text-xs font-medium mb-2">Phone</div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-cyan-400 font-mono text-sm">{selectedUser.phone}</div>
                          <div className="flex gap-1.5">
                            <a href={`tel:${selectedUser.phone}`} className="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-2 py-1 rounded transition-colors border border-emerald-500/30 font-medium">Call</a>
                            <button
                              onClick={() => navigator.clipboard.writeText(String(selectedUser.phone))}
                              className="text-xs bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 px-2 py-1 rounded transition-colors border border-slate-600/50 font-medium"
                            >Copy</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Wallet Management */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300">Wallet</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                      <div className="text-emerald-400 text-xs font-medium mb-1">Cash</div>
                      <div className="text-emerald-400 font-bold text-lg">{formatCurrency(selectedUser.balance || 0)}</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                      <div className="text-emerald-400 text-xs font-medium mb-1">Bonus</div>
                      <div className="text-emerald-300 font-bold text-lg">{formatCurrency(selectedUser.bonus_balance || 0)}</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                      <div className="text-emerald-400 text-xs font-medium mb-1">Bonus Wins</div>
                      <div className="text-emerald-200 font-bold text-lg">{formatCurrency(selectedUser.bonus_win_balance || 0)}</div>
                    </div>
                  </div>
                  {Number(selectedUser.bonus_win_balance || 0) > 0 && (
                    <button
                      onClick={handleConvertBonusWins}
                      disabled={walletActionLoading || !admin}
                      className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-400 px-4 py-2 rounded-lg font-semibold transition-colors border border-emerald-500/30 text-sm flex items-center justify-center gap-2"
                    >
                      {walletActionLoading ? 'Converting…' : 'Convert All Bonus Wins to Cash'}
                    </button>
                  )}
                </div>

                {/* Wagering & Withdrawal */}
                {((selectedUser.locked_balance || 0) > 0 || (selectedUser.pending_withdrawal_hold || 0) > 0 || (selectedUser.wager_required || 0) > 0) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-300">Wagering & Withdrawal</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30">
                        <div className="text-orange-400 text-xs font-medium mb-1">Locked Balance</div>
                        <div className="text-orange-400 font-bold text-lg">{formatCurrency(selectedUser.locked_balance || 0)}</div>
                      </div>
                      <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30">
                        <div className="text-yellow-400 text-xs font-medium mb-1">Pending Hold</div>
                        <div className="text-yellow-400 font-bold text-lg">{formatCurrency(selectedUser.pending_withdrawal_hold || 0)}</div>
                      </div>
                    </div>
                    {(selectedUser.wager_required || 0) > 0 && (
                      <div className="bg-slate-700/20 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-slate-400 text-xs font-medium mb-2">Wagering Progress</div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-900/50 rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                              style={{width: `${Math.min(100, ((selectedUser.wager_progress || 0) / (selectedUser.wager_required || 1)) * 100)}%`}}
                            ></div>
                          </div>
                          <div className="text-xs text-slate-300 whitespace-nowrap font-medium">
                            {Math.round(((selectedUser.wager_progress || 0) / (selectedUser.wager_required || 1)) * 100)}%
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-2">
                          {formatCurrency(selectedUser.wager_progress || 0)} / {formatCurrency(selectedUser.wager_required || 0)}
                        </div>
                      </div>
                    )}
                    {selectedUser.last_withdrawal_at && (
                      <div className="bg-slate-700/20 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-slate-400 text-xs font-medium mb-1">Last Withdrawal</div>
                        <div className="text-white text-sm font-medium">{new Date(selectedUser.last_withdrawal_at).toLocaleDateString()}</div>
                        <div className="text-slate-400 text-xs mt-1">Daily: {formatCurrency(selectedUser.daily_withdrawn_amount || 0)} / 500 ETB</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Member Since */}
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                  Member since {new Date(selectedUser.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-4 flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (userGames.length === 0) {
                      fetchUserGames(selectedUser.id)
                    } else {
                      setShowGameHistory(true)
                    }
                  }}
                  disabled={loadingGames}
                  className="w-full bg-purple-600/20 hover:bg-purple-600/40 disabled:opacity-50 text-purple-400 px-4 py-2.5 rounded-lg font-semibold transition-colors border border-purple-500/30 flex items-center justify-center gap-2 text-sm"
                >
                  {loadingGames ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      📊 Game History ({userGames.length > 0 ? userGames.length : selectedUser.games_played || 0})
                    </>
                  )}
                </button>
                <div className="grid grid-cols-3 gap-2">
                  {selectedUser.phone && (
                    <a
                      href={`tel:${selectedUser.phone}`}
                      className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-4 py-2 rounded-lg font-semibold transition-colors text-center border border-emerald-500/30 text-sm"
                    >
                      📞 Call
                    </a>
                  )}
                  <button
                    onClick={() => {
                      const tgLink = `tg://user?id=${selectedUser.telegram_id}`
                      const httpLink = `https://t.me/${selectedUser.telegram_id}`
                      const w = window.open(tgLink, '_blank')
                      setTimeout(() => {
                        if (!w || w.closed) window.open(httpLink, '_blank')
                      }, 300)
                    }}
                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg font-semibold transition-colors border border-blue-500/30 text-sm"
                  >
                    💬 Telegram
                  </button>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600/50 text-sm"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suspend / Reactivate Confirmation Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-white">{selectedUser.status === 'inactive' ? 'Reactivate User' : 'Suspend User'}</h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-4 p-4 bg-red-500/10 rounded-lg border border-red-500/20 mb-4">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-400 text-lg">{selectedUser.status === 'inactive' ? 'Reactivate this user' : 'Suspend this user'}</h4>
                    <p className="text-red-300 text-sm">{selectedUser.status === 'inactive' ? 'User will be able to log in and play again.' : 'User will be blocked from playing and deposits until reactivated.'}</p>
                  </div>
                </div>

                <p className="text-slate-300 mb-4">
                  Are you sure you want to {selectedUser.status === 'inactive' ? 'reactivate' : 'suspend'} <strong className="text-white">{selectedUser.username || 'this user'}</strong>?
                </p>
                
                <div className="bg-slate-700/30 rounded-lg p-3 text-sm text-slate-300 border border-slate-700/50">
                  <p className="mb-2 font-semibold">Status effect:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                    <li>{selectedUser.status === 'inactive' ? 'Mark user as active again.' : 'Mark user as inactive/suspended.'}</li>
                    <li>No data is deleted, balances and history remain intact.</li>
                  </ul>
                </div>

                {selectedUser.status !== 'inactive' && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-300">Reason for suspension</label>
                      <span className="text-[10px] text-slate-400">Visible to admins & user</span>
                    </div>
                    <textarea
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="e.g. Repeated fake deposit proofs"
                      className="w-full bg-slate-900/60 border border-slate-600/60 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40 resize-none min-h-[64px]"
                    />
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {[
                        'Repeated fake / mismatched deposit proofs',
                        'Suspicious deposit & withdrawal pattern',
                        'Abuse of referral system / multiple accounts',
                        'Chargeback or payment dispute risk',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSuspendReason(preset)}
                          className="px-2.5 py-1 rounded-full bg-slate-700/70 hover:bg-slate-600/80 text-slate-200 border border-slate-500/60"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600/50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleToggleSuspend}
                  disabled={deletingUser}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/40 disabled:bg-red-800/20 disabled:cursor-not-allowed text-red-400 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 border border-red-500/30"
                >
                  {deletingUser ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    selectedUser.status === 'inactive' ? 'Reactivate User' : 'Suspend User'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game History Modal */}
        {showGameHistory && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 px-6 py-5 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white">Game History</h3>
                  <p className="text-slate-400 text-sm">{selectedUser.username} • ID: {selectedUser.id.slice(0, 12)}</p>
                </div>
                <button
                  onClick={() => { setShowGameHistory(false); setUserGames([]); setUserTransactions([]); }}
                  className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">

              {loadingGames ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : userGames.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No games found for this user
                </div>
              ) : (
                <>
                {/* Summary Stats */}
                {(() => {
                  const playerGames = userGames.filter(g => g.players?.includes(selectedUser.id))
                  const wonGames = playerGames.filter(g => g.winner_id === selectedUser.id).length
                  const lostGames = playerGames.filter(g => g.winner_id !== selectedUser.id).length
                  const totalWinnings = playerGames
                    .filter(g => g.winner_id === selectedUser.id)
                    .reduce((sum, g) => sum + (g.net_prize || 0), 0)
                  const totalStakesLost = playerGames
                    .filter(g => g.winner_id !== selectedUser.id)
                    .reduce((sum, g) => sum + (g.stake || 0), 0)
                  const netProfit = selectedUser.balance || 0
                  const winRate = playerGames.length > 0 ? Math.round((wonGames / playerGames.length) * 100) : 0
                  
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 p-4 bg-gradient-to-r from-slate-700/40 to-slate-700/20 rounded-lg border border-slate-700/50">
                      <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-slate-700/50">
                        <div className="text-slate-400 text-xs font-medium mb-1">Total</div>
                        <div className="text-white font-bold text-lg">{playerGames.length}</div>
                      </div>
                      <div className="bg-emerald-500/10 rounded-lg p-3 text-center border border-emerald-500/30">
                        <div className="text-emerald-400 text-xs font-medium mb-1">Won</div>
                        <div className="text-emerald-400 font-bold text-lg">{wonGames}</div>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/30">
                        <div className="text-red-400 text-xs font-medium mb-1">Lost</div>
                        <div className="text-red-400 font-bold text-lg">{lostGames}</div>
                      </div>
                      <div className="bg-cyan-500/10 rounded-lg p-3 text-center border border-cyan-500/30">
                        <div className="text-cyan-400 text-xs font-medium mb-1">Won $</div>
                        <div className="text-cyan-400 font-bold text-sm">{formatCurrency(totalWinnings)}</div>
                      </div>
                      <div className="bg-red-500/10 rounded-lg p-3 text-center border border-red-500/30">
                        <div className="text-red-400 text-xs font-medium mb-1">Lost $</div>
                        <div className="text-red-400 font-bold text-sm">{formatCurrency(totalStakesLost)}</div>
                      </div>
                      <div className={`rounded-lg p-3 text-center border ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className={`text-xs font-medium mb-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Net P/L
                        </div>
                        <div className={`font-bold text-sm ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                        </div>
                      </div>
                      <div className="bg-orange-500/10 rounded-lg p-3 text-center border border-orange-500/30">
                        <div className="text-orange-400 text-xs font-medium mb-1">Win %</div>
                        <div className="text-orange-400 font-bold text-lg">{winRate}%</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Games List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300">Recent Games</h4>
                  <div className="space-y-2">
                    {userGames.map((game) => {
                      const isWinner = game.winner_id === selectedUser.id
                      const isPlayer = game.players?.includes(selectedUser.id)
                      const playerCount = (game.players?.length || 0) + (game.bots?.length || 0)
                      
                      return (
                        <div key={game.id} className={`rounded-lg p-3 border transition-colors ${
                          isWinner ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50' :
                          isPlayer ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50' :
                          'bg-slate-700/30 border-slate-700/50 hover:border-slate-600/50'
                        }`}>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                            {/* Result */}
                            <div>
                              <div className="text-slate-400 font-medium mb-0.5">Result</div>
                              <div className={`font-bold ${
                                isWinner ? 'text-emerald-400' : isPlayer ? 'text-red-400' : 'text-slate-300'
                              }`}>
                                {isWinner ? '✓ WIN' : isPlayer ? '✗ LOSS' : '○ SPEC'}
                              </div>
                            </div>

                            {/* Stake */}
                            <div>
                              <div className="text-slate-400 font-medium mb-0.5">Stake</div>
                              <div className="text-white font-semibold">{formatCurrency(game.stake || 0)}</div>
                            </div>

                            {/* Prize Pool */}
                            <div>
                              <div className="text-slate-400 font-medium mb-0.5">Pool</div>
                              <div className="text-cyan-400 font-semibold">{formatCurrency(game.prize_pool || 0)}</div>
                            </div>

                            {/* Winnings (if winner) */}
                            {isWinner && game.net_prize && (
                              <div>
                                <div className="text-emerald-400 font-medium mb-0.5">Won</div>
                                <div className="text-emerald-400 font-bold">{formatCurrency(game.net_prize)}</div>
                              </div>
                            )}

                            {/* Players */}
                            <div>
                              <div className="text-slate-400 font-medium mb-0.5">Players</div>
                              <div className="text-white font-semibold">{playerCount}</div>
                            </div>

                            {/* Date */}
                            <div>
                              <div className="text-slate-400 font-medium mb-0.5">Date</div>
                              <div className="text-white font-medium">{new Date(game.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Transactions List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300">Recent Transactions</h4>
                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-6 text-slate-400">
                      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                      Loading...
                    </div>
                  ) : userTransactions.length === 0 ? (
                    <div className="text-slate-400 text-sm py-4 text-center">No transactions found</div>
                  ) : (
                    <div className="space-y-1.5">
                      {userTransactions.slice(0, 30).map((tx: any) => {
                        const typeConfig = {
                          'win': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '✓' },
                          'stake': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '✗' },
                          'deposit': { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: '↓' },
                          'withdrawal': { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '↑' },
                        }
                        const config = typeConfig[tx.type as keyof typeof typeConfig] || typeConfig['stake']
                        return (
                          <div key={tx.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${config.border} ${config.bg} hover:border-opacity-50 transition-colors`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`font-bold whitespace-nowrap ${config.color}`}>{config.icon} {tx.type.toUpperCase()}</span>
                              {tx.status && (
                                <span className={`px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${
                                  tx.status === 'pending' 
                                    ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' 
                                    : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                }`}>
                                  {tx.status}
                                </span>
                              )}
                            </div>
                            <div className="text-white font-semibold text-right ml-2">{formatCurrency(Math.abs(Number(tx.amount) || 0))}</div>
                            <div className="text-slate-400 whitespace-nowrap ml-2">{new Date(tx.created_at).toLocaleDateString()}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
              </div>

              {/* Footer */}
              <div className="bg-slate-900/50 border-t border-slate-700/50 px-6 py-4">
                <button
                  onClick={() => { setShowGameHistory(false); setUserGames([]); setUserTransactions([]); }}
                  className="w-full bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2.5 rounded-lg font-semibold transition-colors border border-slate-600/50 text-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )}
