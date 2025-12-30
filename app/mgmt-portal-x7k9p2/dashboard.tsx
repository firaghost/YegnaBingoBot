
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase'

import { getAllConfig } from '@/lib/admin-config'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  LayoutGrid,
  Users,
  Ban,
  Gamepad2,
  PlayCircle,
  Trophy,
  Megaphone,
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Building2,
  Tag,
  Settings,
  Bell,
  Search,
  Menu,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react'

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

type RevenueOverviewPoint = { label: string; value: number }

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
  const pathname = usePathname()
  const { admin, isAuthenticated, loading: authLoading, logout } = useAdminAuth()
  const [loading, setLoading] = useState(false)

  const hasHydratedCacheRef = useRef(false)

  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)

  const [systemHealth, setSystemHealth] = useState({
    serverLoad: 0,
    memoryUsage: 0,
    activeConnections: 0,
  })

  const [liveAlerts, setLiveAlerts] = useState<
    Array<{ id: string; type: 'danger' | 'info' | 'success'; title: string; message: string; timestamp: string }>
  >([])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  const [recentTransactions, setRecentTransactions] = useState<any[]>([])

  const [revenueRange, setRevenueRange] = useState<'7d' | '30d' | 'year'>('7d')
  const [revenueOverview, setRevenueOverview] = useState<RevenueOverviewPoint[]>([])

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  const timeAgo = (date: Date): string => {
    const diffMs = Date.now() - date.getTime()
    const sec = Math.max(0, Math.floor(diffMs / 1000))
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    return `${day}d ago`
  }

  const computeSystemHealth = (nextStats: typeof stats) => {
    const load = clamp((nextStats.activeGames / 50) * 100, 0, 100)
    const mem = clamp((nextStats.activeUsers / Math.max(1, nextStats.totalUsers)) * 100, 0, 100)
    const conns = nextStats.activeUsers
    setSystemHealth({
      serverLoad: Math.round(load),
      memoryUsage: Math.round(mem),
      activeConnections: conns,
    })
  }

  const computeLiveAlerts = (txs: any[], nextStats: typeof stats) => {
    const alerts: Array<{ id: string; type: 'danger' | 'info' | 'success'; title: string; message: string; timestamp: string }> = []

    const highRisk = txs.find((t) => {
      const amt = Number(t?.amount || 0)
      const status = String(t?.status || '').toLowerCase()
      return status === 'pending' && amt >= 5000
    })

    if (highRisk) {
      const userLabel = highRisk?.users?.username || highRisk?.users?.telegram_id || String(highRisk?.user_id || '').slice(0, 8) || 'Unknown'
      alerts.push({
        id: `risk_${highRisk.id}`,
        type: 'danger',
        title: 'High Risk Transaction Pending',
        message: `User ${userLabel} has a pending ${highRisk.type} of ${formatCurrency(Number(highRisk.amount || 0))}.`,
        timestamp: highRisk?.created_at ? timeAgo(new Date(highRisk.created_at)) : 'Just now',
      })
    }

    if (nextStats.pendingWithdrawals > 0) {
      alerts.push({
        id: 'pending_withdrawals',
        type: 'info',
        title: 'Withdrawals Need Review',
        message: `${nextStats.pendingWithdrawals} withdrawal(s) are pending approval.`,
        timestamp: 'Now',
      })
    }

    if (nextStats.activeGames > 0) {
      alerts.push({
        id: 'live_games',
        type: 'success',
        title: 'Live Games Running',
        message: `${nextStats.activeGames} game(s) are currently active.`,
        timestamp: 'Live',
      })
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'all_good',
        type: 'success',
        title: 'All Systems Normal',
        message: 'No critical alerts right now.',
        timestamp: 'Now',
      })
    }

    setLiveAlerts(alerts.slice(0, 6))
  }

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
      setLoading((prev) => {
        if (hasHydratedCacheRef.current) return prev
        return true
      })

      const normalizedRangeStart = startOfDay(rangeStart)
      const normalizedRangeEnd = endOfDay(rangeEnd)
      if (normalizedRangeStart > normalizedRangeEnd) {
        normalizedRangeEnd.setTime(normalizedRangeStart.getTime())
      }

      const rangeStartIso = normalizedRangeStart.toISOString()
      const rangeEndIso = normalizedRangeEnd.toISOString()

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const [
        totalUsersRes,
        activeUsersRes,
        totalGamesRes,
        activeGamesRes,
        pendingDepositsRes,
        pendingWithdrawalsRes,
        totalTransactionsRes,
        recentTxRes,
        config,
      ] = await Promise.all([
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('updated_at', sevenDaysAgo.toISOString()),
        supabaseAdmin.from('games').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('games').select('*', { count: 'exact', head: true }).in('status', ['waiting', 'countdown', 'active']),
        supabaseAdmin.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'pending'),
        supabaseAdmin.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseAdmin.from('transactions').select('*', { count: 'exact', head: true }),
        supabaseAdmin
          .from('transactions')
          .select(
            `
              id,
              user_id,
              type,
              amount,
              status,
              created_at,
              users (username, telegram_id)
            `
          )
          .order('created_at', { ascending: false })
          .limit(10),
        getAllConfig(),
      ])

      const totalUsers = totalUsersRes.count || 0
      const activeUsers = activeUsersRes.count || 0
      const totalGames = totalGamesRes.count || 0
      const activeGames = activeGamesRes.count || 0

      setPendingDeposits(pendingDepositsRes.count || 0)

      const pendingWithdrawals = pendingWithdrawalsRes.count || 0
      const totalTransactions = totalTransactionsRes.count || 0

      if (recentTxRes.error) throw recentTxRes.error
      setRecentTransactions(recentTxRes.data || [])

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

      const commissionGamesRes = await supabaseAdmin
        .from('games')
        .select('commission_amount, ended_at, created_at')
        .eq('status', 'finished')
      if (commissionGamesRes.error) throw commissionGamesRes.error

      const referralStatsRes = await supabaseAdmin
        .from('referrals')
        .select('bonus_amount', { count: 'exact', head: false })
        .eq('status', 'completed')
      if (referralStatsRes.error) throw referralStatsRes.error

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

      // Revenue Overview: last 7 days bars (Mon..Sun labels) derived from deposits
      // Keep it stable/pixel-perfect regardless of current chart grouping.
      const now = new Date()
      const start7 = new Date(now)
      start7.setDate(start7.getDate() - 6)
      start7.setHours(0, 0, 0, 0)

      const dayKeys: string[] = []
      const bars: Record<string, number> = {}
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start7)
        d.setDate(start7.getDate() + i)
        const key = d.toDateString()
        dayKeys.push(key)
        bars[key] = 0
      }

      depositTxsRes.data?.forEach((tx: any) => {
        const dt = new Date(tx.created_at)
        if (dt < start7) return
        const key = dt.toDateString()
        if (!(key in bars)) return
        bars[key] += Number(tx?.amount || 0)
      })

      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const computed = dayKeys.map((key, idx) => ({
        label: labels[idx] || key,
        value: bars[key] || 0,
      }))
      setRevenueOverview(computed)

      depositBonusTxsRes.data?.forEach((tx: any) => {
        const amt = Number(tx?.amount || 0)
        totalRevenueBonus += amt
        if (new Date(tx.created_at).toDateString() === today) {
          todayRevenueBonus += amt
        }
      })

      let totalCommission = 0
      let todayCommission = 0
      commissionGamesRes.data?.forEach((game: any) => {
        const amt = Number(game?.commission_amount || 0)
        if (!amt || Number.isNaN(amt)) return
        totalCommission += amt
        const date = game?.ended_at ? new Date(game.ended_at) : game?.created_at ? new Date(game.created_at) : null
        if (date && date.toDateString() === today) {
          todayCommission += amt
        }
      })

      const firstReferralPage = referralStatsRes.data || []
      const totalReferrals =
        (referralStatsRes.count as number | null) ?? (firstReferralPage.length || 0)

      // Compute total referral earnings across all completed referrals, not just the first 1000 rows
      let totalReferralEarnings = firstReferralPage.reduce(
        (sum: number, row: any) => sum + Number(row?.bonus_amount || 0),
        0
      )

      if (referralStatsRes.count && referralStatsRes.count > firstReferralPage.length) {
        const pageSize = 1000
        let page = 1
        let fetched = firstReferralPage.length
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabaseAdmin
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

            if (data.length < pageSize || fetched >= (referralStatsRes.count || 0)) {
              hasMore = false
            }
          }
        }
      }

      const nextStats = {
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
      }

      setStats(nextStats)
      computeSystemHealth(nextStats)
      computeLiveAlerts(recentTxRes.data || [], nextStats)

      const nowTs = Date.now()
      setLastUpdatedAt(nowTs)

      const bucketDates = generateBucketDates(grouping, normalizedRangeStart, normalizedRangeEnd)
      const bucketKeyToIndex = new Map<string, number>()
      let chartPoints: ChartPoint[] = []
      chartPoints = bucketDates.map((date, idx) => {
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
            .select('created_at, ended_at, status, commission_amount')
            .eq('status', 'finished')
            .gte('created_at', rangeStartIso)
            .lte('created_at', rangeEndIso)
            .order('created_at', { ascending: true }),
        ])

        if (depositChartRes.error) {
          console.error('Deposit chart fetch failed:', depositChartRes.error)
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
          const effectiveDate = game?.ended_at ? new Date(game.ended_at) : new Date(game.created_at)
          const key = alignDateToGrouping(effectiveDate, grouping).toISOString()
          const idx = bucketKeyToIndex.get(key)
          if (idx === undefined) return

          chartPoints[idx].games += 1

          const commission = Number(game?.commission_amount || 0)
          if (commission && !Number.isNaN(commission)) {
            chartPoints[idx].commission += commission
          }
        })
      }

      setChartData(chartPoints)

      try {
        localStorage.setItem(
          'admin_dashboard_cache_v1',
          JSON.stringify({
            stats: nextStats,
            chartData: chartPoints,
            recentTransactions: recentTxRes.data || [],
            pendingDeposits: pendingDepositsRes.count || 0,
            grouping,
            rangeStart: normalizedRangeStart.toISOString(),
            rangeEnd: normalizedRangeEnd.toISOString(),
            lastUpdatedAt: nowTs,
          })
        )
      } catch {
        // ignore cache write errors
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [grouping, rangeEnd, rangeStart])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    try {
      const raw = localStorage.getItem('admin_dashboard_cache_v1')
      if (!raw) return
      const cached = JSON.parse(raw)
      hasHydratedCacheRef.current = true
      if (cached?.stats) setStats(cached.stats)
      if (Array.isArray(cached?.chartData)) setChartData(cached.chartData)
      if (Array.isArray(cached?.recentTransactions)) setRecentTransactions(cached.recentTransactions)
      if (typeof cached?.pendingDeposits === 'number') setPendingDeposits(cached.pendingDeposits)
      if (typeof cached?.lastUpdatedAt === 'number') setLastUpdatedAt(cached.lastUpdatedAt)

      if (cached?.stats) {
        computeSystemHealth(cached.stats)
        computeLiveAlerts(cached.recentTransactions || [], cached.stats)
      }
    } catch {
      // ignore cache read errors
    }
  }, [authLoading, isAuthenticated])

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

  const revenueBars = useMemo(() => chartDataFormatted.slice(-7), [chartDataFormatted])
  const maxRevenue = useMemo(
    () => revenueBars.reduce((m, p) => Math.max(m, Number(p.revenue || 0)), 0),
    [revenueBars]
  )

  const revenueOverviewMax = useMemo(
    () => revenueOverview.reduce((m, p) => Math.max(m, Number(p.value || 0)), 0),
    [revenueOverview]
  )

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
    { href: '/mgmt-portal-x7k9p2', label: 'Dashboard', icon: LayoutGrid, badge: null, permsAny: [] },
    { href: '/mgmt-portal-x7k9p2/users', label: 'Users', icon: Users, badge: null, permsAny: ['users_view', 'users_manage'] },
    { href: '/mgmt-portal-x7k9p2/suspended-users', label: 'Suspended', icon: Ban, badge: null, permsAny: ['users_view', 'users_manage'] },
    { href: '/mgmt-portal-x7k9p2/live-monitor', label: 'Live Monitor', icon: PlayCircle, badge: null, permsAny: ['games_view', 'games_manage'] },
    { href: '/mgmt-portal-x7k9p2/games', label: 'Games', icon: Gamepad2, badge: null, permsAny: ['games_view', 'games_manage'] },
    { href: '/mgmt-portal-x7k9p2/tournaments', label: 'Tournaments', icon: Trophy, badge: null, permsAny: ['tournaments_view', 'tournaments_manage'] },
    { href: '/mgmt-portal-x7k9p2/broadcast', label: 'Broadcast', icon: Megaphone, badge: null, permsAny: ['broadcast_manage'] },
    { href: '/mgmt-portal-x7k9p2/rooms', label: 'Rooms', icon: Home, badge: null, permsAny: ['rooms_view', 'rooms_manage'] },
    { href: '/mgmt-portal-x7k9p2/deposits', label: 'Deposits', icon: ArrowDownToLine, badge: pendingDeposits, permsAny: ['deposits_view', 'deposits_manage'] },
    { href: '/mgmt-portal-x7k9p2/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine, badge: stats.pendingWithdrawals, permsAny: ['withdrawals_view', 'withdrawals_manage'] },
    { href: '/mgmt-portal-x7k9p2/transactions', label: 'Transactions', icon: Receipt, badge: null, permsAny: ['transactions_view'] },
    { href: '/mgmt-portal-x7k9p2/banks', label: 'Banks', icon: Building2, badge: null, permsAny: ['banks_view', 'banks_manage'] },
    { href: '/mgmt-portal-x7k9p2/promos', label: 'Promos', icon: Tag, badge: null, permsAny: ['broadcast_manage'] },
    { href: '/mgmt-portal-x7k9p2/settings', label: 'Settings', icon: Settings, badge: null, permsAny: ['settings_view', 'settings_manage'] },
  ] as const

  const visibleNavItems = navItems.filter(item =>
    item.href === '/mgmt-portal-x7k9p2' || admin?.role === 'super_admin' || item.permsAny.some(k => hasPerm(k))
  )

  const groupedNav = {
    main: visibleNavItems.filter((i) => ['Dashboard', 'Users', 'Suspended'].includes(i.label)),
    operations: visibleNavItems.filter((i) => ['Live Monitor', 'Games', 'Tournaments', 'Broadcast', 'Rooms'].includes(i.label)),
    finance: visibleNavItems.filter((i) => ['Deposits', 'Withdrawals', 'Transactions', 'Banks'].includes(i.label)),
    system: visibleNavItems.filter((i) => ['Promos', 'Settings'].includes(i.label)),
  }

  const notificationCount = (pendingDeposits || 0) + (stats.pendingWithdrawals || 0)

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const IconComponent = item.icon
    const isActive =
      item.href === '/mgmt-portal-x7k9p2'
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + '/')

    return (
      <Link
        key={item.href}
        href={item.href}
        className={
          isActive
            ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#d4af35]/10 text-[#d4af35] transition-colors'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#b6b1a0] hover:bg-white/5 hover:text-white transition-colors'
        }
      >
        <IconComponent className="w-5 h-5" />
        {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
        {!sidebarCollapsed && item.badge !== null && item.badge > 0 && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-white/5 border border-[#333333] text-white">
            {item.badge}
          </span>
        )}
        {sidebarCollapsed && item.badge !== null && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[#252525]">
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="bg-[#1C1C1C] text-white font-sans overflow-hidden h-screen flex">
      <aside
        className={
          (sidebarCollapsed ? 'w-20' : 'w-64') +
          ' sidebar-transition h-full flex flex-col bg-[#252525] border-r border-[#333333] flex-shrink-0 z-20'
        }
      >
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#333333]">
          <div className="w-8 h-8 rounded-full bg-[#1C1C1C] border border-[#d4af35]/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#d4af35]" />
          </div>
          {!sidebarCollapsed && <h1 className="text-white text-lg font-bold tracking-tight truncate">GamingAdmin</h1>}
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupedNav.main.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">Main</p>
                </div>
              )}
              {groupedNav.main.map(renderNavItem)}
            </>
          )}

          {groupedNav.operations.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 mt-4">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">Operations</p>
                </div>
              )}
              {groupedNav.operations.map(renderNavItem)}
            </>
          )}

          {groupedNav.finance.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 mt-4">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">Finance</p>
                </div>
              )}
              {groupedNav.finance.map(renderNavItem)}
            </>
          )}

          {groupedNav.system.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 mt-4">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">System</p>
                </div>
              )}
              {groupedNav.system.map(renderNavItem)}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#333333] space-y-2">
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-[#b6b1a0] hover:text-white transition-all text-sm font-medium"
            type="button"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-[#b6b1a0] hover:text-white transition-all text-sm font-medium"
            type="button"
          >
            <Shield className="w-4 h-4" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="h-16 bg-[#252525] border-b border-[#333333] z-10 flex-shrink-0">
          <div className="h-full max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 -ml-2 text-[#b6b1a0] hover:text-white" type="button">
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-white text-lg font-bold tracking-tight">Dashboard Overview</h2>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-400">System Online</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center relative">
                <Search className="w-4 h-4 absolute left-3 text-[#b6b1a0]" />
                <input
                  className="h-10 pl-10 pr-4 w-72 bg-[#1C1C1C] border border-[#333333] rounded-lg text-sm text-white placeholder-[#b6b1a0] focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] transition-all outline-none"
                  placeholder="Search users, games..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="h-6 w-px bg-[#333333] mx-1" />

              <button
                className="relative p-2 text-[#b6b1a0] hover:text-white transition-colors rounded-lg hover:bg-white/5"
                type="button"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-[#252525]" />
                )}
              </button>

              <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white group-hover:text-[#d4af35] transition-colors">{admin?.username || 'Admin'}</p>
                  <p className="text-xs text-[#b6b1a0]">{admin?.role === 'super_admin' ? 'Super Admin' : (admin?.role || 'Admin')}</p>
                </div>
                <div className="w-10 h-10 rounded-full ring-2 ring-[#333333] group-hover:ring-[#d4af35] transition-all flex items-center justify-center bg-[#1C1C1C] text-[#d4af35] font-bold">
                  {String(admin?.username || '?').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#1C1C1C] p-6 lg:p-10 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="max-w-7xl mx-auto flex flex-col gap-8">
            <div className="flex items-center gap-2 text-sm text-[#b6b1a0]">
              <span className="hover:text-white transition-colors">Home</span>
              <span className="text-[#333333]">/</span>
              <span className="text-[#d4af35] font-medium">Dashboard</span>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-sm hover:border-[#d4af35]/50 transition-all cursor-default group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-[#d4af35]/10 text-[#d4af35] group-hover:bg-[#d4af35] group-hover:text-[#1C1C1C] transition-colors">
                    <ArrowDownToLine className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400">Today</span>
                </div>
                <p className="text-[#b6b1a0] text-sm font-medium mb-1">Total Deposits Today</p>
                <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(stats.todayRevenueReal)}</h3>
              </div>

              <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-sm hover:border-[#d4af35]/50 transition-all cursor-default group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-[#d4af35]/10 text-[#d4af35] group-hover:bg-[#d4af35] group-hover:text-[#1C1C1C] transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-[#333333] text-[#b6b1a0]">All time</span>
                </div>
                <p className="text-[#b6b1a0] text-sm font-medium mb-1">Total Players</p>
                <h3 className="text-2xl font-bold text-white tracking-tight">{stats.totalUsers}</h3>
              </div>

              <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-sm hover:border-[#d4af35]/50 transition-all cursor-default group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-[#d4af35]/10 text-[#d4af35] group-hover:bg-[#d4af35] group-hover:text-[#1C1C1C] transition-colors">
                    <ArrowUpFromLine className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-yellow-500/10 text-yellow-400">Pending</span>
                </div>
                <p className="text-[#b6b1a0] text-sm font-medium mb-1">Pending Withdrawals</p>
                <h3 className="text-2xl font-bold text-white tracking-tight">{stats.pendingWithdrawals}</h3>
              </div>

              <div className="bg-[#252525] rounded-xl p-6 border border-[#333333] shadow-sm hover:border-[#d4af35]/50 transition-all cursor-default group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-[#d4af35]/10 text-[#d4af35] group-hover:bg-[#d4af35] group-hover:text-[#1C1C1C] transition-colors">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-[#333333] text-[#b6b1a0]">Live</span>
                </div>
                <p className="text-[#b6b1a0] text-sm font-medium mb-1">Live Games</p>
                <h3 className="text-2xl font-bold text-white tracking-tight">{stats.activeGames}</h3>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Revenue Overview</h3>
                    <select
                      className="bg-[#1C1C1C] border border-[#333333] text-white text-sm rounded-lg focus:ring-[#d4af35] focus:border-[#d4af35] p-2 outline-none"
                      value={revenueRange}
                      onChange={(e) => setRevenueRange(e.target.value as any)}
                    >
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="year">This Year</option>
                    </select>
                  </div>

                  <div className="h-64 w-full flex items-end justify-between gap-2 px-2 pb-4 border-b border-[#333333]/50">
                    {revenueOverview.map((p, idx) => {
                      const value = Number(p.value || 0)
                      const pct = revenueOverviewMax > 0 ? Math.round((value / revenueOverviewMax) * 95) : 0
                      const isLast = idx === revenueOverview.length - 1
                      return (
                        <div
                          key={`${p.label}_${idx}`}
                          className={
                            (isLast
                              ? 'w-full bg-[#d4af35] rounded-t-sm shadow-[0_0_15px_rgba(212,175,55,0.3)] relative group'
                              : 'w-full bg-[#d4af35]/20 rounded-t-sm hover:bg-[#d4af35]/40 transition-all relative group')
                          }
                          style={{ height: `${Math.max(10, pct)}%` }}
                          title={formatCurrency(value)}
                        >
                          <div
                            className={
                              (isLast
                                ? 'absolute -top-8 left-1/2 -translate-x-1/2 opacity-100 bg-[#252525] border border-[#d4af35] text-xs px-2 py-1 rounded text-[#d4af35] font-bold shadow-xl'
                                : 'absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#252525] border border-[#333333] text-xs px-2 py-1 rounded text-white shadow-xl')
                            }
                          >
                            {formatCurrency(value)}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-between mt-2 text-xs text-[#b6b1a0]">
                    {revenueOverview.map((p, idx) => (
                      <span key={`${p.label}_x_${idx}`} className="truncate">
                        {p.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#252525] rounded-xl border border-[#333333] overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-[#333333] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
                    <Link href="/mgmt-portal-x7k9p2/transactions" className="text-sm text-[#d4af35] hover:text-white transition-colors">
                      View All
                    </Link>
                  </div>
                  <div className="overflow-x-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[#b6b1a0] text-sm border-b border-[#333333] bg-white/5">
                          <th className="px-6 py-4 font-medium">User</th>
                          <th className="px-6 py-4 font-medium">Type</th>
                          <th className="px-6 py-4 font-medium">Amount</th>
                          <th className="px-6 py-4 font-medium">Status</th>
                          <th className="px-6 py-4 font-medium text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {recentTransactions.length === 0 ? (
                          <tr className="border-b border-[#333333]">
                            <td className="px-6 py-6 text-[#b6b1a0]" colSpan={5}>
                              No recent transactions.
                            </td>
                          </tr>
                        ) : (
                          recentTransactions.map((tx: any) => {
                            const status = String(tx?.status || '').toLowerCase()
                            const statusClass =
                              status === 'completed'
                                ? 'bg-green-500/10 text-green-400'
                                : status === 'pending'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : 'bg-red-500/10 text-red-400'

                            const userLabel =
                              tx?.users?.username ||
                              (tx?.users?.telegram_id ? `TG ${tx.users.telegram_id}` : tx?.user_id ? String(tx.user_id).slice(0, 8) : '—')

                            return (
                              <tr key={tx.id} className="border-b border-[#333333] hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-white">{userLabel}</td>
                                <td className="px-6 py-4 text-[#b6b1a0] capitalize">{String(tx?.type || '—')}</td>
                                <td className="px-6 py-4 text-white font-medium">{formatCurrency(Number(tx?.amount || 0))}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
                                    {String(tx?.status || '—')}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-[#b6b1a0] text-right">
                                  {tx?.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-white mb-4">System Health</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#b6b1a0]">Server Load</span>
                        <span className="text-white font-medium">{systemHealth.serverLoad}%</span>
                      </div>
                      <div className="w-full bg-[#1C1C1C] rounded-full h-2">
                        <div className="bg-[#d4af35] h-2 rounded-full" style={{ width: `${systemHealth.serverLoad}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#b6b1a0]">Memory Usage</span>
                        <span className="text-white font-medium">{systemHealth.memoryUsage}%</span>
                      </div>
                      <div className="w-full bg-[#1C1C1C] rounded-full h-2">
                        <div className="bg-[#d4af35] h-2 rounded-full" style={{ width: `${systemHealth.memoryUsage}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#b6b1a0]">Active Connections</span>
                        <span className="text-white font-medium">{systemHealth.activeConnections.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-[#1C1C1C] rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.max(10, systemHealth.memoryUsage)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 shadow-sm flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Live Alerts</h3>
                    <button className="p-1 hover:bg-white/10 rounded transition-colors" type="button">
                      <span className="text-[#b6b1a0]">...</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {liveAlerts.map((a, idx) => {
                      const iconWrapClass =
                        a.type === 'danger'
                          ? 'bg-red-500/20 text-red-500'
                          : a.type === 'info'
                            ? 'bg-[#d4af35]/20 text-[#d4af35]'
                            : 'bg-green-500/20 text-green-500'

                      const iconText = a.type === 'danger' ? '!' : a.type === 'info' ? 'i' : '✓'

                      return (
                        <div key={a.id}>
                          <div className="flex gap-3 items-start">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${iconWrapClass}`}>
                              <span className="text-sm">{iconText}</span>
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{a.title}</p>
                              <p className="text-xs text-[#b6b1a0] mt-1">{a.message}</p>
                              <p className="text-xs text-[#b6b1a0] mt-1 opacity-60">{a.timestamp}</p>
                            </div>
                          </div>
                          {idx < liveAlerts.length - 1 && <div className="w-full h-px bg-[#333333] mt-4" />}
                        </div>
                      )
                    })}
                  </div>

                  <button
                    className="w-full mt-6 py-2 rounded-lg border border-[#333333] text-sm text-[#b6b1a0] hover:text-white hover:bg-white/5 transition-all"
                    type="button"
                  >
                    View Activity Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
