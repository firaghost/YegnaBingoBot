"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type SortField = 'username' | 'balance' | 'games_played' | 'games_won' | 'created_at'
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
      const saved = localStorage.getItem('userMgmt_pageSize')
      return saved ? parseInt(saved) : 50
    }
    return 50
  })
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userMgmt_currentPage')
      return saved ? parseInt(saved) : 1
    }
    return 1
  })
  const [userGames, setUserGames] = useState<any[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [showGameHistory, setShowGameHistory] = useState(false)
  const [userTransactions, setUserTransactions] = useState<any[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userMgmt_searchTerm') || ''
    }
    return ''
  })
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userMgmt_sortField')
      return (saved as SortField) || 'created_at'
    }
    return 'created_at'
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userMgmt_sortOrder')
      return (saved as SortOrder) || 'desc'
    }
    return 'desc'
  })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userMgmt_statusFilter')
      return (saved as StatusFilter) || 'all'
    }
    return 'all'
  })

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userMgmt_pageSize', pageSize.toString())
      localStorage.setItem('userMgmt_currentPage', currentPage.toString())
      localStorage.setItem('userMgmt_searchTerm', searchTerm)
      localStorage.setItem('userMgmt_sortField', sortField)
      localStorage.setItem('userMgmt_sortOrder', sortOrder)
      localStorage.setItem('userMgmt_statusFilter', statusFilter)
    }
  }, [pageSize, currentPage, searchTerm, sortField, sortOrder, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [])

  // Auto-fetch games when user modal opens
  useEffect(() => {
    if (showUserModal && selectedUser && userGames.length === 0) {
      fetchUserGames(selectedUser.id)
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

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setDeletingUser(true)
    try {
      // First, update any games where this user is the winner to set winner_id to null
      const { error: gamesError } = await supabase
        .from('games')
        .update({ winner_id: null })
        .eq('winner_id', selectedUser.id)

      if (gamesError) throw gamesError

      // Delete user's transactions
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', selectedUser.id)

      if (transactionsError) throw transactionsError

      // Finally, delete the user
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id)

      if (userError) throw userError

      // Refresh the users list
      fetchUsers()
      setShowDeleteModal(false)
      setShowUserModal(false)
      setSelectedUser(null)
      alert('User deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert(error.message || 'Failed to delete user')
    } finally {
      setDeletingUser(false)
    }
  }

  const fetchUserGames = async (userId: string) => {
    setLoadingGames(true)
    try {
      // Fetch ALL finished games first (no filter)
      const { data: allGames, error } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      
      // Client-side filter: ONLY games where user is in the players array
      // This is the source of truth - if they're in players array, they played
      const playerGames = (allGames || []).filter((g: any) => {
        const isPlayer = g.players && Array.isArray(g.players) && g.players.includes(userId)
        return isPlayer
      })
      
      console.log(`Total finished games in DB: ${allGames?.length || 0}`)
      console.log(`Games where user ${userId} is a player: ${playerGames.length}`)
      console.log(`User games:`, playerGames.map((g: any) => ({
        id: g.id.slice(0, 8),
        players: g.players?.length || 0,
        winner: g.winner_id === userId ? 'YES' : 'NO',
        stake: g.stake,
        net_prize: g.net_prize
      })))
      
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
    fetchUserGames(user.id)
    fetchUserTransactions(user.id)
  }

  const stats = {
    total: users.length,
    active: users.length, // All users are active (no approval system)
    totalBalance: users.reduce((sum, u) => sum + (u.balance || 0), 0),
    totalGames: users.reduce((sum, u) => sum + (u.games_played || 0), 0),
    totalWins: users.reduce((sum, u) => sum + (u.games_won || 0), 0),
    withPhone: users.filter(u => u.phone).length,
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
            <div className="text-xs text-purple-400 mb-1">Total Balance</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-400">{formatCurrency(stats.totalBalance)}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-lg border border-orange-700/30 p-3 sm:p-4 hover:border-orange-600/50 transition-all">
            <div className="text-xs text-orange-400 mb-1">Games Played</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-400">{stats.totalGames}</div>
          </div>
          <div className="bg-gradient-to-br from-pink-900/30 to-slate-900 rounded-lg border border-pink-700/30 p-3 sm:p-4 hover:border-pink-600/50 transition-all">
            <div className="text-xs text-pink-400 mb-1">Total Wins</div>
            <div className="text-xl sm:text-2xl font-bold text-pink-400">{stats.totalWins}</div>
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
        <div className="hidden lg:block bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/80 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Telegram ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('balance')}>
                    <div className="flex items-center gap-2">Balance <SortIcon field="balance" /></div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('games_played')}>
                    <div className="flex items-center gap-2">Games <SortIcon field="games_played" /></div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('games_won')}>
                    <div className="flex items-center gap-2">Wins <SortIcon field="games_won" /></div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    <div className="flex items-center gap-2">Lost</div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">City</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Country</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 cursor-pointer hover:text-cyan-400" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-2">Joined <SortIcon field="created_at" /></div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        Loading users...
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                            {user.username?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{user.username || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">ID: {user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono text-sm">{user.telegram_id}</td>
                      <td className="px-6 py-4 text-slate-300">
                        {user.phone ? (
                          <a href={`tel:${user.phone}`} className="text-cyan-400 hover:text-cyan-300 underline font-mono text-sm">
                            {user.phone}
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-emerald-400">
                          {formatCurrency(user.balance || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-medium">{user.games_played || 0}</td>
                      <td className="px-6 py-4 text-slate-300 font-medium">{user.games_won || 0}</td>
                      <td className="px-6 py-4 text-red-400 font-medium">{(user.games_played || 0) - (user.games_won || 0)}</td>
                      <td className="px-6 py-4 text-slate-300">{user.last_seen_city || user.registration_city || '—'}</td>
                      <td className="px-6 py-4 text-slate-300">{user.last_seen_country || user.registration_country || '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowUserModal(true)
                            }}
                            className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 px-2 py-1 rounded text-xs font-medium transition-colors border border-cyan-500/30"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              openUserHistory(user)
                            }}
                            className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-2 py-1 rounded text-xs font-medium transition-colors border border-purple-500/30"
                          >
                            History
                          </button>
                          {user.phone && (
                            <a
                              href={`tel:${user.phone}`}
                              className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-2 py-1 rounded text-xs font-medium transition-colors border border-emerald-500/30"
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
                            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-1 rounded text-xs font-medium transition-colors border border-blue-500/30"
                          >
                            TG
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDeleteModal(true)
                            }}
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-2 py-1 rounded text-xs font-medium transition-colors border border-red-500/30"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
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
                    <div className="font-semibold text-white text-lg">{user.username || 'Unknown'}</div>
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
                      setShowDeleteModal(true)
                    }}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User Details Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {selectedUser.username?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedUser.username || 'Unknown'}</h3>
                    <p className="text-slate-400 text-xs">ID: {selectedUser.id.slice(0, 8)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {/* Key Stats - Compact Grid */}
                {(() => {
                  // Calculate stats from user games if available, otherwise use user data
                  let gamesPlayed = selectedUser.games_played || 0
                  let gamesWon = selectedUser.games_won || 0
                  let totalWinnings = selectedUser.total_winnings || 0
                  
                  // If we have loaded games, recalculate from actual game data
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
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                          <div className="text-slate-400 text-xs">Balance</div>
                          <div className="text-emerald-400 font-bold text-sm">{formatCurrency(selectedUser.balance || 0)}</div>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                          <div className="text-slate-400 text-xs">Games</div>
                          <div className="text-white font-bold text-sm">{gamesPlayed}</div>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                          <div className="text-slate-400 text-xs">Won</div>
                          <div className="text-emerald-400 font-bold text-sm">{gamesWon}</div>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                          <div className="text-slate-400 text-xs">Win Rate</div>
                          <div className="text-cyan-400 font-bold text-sm">{winRate}%</div>
                        </div>
                      </div>

                      {/* Lost & Winnings */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-500/10 rounded p-2 border border-red-500/30">
                          <div className="text-red-400 text-xs">Lost</div>
                          <div className="text-red-300 font-bold text-sm">{gamesLost}</div>
                        </div>
                        <div className="bg-emerald-500/10 rounded p-2 border border-emerald-500/30">
                          <div className="text-emerald-400 text-xs">Total Won</div>
                          <div className="text-emerald-300 font-bold text-sm">{formatCurrency(totalWinnings)}</div>
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* Contact Info - Compact */}
                <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                  <div className="text-slate-400 text-xs mb-1">Telegram</div>
                  <div className="text-white font-mono text-xs">{selectedUser.telegram_id}</div>
                </div>

                {selectedUser.phone && (
                  <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                    <div className="text-slate-400 text-xs mb-1">Phone</div>
                    <div className="flex items-center justify-between">
                      <div className="text-cyan-400 font-mono text-xs">{selectedUser.phone}</div>
                      <div className="flex gap-1">
                        <a href={`tel:${selectedUser.phone}`} className="text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-1.5 py-0.5 rounded transition-colors border border-emerald-500/30">Call</a>
                        <button
                          onClick={() => navigator.clipboard.writeText(String(selectedUser.phone))}
                          className="text-xs bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 px-1.5 py-0.5 rounded transition-colors border border-slate-600/50"
                        >Copy</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Wagering & Withdrawal Info */}
                <div className="space-y-2 pt-2 border-t border-slate-700/50">
                  <div className="text-xs font-semibold text-slate-300">Wagering & Withdrawal</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                      <div className="text-slate-400 text-xs">Locked Balance</div>
                      <div className="text-orange-400 font-bold text-sm">{formatCurrency(selectedUser.locked_balance || 0)}</div>
                    </div>
                    <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                      <div className="text-slate-400 text-xs">Pending Hold</div>
                      <div className="text-yellow-400 font-bold text-sm">{formatCurrency(selectedUser.pending_withdrawal_hold || 0)}</div>
                    </div>
                  </div>

                  {(selectedUser.wager_required || 0) > 0 && (
                    <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                      <div className="text-slate-400 text-xs mb-1">Wagering Progress</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900/50 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                            style={{width: `${Math.min(100, ((selectedUser.wager_progress || 0) / (selectedUser.wager_required || 1)) * 100)}%`}}
                          ></div>
                        </div>
                        <div className="text-xs text-slate-300 whitespace-nowrap">
                          {formatCurrency(selectedUser.wager_progress || 0)} / {formatCurrency(selectedUser.wager_required || 0)}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedUser.last_withdrawal_at && (
                    <div className="bg-slate-700/30 rounded p-2 border border-slate-700/50">
                      <div className="text-slate-400 text-xs mb-1">Last Withdrawal</div>
                      <div className="text-white text-xs">
                        {new Date(selectedUser.last_withdrawal_at).toLocaleDateString()} {new Date(selectedUser.last_withdrawal_at).toLocaleTimeString()}
                      </div>
                      <div className="text-slate-500 text-xs mt-1">
                        Daily withdrawn: {formatCurrency(selectedUser.daily_withdrawn_amount || 0)} / 500 ETB
                      </div>
                    </div>
                  )}
                </div>


                <div className="text-xs text-slate-500">Joined: {new Date(selectedUser.created_at).toLocaleDateString()}</div>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <button
                  onClick={() => {
                    if (userGames.length === 0) {
                      fetchUserGames(selectedUser.id)
                    } else {
                      setShowGameHistory(true)
                    }
                  }}
                  disabled={loadingGames}
                  className="w-full bg-purple-600/20 hover:bg-purple-600/40 disabled:opacity-50 text-purple-400 px-4 py-2 rounded-lg font-semibold transition-colors border border-purple-500/30 flex items-center justify-center gap-2"
                >
                  {loadingGames ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Game History ({userGames.length > 0 ? userGames.length : selectedUser.games_played || 0})
                    </>
                  )}
                </button>
                <div className="flex gap-3">
                  {selectedUser.phone && (
                    <a
                      href={`tel:${selectedUser.phone}`}
                      className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-4 py-2 rounded-lg font-semibold transition-colors text-center border border-emerald-500/30"
                    >
                      Call
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
                    className="flex-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-lg font-semibold transition-colors border border-blue-500/30"
                  >
                    Telegram
                  </button>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600/50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-white">Delete User</h3>
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
                    <h4 className="font-semibold text-red-400 text-lg">Warning!</h4>
                    <p className="text-red-300 text-sm">This action cannot be undone.</p>
                  </div>
                </div>

                <p className="text-slate-300 mb-4">
                  Are you sure you want to delete <strong className="text-white">{selectedUser.username || 'this user'}</strong>?
                </p>
                
                <div className="bg-slate-700/30 rounded-lg p-3 text-sm text-slate-300 border border-slate-700/50">
                  <p className="mb-2 font-semibold">This will:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                    <li>Permanently delete the user account</li>
                    <li>Remove all transaction history</li>
                    <li>Clear winner references from games</li>
                    <li>Cannot be reversed</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600/50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deletingUser}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/40 disabled:bg-red-800/20 disabled:cursor-not-allowed text-red-400 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 border border-red-500/30"
                >
                  {deletingUser ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete User'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game History Modal */}
        {showGameHistory && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-6 max-w-5xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6 sticky top-0 bg-slate-800 pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">Game History - {selectedUser.username}</h3>
                  <p className="text-slate-400 text-sm">ID: {selectedUser.id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={() => { setShowGameHistory(false); setUserGames([]); setUserTransactions([]); }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

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
                    // Only games where this player was a participant (not spectator)
                    const playerGames = userGames.filter(g => g.players?.includes(selectedUser.id))
                    
                    // Total winnings from games where player won
                    const totalWinnings = playerGames
                      .filter(g => g.winner_id === selectedUser.id)
                      .reduce((sum, g) => sum + (g.net_prize || 0), 0)
                    
                    const totalStakesLost = playerGames
                      .filter(g => g.winner_id !== selectedUser.id)
                      .reduce((sum, g) => sum + (g.stake || 0), 0)
                    
                    // Net profit is the current balance (accounts for withdrawals, deposits, etc)
                    const netProfit = selectedUser.balance || 0
                    
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-700/50">
                        <div>
                          <div className="text-slate-400 text-xs">Total Games</div>
                          <div className="text-white font-bold text-lg">{playerGames.length}</div>
                        </div>
                        <div>
                          <div className="text-emerald-400 text-xs">Won</div>
                          <div className="text-emerald-400 font-bold text-lg">
                            {userGames.filter(g => g.winner_id === selectedUser.id).length}
                          </div>
                        </div>
                        <div>
                          <div className="text-red-400 text-xs">Lost</div>
                          <div className="text-red-400 font-bold text-lg">
                            {userGames.filter(g => g.players?.includes(selectedUser.id) && g.winner_id !== selectedUser.id).length}
                          </div>
                        </div>
                        <div>
                          <div className="text-cyan-400 text-xs">Total Winnings</div>
                          <div className="text-cyan-400 font-bold text-lg">
                            {formatCurrency(totalWinnings)}
                          </div>
                        </div>
                        <div>
                          <div className="text-red-400 text-xs">Money Lost</div>
                          <div className="text-red-400 font-bold text-lg">
                            {formatCurrency(totalStakesLost)}
                          </div>
                        </div>
                        <div>
                          <div className={`text-xs ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            Net Profit/Loss
                          </div>
                          <div className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                          </div>
                        </div>
                        <div>
                          <div className="text-orange-400 text-xs">Win Rate</div>
                          <div className="text-orange-400 font-bold text-lg">
                            {playerGames.length > 0 
                              ? `${Math.round((playerGames.filter(g => g.winner_id === selectedUser.id).length / playerGames.length) * 100)}%`
                              : '0%'
                            }
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Games List */}
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-300 mb-3">Recent Games</div>
                    {userGames.map((game) => {
                      const isWinner = game.winner_id === selectedUser.id
                      const isPlayer = game.players?.includes(selectedUser.id)
                      const playerCount = (game.players?.length || 0) + (game.bots?.length || 0)
                      
                      return (
                        <div key={game.id} className={`rounded-lg p-3 border transition-colors ${
                          isWinner ? 'bg-emerald-500/10 border-emerald-500/30' :
                          isPlayer ? 'bg-red-500/10 border-red-500/30' :
                          'bg-slate-700/30 border-slate-700/50'
                        }`}>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-center">
                            {/* Result */}
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="text-xs text-slate-400">Result</div>
                                <div className={`font-semibold text-sm ${
                                  isWinner ? 'text-emerald-400' : isPlayer ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                  {isWinner ? 'WIN' : isPlayer ? 'LOSS' : 'SPECTATE'}
                                </div>
                              </div>
                            </div>

                            {/* Stake */}
                            <div>
                              <div className="text-xs text-slate-400">Stake</div>
                              <div className="text-white font-semibold">{formatCurrency(game.stake || 0)}</div>
                            </div>

                            {/* Prize Pool */}
                            <div>
                              <div className="text-xs text-slate-400">Prize Pool</div>
                              <div className="text-cyan-400 font-semibold">{formatCurrency(game.prize_pool || 0)}</div>
                            </div>

                            {/* Winnings (if winner) */}
                            {isWinner && game.net_prize && (
                              <div>
                                <div className="text-xs text-emerald-400">Won</div>
                                <div className="text-emerald-400 font-bold">{formatCurrency(game.net_prize)}</div>
                              </div>
                            )}

                            {/* Players */}
                            <div>
                              <div className="text-xs text-slate-400">Players</div>
                              <div className="text-white font-semibold">{playerCount}</div>
                            </div>

                            {/* Date */}
                            <div>
                              <div className="text-xs text-slate-400">Date</div>
                              <div className="text-white text-sm">{new Date(game.created_at).toLocaleDateString()}</div>
                              <div className="text-xs text-slate-500">{new Date(game.created_at).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Transactions List */}
                  <div className="space-y-2 mt-8">
                    <div className="text-sm font-semibold text-slate-300 mb-3">Recent Transactions</div>
                    {loadingTransactions ? (
                      <div className="flex items-center justify-center py-6 text-slate-400">
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading transactions...
                      </div>
                    ) : userTransactions.length === 0 ? (
                      <div className="text-slate-400 text-sm">No transactions found</div>
                    ) : (
                      <div className="space-y-2">
                        {userTransactions.slice(0, 50).map((tx: any) => {
                          const color = tx.type === 'win' ? 'text-emerald-400' : tx.type === 'stake' ? 'text-red-400' : tx.type === 'deposit' ? 'text-cyan-400' : 'text-yellow-400'
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-700/50 bg-slate-700/30">
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-semibold ${color}`}>{tx.type.toUpperCase()}</span>
                                {tx.status && <span className={`text-xs px-2 py-0.5 rounded border ${tx.status === 'pending' ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>{tx.status}</span>}
                              </div>
                              <div className="text-white font-semibold">{formatCurrency(Math.abs(Number(tx.amount) || 0))}</div>
                              <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setShowGameHistory(false); setUserGames([]); setUserTransactions([]); }}
                  className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600/50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )}
