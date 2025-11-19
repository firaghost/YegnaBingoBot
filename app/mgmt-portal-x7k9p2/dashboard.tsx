'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'

import { getAllConfig } from '@/lib/admin-config'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Users, Gamepad2, CreditCard, TrendingDown, BarChart3, Home, Building2, Megaphone, Settings, Share2 } from 'lucide-react'

type ChartGrouping = 'daily' | 'weekly' | 'monthly' | 'yearly'

type ChartPoint = {
  label: string
  sortKey: number
  revenue: number
  commission: number
  newUsers: number
  referralEarnings: number
  games: number
}

const GROUPING_SETTINGS: Record<ChartGrouping, { label: string; bucketCount: number }> = {
  daily: { label: 'Daily', bucketCount: 1 },
  weekly: { label: 'Weekly', bucketCount: 12 },
  monthly: { label: 'Monthly', bucketCount: 12 },
  yearly: { label: 'Yearly', bucketCount: 5 }
}

function alignDateToGrouping(date: Date, grouping: ChartGrouping): Date {
  const aligned = new Date(date)
  aligned.setSeconds(0, 0)
  switch (grouping) {
    case 'daily': {
      aligned.setMinutes(0, 0, 0)
      break
    }
    case 'weekly': {
      aligned.setHours(0, 0, 0, 0)
      const day = aligned.getDay()
      const diff = (day + 6) % 7 // align to Monday
      aligned.setDate(aligned.getDate() - diff)
      break
    }
    case 'monthly': {
      aligned.setHours(0, 0, 0, 0)
      aligned.setDate(1)
      break
    }
    case 'yearly': {
      aligned.setHours(0, 0, 0, 0)
      aligned.setMonth(0, 1)
      break
    }
  }
  return aligned
}

function addInterval(date: Date, grouping: ChartGrouping, amount: number): Date {
  const next = new Date(date)
  switch (grouping) {
    case 'daily':
      next.setHours(next.getHours() + amount)
      break
    case 'weekly':
      next.setDate(next.getDate() + amount * 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + amount)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + amount)
      break
  }
  return alignDateToGrouping(next, grouping)
}

function formatBucketLabel(date: Date, grouping: ChartGrouping): string {
  switch (grouping) {
    case 'daily':
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: undefined })
    case 'weekly': {
      const end = new Date(date)
      end.setDate(end.getDate() + 6)
      return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    }
    case 'monthly':
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    case 'yearly':
      return date.getFullYear().toString()
    default:
      return date.toLocaleDateString()
  }
}

function generateBucketDates(grouping: ChartGrouping, rangeStart: Date, rangeEnd: Date): Date[] {
  if (grouping === 'daily') {
    const dayStart = startOfDay(rangeStart)
    const buckets: Date[] = []
    for (let hour = 0; hour < 24; hour += 1) {
      const bucket = new Date(dayStart)
      bucket.setHours(hour, 0, 0, 0)
      buckets.push(bucket)
    }
    return buckets
  }

  const buckets: Date[] = []
  let current = alignDateToGrouping(rangeStart, grouping)
  const endAligned = alignDateToGrouping(rangeEnd, grouping)

  while (current <= endAligned) {
    buckets.push(new Date(current))
    current = addInterval(current, grouping, 1)
  }

  if (buckets.length === 0) {
    buckets.push(alignDateToGrouping(rangeStart, grouping))
  }

  return buckets
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function getDefaultRangeForGrouping(grouping: ChartGrouping): { start: Date; end: Date } {
  const now = new Date()
  if (grouping === 'daily') {
    return { start: startOfDay(now), end: endOfDay(now) }
  }

  const alignedEnd = alignDateToGrouping(now, grouping)
  const span = GROUPING_SETTINGS[grouping].bucketCount - 1
  const alignedStart = addInterval(alignedEnd, grouping, -span)
  return {
    start: alignDateToGrouping(alignedStart, grouping),
    end: alignDateToGrouping(addInterval(alignedEnd, grouping, 0), grouping)
  }
}

function toDateInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().substring(0, 10)
}

function parseDateInput(value: string): Date | null {
  if (!value) return null
  const parts = value.split('-').map(Number)
  if (parts.length !== 3) return null
  const [year, month, day] = parts
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export default function ProfessionalDashboard() {
  const router = useRouter()
  const { admin, isAuthenticated, loading: authLoading, logout } = useAdminAuth()
  const [loading, setLoading] = useState(false)

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalGames: 0,
    activeGames: 0,
    totalRevenueReal: 0,
    totalRevenueBonus: 0,
    todayRevenueReal: 0,
    todayRevenueBonus: 0,
    pendingWithdrawals: 0,
    totalTransactions: 0,
    totalCommission: 0,
    todayCommission: 0,
    totalReferrals: 0,
    totalReferralEarnings: 0,
  })

  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [grouping, setGrouping] = useState<ChartGrouping>('daily')
  const [rangeStart, setRangeStart] = useState<Date>(() => getDefaultRangeForGrouping('daily').start)
  const [rangeEnd, setRangeEnd] = useState<Date>(() => getDefaultRangeForGrouping('daily').end)
  const [pendingDeposits, setPendingDeposits] = useState(0)

  const handleGroupingChange = (next: ChartGrouping) => {
    setGrouping(next)
    const { start, end } = getDefaultRangeForGrouping(next)
    setRangeStart(start)
    setRangeEnd(end)
  }

  const handleSingleDateChange = (value: string) => {
    const date = parseDateInput(value)
    if (!date) return
    const dayStart = startOfDay(date)
    setRangeStart(dayStart)
    setRangeEnd(endOfDay(date))
  }

  const handleRangeStartChange = (value: string) => {
    const date = parseDateInput(value)
    if (!date) return
    const normalized = startOfDay(date)
    setRangeStart(normalized)
    setRangeEnd(prev => (normalized > prev ? endOfDay(normalized) : prev))
  }

  const handleRangeEndChange = (value: string) => {
    const date = parseDateInput(value)
    if (!date) return
    const normalized = endOfDay(date)
    setRangeEnd(normalized)
    setRangeStart(prev => (normalized < prev ? startOfDay(date) : prev))
  }

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)

      const normalizedRangeStart = startOfDay(rangeStart)
      const normalizedRangeEnd = endOfDay(rangeEnd)
      if (normalizedRangeStart > normalizedRangeEnd) {
        normalizedRangeEnd.setTime(normalizedRangeStart.getTime())
      }

      const rangeStartIso = normalizedRangeStart.toISOString()
      const rangeEndIso = normalizedRangeEnd.toISOString()

      const { count: totalUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { count: activeUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sevenDaysAgo.toISOString())

      const { count: totalGames } = await supabaseAdmin
        .from('games')
        .select('*', { count: 'exact', head: true })

      const { count: activeGames } = await supabaseAdmin
        .from('games')
        .select('*', { count: 'exact', head: true })
        .in('status', ['waiting', 'countdown', 'active'])

      const config = await getAllConfig()
      const commissionRate = Number((config as any)?.gameCommissionRate) || 0.1

      const today = new Date().toDateString()

      const depositTxsRes = await supabaseAdmin
        .from('transactions')
        .select('amount, created_at')
        .eq('type', 'deposit')
        .eq('status', 'completed')
      if (depositTxsRes.error) throw depositTxsRes.error

      const depositBonusTxsRes = await supabaseAdmin
        .from('transactions')
        .select('amount, created_at')
        .eq('type', 'bonus')
        .eq('status', 'completed')
        .ilike('description', 'Deposit bonus%')
      if (depositBonusTxsRes.error) throw depositBonusTxsRes.error

      const stakeTxsRes = await supabaseAdmin
        .from('transactions')
        .select('created_at, metadata, amount')
        .eq('type', 'stake')
        .eq('status', 'completed')
      if (stakeTxsRes.error) throw stakeTxsRes.error

      const referralUsersRes = await supabaseAdmin
        .from('users')
        .select('total_referrals, referral_earnings')
        .limit(10000)
      if (referralUsersRes.error) throw referralUsersRes.error

      let totalRevenueReal = 0
      let totalRevenueBonus = 0
      let todayRevenueReal = 0
      let todayRevenueBonus = 0

      depositTxsRes.data?.forEach((tx: any) => {
        const amt = Number(tx?.amount || 0)
        totalRevenueReal += amt
        if (new Date(tx.created_at).toDateString() === today) {
          todayRevenueReal += amt
        }
      })

      depositBonusTxsRes.data?.forEach((tx: any) => {
        const amt = Number(tx?.amount || 0)
        totalRevenueBonus += amt
        if (new Date(tx.created_at).toDateString() === today) {
          todayRevenueBonus += amt
        }
      })

      let realStakeTotal = 0
      let realStakeToday = 0
      stakeTxsRes.data?.forEach((tx: any) => {
        const md = (tx?.metadata || {}) as any
        let main = Number(md?.main_deducted ?? 0)
        if (!main || Number.isNaN(main)) {
          main = Math.abs(Number(tx?.amount ?? 0))
        }
        realStakeTotal += main
        if (new Date(tx.created_at).toDateString() === today) {
          realStakeToday += main
        }
      })

      let totalReferrals = 0
      let totalReferralEarnings = 0
      referralUsersRes.data?.forEach((row: any) => {
        totalReferrals += Number(row?.total_referrals || 0)
        totalReferralEarnings += Number(row?.referral_earnings || 0)
      })

      const { count: pendingDepositsCount } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'deposit')
        .eq('status', 'pending')
      setPendingDeposits(pendingDepositsCount || 0)

      const { count: pendingWithdrawals } = await supabaseAdmin
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: totalTransactions } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })

      const totalCommission = realStakeTotal * commissionRate
      const todayCommission = realStakeToday * commissionRate

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalGames: totalGames || 0,
        activeGames: activeGames || 0,
        totalRevenueReal,
        totalRevenueBonus,
        todayRevenueReal,
        todayRevenueBonus,
        pendingWithdrawals: pendingWithdrawals || 0,
        totalTransactions: totalTransactions || 0,
        totalCommission,
        todayCommission,
        totalReferrals,
        totalReferralEarnings,
      })

      const bucketDates = generateBucketDates(grouping, normalizedRangeStart, normalizedRangeEnd)
      const bucketKeyToIndex = new Map<string, number>()
      const chartPoints: ChartPoint[] = bucketDates.map((date, idx) => {
        const aligned = alignDateToGrouping(date, grouping)
        const key = aligned.toISOString()
        bucketKeyToIndex.set(key, idx)
        return {
          label: formatBucketLabel(aligned, grouping),
          sortKey: aligned.getTime(),
          revenue: 0,
          commission: 0,
          newUsers: 0,
          referralEarnings: 0,
          games: 0,
        }
      })

      if (bucketDates.length > 0) {
        const [
          depositChartRes,
          stakeChartRes,
          newUsersRes,
          referralChartRes,
          gamesChartRes,
        ] = await Promise.all([
          supabaseAdmin
            .from('transactions')
            .select('created_at, amount')
            .eq('type', 'deposit')
            .eq('status', 'completed')
            .gte('created_at', rangeStartIso)
            .lte('created_at', rangeEndIso)
            .order('created_at', { ascending: true }),
          supabaseAdmin
            .from('transactions')
            .select('created_at, metadata, amount')
            .eq('type', 'stake')
            .eq('status', 'completed')
            .gte('created_at', rangeStartIso)
            .lte('created_at', rangeEndIso)
            .order('created_at', { ascending: true }),
          supabaseAdmin
            .from('users')
            .select('created_at')
            .gte('created_at', rangeStartIso)
            .lte('created_at', rangeEndIso)
            .order('created_at', { ascending: true }),
          supabaseAdmin
            .from('referrals')
            .select('created_at, bonus_amount, status')
            .eq('status', 'completed')
            .gte('created_at', rangeStartIso)
            .lte('created_at', rangeEndIso)
            .order('created_at', { ascending: true }),
          supabaseAdmin
            .from('games')
            .select('created_at, status')
            .gte('created_at', rangeStartIso)
            .lte('created_at', rangeEndIso)
            .order('created_at', { ascending: true }),
        ])

        if (depositChartRes.error) {
          console.error('Deposit chart fetch failed:', depositChartRes.error)
        }
        if (stakeChartRes.error) {
          console.error('Stake chart fetch failed:', stakeChartRes.error)
        }
        if (newUsersRes.error) {
          console.error('New users chart fetch failed:', newUsersRes.error)
        }
        if (referralChartRes.error) {
          console.error('Referral chart fetch failed:', referralChartRes.error)
        }
        if (gamesChartRes.error) {
          console.error('Games chart fetch failed:', gamesChartRes.error)
        }

        depositChartRes.data?.forEach((tx: any) => {
          const key = alignDateToGrouping(new Date(tx.created_at), grouping).toISOString()
          const idx = bucketKeyToIndex.get(key)
          if (idx === undefined) return
          chartPoints[idx].revenue += Number(tx?.amount || 0)
        })

        stakeChartRes.data?.forEach((tx: any) => {
          const key = alignDateToGrouping(new Date(tx.created_at), grouping).toISOString()
          const idx = bucketKeyToIndex.get(key)
          if (idx === undefined) return
          const md = (tx?.metadata || {}) as any
          let main = Number(md?.main_deducted ?? 0)
          if (!main || Number.isNaN(main)) {
            main = Math.abs(Number(tx?.amount ?? 0))
          }
          chartPoints[idx].commission += main * commissionRate
        })

        newUsersRes.data?.forEach((user: any) => {
          const key = alignDateToGrouping(new Date(user.created_at), grouping).toISOString()
          const idx = bucketKeyToIndex.get(key)
          if (idx === undefined) return
          chartPoints[idx].newUsers += 1
        })

        referralChartRes.data?.forEach((ref: any) => {
          const key = alignDateToGrouping(new Date(ref.created_at), grouping).toISOString()
          const idx = bucketKeyToIndex.get(key)
          if (idx === undefined) return
          chartPoints[idx].referralEarnings += Number(ref?.bonus_amount || 0)
        })

        gamesChartRes.data?.forEach((game: any) => {
          const key = alignDateToGrouping(new Date(game.created_at), grouping).toISOString()
          const idx = bucketKeyToIndex.get(key)
          if (idx === undefined) return
          chartPoints[idx].games += 1
        })
      }

      setChartData(chartPoints)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [grouping, rangeStart, rangeEnd])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/mgmt-portal-x7k9p2/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchDashboardData()
    }
  }, [authLoading, isAuthenticated, fetchDashboardData])

  const groupingEntries = Object.entries(GROUPING_SETTINGS) as Array<[
    ChartGrouping,
    { label: string; bucketCount: number }
  ]>

  const chartDataFormatted = chartData.map((point) => ({
    label: point.label,
    revenue: Number(point.revenue.toFixed(2)),
    commission: Number(point.commission.toFixed(2)),
    referralEarnings: Number(point.referralEarnings.toFixed(2)),
    newUsers: point.newUsers,
    games: point.games,
  }))

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

  const hasPerm = (key: string) => {
    if (admin?.role === 'super_admin') return true
    const p = (admin?.permissions || {}) as Record<string, boolean>
    return Boolean(p[key])
  }
  const hasAny = (...keys: string[]) => keys.some(k => hasPerm(k))

  const navItems = [
    { href: '/mgmt-portal-x7k9p2/users', label: 'Users', icon: Users, badge: null, permsAny: ['users_view','users_manage'] },
    { href: '/mgmt-portal-x7k9p2/games', label: 'Games', icon: Gamepad2, badge: null, permsAny: ['games_view','games_manage'] },
    { href: '/mgmt-portal-x7k9p2/deposits', label: 'Deposits', icon: CreditCard, badge: pendingDeposits, permsAny: ['deposits_view','deposits_manage'] },
    { href: '/mgmt-portal-x7k9p2/withdrawals', label: 'Withdrawals', icon: TrendingDown, badge: stats.pendingWithdrawals, permsAny: ['withdrawals_view','withdrawals_manage'] },
    { href: '/mgmt-portal-x7k9p2/transactions', label: 'Transactions', icon: BarChart3, badge: null, permsAny: ['transactions_view'] },
    { href: '/mgmt-portal-x7k9p2/rooms', label: 'Rooms', icon: Home, badge: null, permsAny: ['rooms_view','rooms_manage'] },
    { href: '/mgmt-portal-x7k9p2/banks', label: 'Banks', icon: Building2, badge: null, permsAny: ['banks_view','banks_manage'] },
    { href: '/mgmt-portal-x7k9p2/broadcast', label: 'Broadcast', icon: Megaphone, badge: null, permsAny: ['broadcast_manage'] },
    { href: '/mgmt-portal-x7k9p2/settings', label: 'Settings', icon: Settings, badge: null, permsAny: ['settings_view','settings_manage'] },
  ] as const

  const visibleNavItems = navItems.filter(item => admin?.role === 'super_admin' || item.permsAny.some(k => hasPerm(k)))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col lg:flex-row">
      {/* Side Navigation */}
      <aside className="w-full lg:w-64 bg-slate-800/50 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-700/50 sticky top-0 lg:h-screen overflow-y-auto lg:overflow-y-auto flex flex-col lg:flex-col">
        <div className="p-6 border-b border-slate-700/50 hidden lg:block">
          <h2 className="text-xl font-bold text-white">BingoX Admin</h2>
          <p className="text-slate-400 text-xs mt-1">Management Portal</p>
        </div>
        {/* Profile Block */}
        <div className="px-4 py-4 border-b border-slate-700/50 hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold">
            {String(admin?.username || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">{admin?.username || '—'}</div>
            <div className="text-xs mt-1">
              <span className={`px-2 py-0.5 rounded-full border ${admin?.role === 'super_admin' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : admin?.role === 'admin' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                {admin?.role === 'super_admin' ? 'Super Admin' : (admin?.role || '').replace('_',' ').replace(/\b\w/g, c=>c.toUpperCase())}
              </span>
            </div>
          </div>
        </div>
        <nav className="p-2 lg:p-4 flex lg:flex-col gap-1 lg:gap-2 flex-wrap lg:flex-nowrap justify-center lg:justify-start items-center lg:items-stretch">
          {visibleNavItems.map((item) => {
            const IconComponent = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center lg:justify-between px-2 lg:px-4 py-2 lg:py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors group relative"
              >
                <div className="flex items-center gap-2 lg:gap-3">
                  <IconComponent className="w-5 h-5 lg:w-6 lg:h-6" />
                  <span className="font-medium text-sm lg:text-base hidden lg:inline">{item.label}</span>
                </div>
                {item.badge !== null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
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

          {/* Revenue (Real vs Bonus) */}
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-md rounded-lg p-6 border border-purple-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Revenue (Real)</span>
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(stats.totalRevenueReal)}</div>
            <p className="text-purple-400 text-xs mt-2">Today (Real): {formatCurrency(stats.todayRevenueReal)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/40 border border-slate-700/50 rounded-md p-2">
                <div className="text-slate-400">Bonus Derived (All)</div>
                <div className="text-slate-200 font-semibold">{formatCurrency(stats.totalRevenueBonus)}</div>
              </div>
              <div className="bg-slate-900/40 border border-slate-700/50 rounded-md p-2">
                <div className="text-slate-400">Bonus Today</div>
                <div className="text-slate-200 font-semibold">{formatCurrency(stats.todayRevenueBonus)}</div>
              </div>
            </div>
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

          {/* Referral Performance */}
          <div className="bg-gradient-to-br from-teal-500/20 to-teal-600/20 backdrop-blur-md rounded-lg p-6 border border-teal-500/30 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-sm font-medium">Referral Program</span>
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                <Share2 className="w-5 h-5 text-teal-300" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalReferrals}</div>
            <p className="text-teal-300 text-xs mt-2">Earnings: {formatCurrency(stats.totalReferralEarnings)}</p>
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
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Analytics</h2>
              <p className="text-slate-400 text-sm">Trend of revenue, commission, referral bonus, and new users</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupingEntries.map(([key, value]) => {
                const isActive = grouping === key
                return (
                  <button
                    key={key}
                    onClick={() => handleGroupingChange(key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      isActive
                        ? 'bg-cyan-600/80 border-cyan-400 text-white shadow-cyan-500/40 shadow'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:text-white hover:border-cyan-400/60'
                    }`}
                  >
                    {value.label}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {grouping === 'daily' ? (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <span>Day</span>
                  <input
                    type="date"
                    value={toDateInputValue(rangeStart)}
                    onChange={(e) => handleSingleDateChange(e.target.value)}
                    className="bg-slate-900/70 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                  />
                </label>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span>Start</span>
                    <input
                      type="date"
                      value={toDateInputValue(rangeStart)}
                      onChange={(e) => handleRangeStartChange(e.target.value)}
                      className="bg-slate-900/70 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <span>End</span>
                    <input
                      type="date"
                      value={toDateInputValue(rangeEnd)}
                      onChange={(e) => handleRangeEndChange(e.target.value)}
                      className="bg-slate-900/70 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700/30 w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataFormatted} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(75, 85, 99, 0.2)" />
                <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis
                  yAxisId="left"
                  stroke="#38bdf8"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Amount (ETB)', angle: -90, position: 'insideLeft', fill: '#38bdf8' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f97316"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'New Users', angle: 90, position: 'insideRight', fill: '#f97316' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                  labelStyle={{ color: '#cbd5f5' }}
                  formatter={(value: number, name) => {
                    if (name === 'New Users' || name === 'Games') {
                      return [value, name]
                    }
                    return [formatCurrency(Number(value)), name]
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (ETB)" stroke="#6366f1" strokeWidth={3} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="commission" name="Commission (ETB)" stroke="#facc15" strokeWidth={2} dot={false} strokeDasharray="6 2" />
                <Line yAxisId="left" type="monotone" dataKey="referralEarnings" name="Referral Bonus (ETB)" stroke="#14b8a6" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                <Line yAxisId="right" type="monotone" dataKey="newUsers" name="New Users" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="games" name="Games" stroke="#38bdf8" strokeWidth={2} dot={false} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {hasAny('users_view','users_manage') && (
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
          )}

          {hasAny('games_view','games_manage') && (
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
          )}

          {hasAny('withdrawals_view','withdrawals_manage') && (
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
          )}

          {hasAny('settings_view','settings_manage') && (
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
          )}
        </div>
        </main>
      </div>
    </div>
  )
}
