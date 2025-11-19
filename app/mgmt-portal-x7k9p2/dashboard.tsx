'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ProfessionalDashboard() {
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
    pendingWithdrawals: 0,
    totalTransactions: 0,
    totalCommission: 0,
    todayCommission: 0,
  })

  const [chartData, setChartData] = useState<any>(null)
  const [pendingDeposits, setPendingDeposits] = useState(0)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/mgmt-portal-x7k9p2/login')
    } else if (isAuthenticated) {
      fetchDashboardData()
    }
  }, [authLoading, isAuthenticated, router])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch users stats
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Active users (updated in last 7 days)
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

      // Fetch revenue (total and today)
      const { data: allGames } = await supabase
        .from('games')
        .select('stake, created_at')
        .eq('status', 'finished')

      let totalRevenue = 0
      let todayRevenue = 0
      const today = new Date().toDateString()

      allGames?.forEach((game: any) => {
        const stake = game.stake || 0
        totalRevenue += stake
        if (new Date(game.created_at).toDateString() === today) {
          todayRevenue += stake
        }
      })

      // Fetch pending deposits
      const { count: pendingDepositsCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'deposit')
        .eq('status', 'pending')
      setPendingDeposits(pendingDepositsCount || 0)

      // Fetch pending withdrawals
      const { count: pendingWithdrawals } = await supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // Fetch transactions count
      const { count: totalTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })

      // Fetch commission (total and today)
      const { data: users } = await supabase
        .from('users')
        .select('total_winnings, created_at')

      let totalCommission = 0
      let todayCommission = 0

      users?.forEach((user: any) => {
        const commission = (user.total_winnings || 0) * 0.05 // 5% commission
        totalCommission += commission
        if (new Date(user.created_at).toDateString() === today) {
          todayCommission += commission
        }
      })

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalGames: totalGames || 0,
        activeGames: activeGames || 0,
        totalRevenue,
        todayRevenue,
        pendingWithdrawals: pendingWithdrawals || 0,
        totalTransactions: totalTransactions || 0,
        totalCommission,
        todayCommission,
      })

      // Fetch chart data (last 30 days)
      const last30Days = new Date()
      last30Days.setDate(last30Days.getDate() - 30)

      const { data: gamesData } = await supabase
        .from('games')
        .select('stake, created_at, status')
        .gte('created_at', last30Days.toISOString())
        .order('created_at', { ascending: true })

      // Process chart data
      const dailyData: { [key: string]: { revenue: number; games: number; users: number } } = {}

      gamesData?.forEach((game: any) => {
        const date = new Date(game.created_at).toLocaleDateString()
        if (!dailyData[date]) {
          dailyData[date] = { revenue: 0, games: 0, users: 0 }
        }
        dailyData[date].revenue += game.stake || 0
        dailyData[date].games += 1
      })

      const labels = Object.keys(dailyData).slice(-30)
      const revenueData = labels.map(date => dailyData[date].revenue)
      const gamesCountData = labels.map(date => dailyData[date].games)

      setChartData({
        labels,
        revenue: revenueData,
        gamesCount: gamesCountData,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Transform chart data for Recharts
  const chartDataFormatted = chartData?.labels?.map((label: string, index: number) => ({
    date: label,
    revenue: chartData.revenue[index] || 0,
    games: chartData.gamesCount[index] || 0,
  })) || []

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/mgmt-portal-x7k9p2/users', label: 'Users', icon: null, badge: null },
    { href: '/mgmt-portal-x7k9p2/games', label: 'Games', icon: null, badge: null },
    { href: '/mgmt-portal-x7k9p2/deposits', label: 'Deposits', icon: null, badge: pendingDeposits },
    { href: '/mgmt-portal-x7k9p2/withdrawals', label: 'Withdrawals', icon: null, badge: stats.pendingWithdrawals },
    { href: '/mgmt-portal-x7k9p2/transactions', label: 'Transactions', icon: null, badge: null },
    { href: '/mgmt-portal-x7k9p2/rooms', label: 'Rooms', icon: null, badge: null },
    { href: '/mgmt-portal-x7k9p2/banks', label: 'Banks', icon: null, badge: null },
    { href: '/mgmt-portal-x7k9p2/settings', label: 'Settings', icon: null, badge: null },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col lg:flex-row">
      {/* Side Navigation */}
      <aside className="w-full lg:w-64 bg-slate-800/50 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-700/50 sticky top-0 lg:h-screen overflow-y-auto lg:overflow-y-auto flex flex-col lg:flex-col">
        <div className="p-6 border-b border-slate-700/50 hidden lg:block">
          <h2 className="text-xl font-bold text-white">BingoX Admin</h2>
          <p className="text-slate-400 text-xs mt-1">Management Portal</p>
        </div>
        <nav className="p-2 lg:p-4 flex lg:flex-col gap-1 lg:gap-2 flex-wrap lg:flex-nowrap justify-center lg:justify-start items-center lg:items-stretch">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-center lg:justify-between px-2 lg:px-4 py-2 lg:py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors group relative"
            >
              <div className="flex items-center gap-2 lg:gap-3">
                <span className="text-lg lg:text-xl">{item.icon}</span>
                <span className="font-medium text-sm lg:text-base hidden lg:inline">{item.label}</span>
              </div>
              {item.badge !== null && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/50 w-full mt-auto">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-500/30 transition-colors text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">Welcome back, {admin?.username}</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Total Users */}
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-md rounded-lg p-6 border border-blue-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Total Users</span>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
            <p className="text-blue-400 text-xs mt-2">Active: {stats.activeUsers}</p>
          </div>

          {/* Total Games */}
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-md rounded-lg p-6 border border-green-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Total Games</span>
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalGames}</div>
            <p className="text-green-400 text-xs mt-2">Active: {stats.activeGames}</p>
          </div>

          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-md rounded-lg p-6 border border-purple-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Total Revenue</span>
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-purple-400 text-xs mt-2">Today: {formatCurrency(stats.todayRevenue)}</p>
          </div>

          {/* Commission */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 backdrop-blur-md rounded-lg p-6 border border-yellow-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Commission</span>
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(stats.totalCommission)}</div>
            <p className="text-yellow-400 text-xs mt-2">Today: {formatCurrency(stats.todayCommission)}</p>
          </div>

          {/* Pending Withdrawals */}
          <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-md rounded-lg p-6 border border-red-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Pending</span>
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{stats.pendingWithdrawals}</div>
            <p className="text-red-400 text-xs mt-2">Awaiting approval</p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg p-6 border border-slate-700/50 shadow-lg mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Analytics</h2>
            <p className="text-slate-400 text-sm">Last 30 days performance</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700/30 w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataFormatted} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(75, 85, 99, 0.2)" />
                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#3b82f6" style={{ fontSize: '12px' }} label={{ value: 'Revenue (ETB)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', border: '1px solid #3b82f6', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') return [formatCurrency(value), 'Revenue (ETB)']
                    return [Math.round(value), 'Games Played']
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="games" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} yAxisId="right" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/mgmt-portal-x7k9p2/users" className="bg-slate-800/50 backdrop-blur-md rounded-lg p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-colors group relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20a9 9 0 0118 0v2h2v-2a11 11 0 00-22 0v2h2v-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Manage Users</h3>
                <p className="text-slate-400 text-sm">View & edit users</p>
              </div>
            </div>
          </Link>

          <Link href="/mgmt-portal-x7k9p2/games" className="bg-slate-800/50 backdrop-blur-md rounded-lg p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-colors group relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">View Games</h3>
                <p className="text-slate-400 text-sm">Monitor games</p>
              </div>
            </div>
          </Link>

          <Link href="/mgmt-portal-x7k9p2/withdrawals" className="bg-slate-800/50 backdrop-blur-md rounded-lg p-6 border border-slate-700/50 hover:border-yellow-500/50 transition-colors group relative">
            {stats.pendingWithdrawals > 0 && (
              <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {stats.pendingWithdrawals}
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Withdrawals</h3>
                <p className="text-slate-400 text-sm">Approve requests</p>
              </div>
            </div>
          </Link>

          <Link href="/mgmt-portal-x7k9p2/settings" className="bg-slate-800/50 backdrop-blur-md rounded-lg p-6 border border-slate-700/50 hover:border-purple-500/50 transition-colors group relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Settings</h3>
                <p className="text-slate-400 text-sm">System config</p>
              </div>
            </div>
          </Link>
        </div>
        </main>
      </div>
    </div>
  )
}
