"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

export default function AdminDashboard() {
  const router = useRouter()
  const { admin, isAuthenticated, loading: authLoading, logout } = useAdminAuth()
  const [loading, setLoading] = useState(false)
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalGames: 0,
    activeGames: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalTransactions: 0,
    totalCommission: 0,
    todayCommission: 0,
  })

  const [recentGames, setRecentGames] = useState<any[]>([])
  const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/mgmt-portal-x7k9p2/login')
    } else if (isAuthenticated) {
      fetchDashboardData()
    }
  }, [authLoading, isAuthenticated, router])

  const fetchDashboardData = async () => {
    try {
      // Fetch users stats
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
      
      // Active users (users who played in last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sevenDaysAgo.toISOString())

      // Fetch games stats
      const { count: totalGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
      
      const { count: activeGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .in('status', ['waiting', 'countdown', 'active'])

      // Fetch revenue and commission
      const { data: allGames } = await supabase
        .from('games')
        .select('prize_pool, commission_amount, created_at')
      
      const totalRevenue = allGames?.reduce((sum, g) => sum + (g.prize_pool || 0), 0) || 0
      const totalCommission = allGames?.reduce((sum, g) => sum + (g.commission_amount || 0), 0) || 0
      
      const today = new Date().toISOString().split('T')[0]
      const todayRevenue = allGames?.filter(g => g.created_at?.startsWith(today))
        .reduce((sum, g) => sum + (g.prize_pool || 0), 0) || 0
      const todayCommission = allGames?.filter(g => g.created_at?.startsWith(today))
        .reduce((sum, g) => sum + (g.commission_amount || 0), 0) || 0

      // Fetch pending deposits
      const { count: pendingDepositsCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'deposit')
        .eq('status', 'pending')

      // Fetch pending withdrawals (if table exists)
      let pendingWithdrawals = 0
      try {
        const { count } = await supabase
          .from('withdrawals')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        pendingWithdrawals = count || 0
      } catch (e) {
        // Table doesn't exist yet
      }

      // Fetch transactions count
      const { count: totalTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalGames: totalGames || 0,
        activeGames: activeGames || 0,
        totalRevenue,
        todayRevenue,
        pendingDeposits: pendingDepositsCount || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        totalTransactions: totalTransactions || 0,
        totalCommission,
        todayCommission,
      })

      // Fetch recent games
      const { data: games } = await supabase
        .from('games')
        .select('id, status, prize_pool, rooms(name)')
        .in('status', ['waiting', 'countdown', 'active'])
        .order('created_at', { ascending: false })
        .limit(3)

      const gamesWithPlayers = await Promise.all(
        (games || []).map(async (game: any) => {
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)

          return {
            id: game.id.slice(0, 8),
            room: game.rooms?.name || 'Unknown',
            players: count || 0,
            prize: game.prize_pool || 0,
            status: game.status
          }
        })
      )
      setRecentGames(gamesWithPlayers)

      // Fetch recent withdrawals
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('id, amount, status, created_at, users(username)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(3)

      setRecentWithdrawals(withdrawals?.map((w: any) => ({
        id: w.id.slice(0, 8),
        user: w.users?.username || 'Unknown',
        amount: w.amount,
        status: w.status,
        date: new Date(w.created_at).toLocaleString()
      })) || [])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header - Mobile Responsive */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">🎰 Bingo Royale Admin</h1>
              <p className="text-gray-400 text-xs sm:text-sm">Dashboard & Management</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 text-sm">
              <span className="text-gray-300 hidden sm:inline">Welcome, {admin?.username}</span>
              <Link href="/" className="text-gray-300 hover:text-white transition-colors">
                View Site
              </Link>
              <button onClick={logout} className="bg-red-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-base">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
        {/* Stats Grid - 2 Columns on Mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-xs sm:text-sm">Users</span>
              <span className="text-xl sm:text-2xl">👥</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalUsers.toLocaleString()}</div>
            <div className="text-xs text-green-400 mt-1">↑ {stats.activeUsers} active</div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-xs sm:text-sm">Games</span>
              <span className="text-xl sm:text-2xl">🎮</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalGames.toLocaleString()}</div>
            <div className="text-xs text-green-400 mt-1">↑ {stats.activeGames} active</div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-xs sm:text-sm">Revenue</span>
              <span className="text-xl sm:text-2xl">💰</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</div>
            <div className="text-xs text-green-400 mt-1">↑ {formatCurrency(stats.todayRevenue)} today</div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-xs sm:text-sm">Deposits</span>
              <span className="text-xl sm:text-2xl">💵</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-400">{stats.pendingDeposits}</div>
            <div className="text-xs text-gray-400 mt-1">Pending</div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-xs sm:text-sm">Withdrawals</span>
              <span className="text-xl sm:text-2xl">💸</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.pendingWithdrawals}</div>
            <div className="text-xs text-gray-400 mt-1">Pending</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-purple-400/30 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-200 text-xs sm:text-sm font-semibold">Commission</span>
              <span className="text-xl sm:text-2xl">💎</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-purple-300">{formatCurrency(stats.totalCommission)}</div>
            <div className="text-xs text-purple-200 mt-1">↑ {formatCurrency(stats.todayCommission)} today</div>
          </div>
        </div>

        {/* Quick Actions - 2 Columns on Mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Link href="/mgmt-portal-x7k9p2/users" className="bg-blue-600 hover:bg-blue-700 rounded-lg p-3 sm:p-4 text-white transition-all">
            <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">👥</div>
            <h3 className="text-sm sm:text-base font-bold">Users</h3>
            <p className="text-blue-100 text-xs hidden sm:block">Manage users</p>
          </Link>

          <Link href="/mgmt-portal-x7k9p2/deposits" className="bg-green-600 hover:bg-green-700 rounded-lg p-3 sm:p-4 text-white transition-all">
            <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">💵</div>
            <h3 className="text-sm sm:text-base font-bold">Deposits</h3>
            <p className="text-green-100 text-xs hidden sm:block">Approve/reject</p>
          </Link>

          <Link href="/mgmt-portal-x7k9p2/withdrawals" className="bg-yellow-600 hover:bg-yellow-700 rounded-lg p-3 sm:p-4 text-white transition-all">
            <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">💸</div>
            <h3 className="text-sm sm:text-base font-bold">Withdrawals</h3>
            <p className="text-yellow-100 text-xs hidden sm:block">Approve/reject</p>
          </Link>

          <Link href="/mgmt-portal-x7k9p2/games" className="bg-purple-600 hover:bg-purple-700 rounded-lg p-3 sm:p-4 text-white transition-all">
            <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">📊</div>
            <h3 className="text-sm sm:text-base font-bold">Live Games</h3>
            <p className="text-purple-100 text-xs hidden sm:block">Monitor games</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Active Games */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base sm:text-lg font-bold text-white">Active Games</h2>
              <Link href="/mgmt-portal-x7k9p2/games" className="text-blue-400 hover:text-blue-300 text-sm">
                View All →
              </Link>
            </div>
            <div className="space-y-2">
              {recentGames.map(game => (
                <div key={game.id} className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-white text-xs sm:text-sm">{game.id} - {game.room}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      game.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {game.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-gray-300">
                    <span>Players: {game.players}</span>
                    <span>Prize: {formatCurrency(game.prize)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Withdrawals */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 sm:p-4 border border-white/20">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base sm:text-lg font-bold text-white">Pending Withdrawals</h2>
              <Link href="/mgmt-portal-x7k9p2/withdrawals" className="text-blue-400 hover:text-blue-300 text-sm">
                View All →
              </Link>
            </div>
            <div className="space-y-2">
              {recentWithdrawals.map(withdrawal => (
                <div key={withdrawal.id} className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-white text-xs sm:text-sm">{withdrawal.user}</span>
                    <span className="text-yellow-400 font-bold text-sm">{formatCurrency(withdrawal.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-400 text-xs">{withdrawal.date}</span>
                    <div className="flex gap-1">
                      <button className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">
                        Approve
                      </button>
                      <button className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-4 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/mgmt-portal-x7k9p2/transactions" className="bg-white/5 hover:bg-white/10 rounded-lg p-3 sm:p-4 text-center text-white border border-white/10 transition-all">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">💳</div>
            <div className="font-medium text-xs sm:text-sm">Transactions</div>
          </Link>
          <Link href="/mgmt-portal-x7k9p2/rooms" className="bg-white/5 hover:bg-white/10 rounded-lg p-3 sm:p-4 text-center text-white border border-white/10 transition-all">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">🚪</div>
            <div className="font-medium text-xs sm:text-sm">Rooms</div>
          </Link>
          <Link href="/mgmt-portal-x7k9p2/broadcast" className="bg-white/5 hover:bg-white/10 rounded-lg p-3 sm:p-4 text-center text-white border border-white/10 transition-all">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">📢</div>
            <div className="font-medium text-xs sm:text-sm">Broadcast</div>
          </Link>
          <Link href="/mgmt-portal-x7k9p2/settings" className="bg-white/5 hover:bg-white/10 rounded-lg p-3 sm:p-4 text-center text-white border border-white/10 transition-all">
            <div className="text-xl sm:text-2xl mb-1 sm:mb-2">⚙️</div>
            <div className="font-medium text-xs sm:text-sm">Settings</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
