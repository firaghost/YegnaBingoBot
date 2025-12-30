"use client"

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { getConfig } from '@/lib/admin-config'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Filter,
  History,
  Mail,
  MoreHorizontal,
  PlayCircle,
  RefreshCcw,
  Save,
  Search,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react'

type TabKey = 'games' | 'transactions' | 'logins'

type DateRangeKey = 'all' | '7d' | '30d' | 'custom'

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

export default function AdminUserDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { admin, loading: adminLoading } = useAdminAuth()

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

  const userId = params?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  const [activeTab, setActiveTab] = useState<TabKey>('games')
  const [detailSearch, setDetailSearch] = useState('')

  const [games, setGames] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [loadingTransactions, setLoadingTransactions] = useState(false)

  const [suspending, setSuspending] = useState(false)

  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustCashFinal, setAdjustCashFinal] = useState('')
  const [adjustBonusFinal, setAdjustBonusFinal] = useState('')
  const [adjustLockedFinal, setAdjustLockedFinal] = useState('')
  const [adjustCashCurrent, setAdjustCashCurrent] = useState(0)
  const [adjustBonusCurrent, setAdjustBonusCurrent] = useState(0)
  const [adjustLockedCurrent, setAdjustLockedCurrent] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)

  const [convertOpen, setConvertOpen] = useState(false)
  const [convertAmount, setConvertAmount] = useState('')
  const [convertReason, setConvertReason] = useState('manual_admin_conversion')
  const [convertLoading, setConvertLoading] = useState(false)

  const [notesDraft, setNotesDraft] = useState('')
  const [savedNotes, setSavedNotes] = useState<string[]>([])

  const [tablePage, setTablePage] = useState(1)
  const tablePageSize = 20

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(String(user?.id || ''))
      showNotification('success', 'Copied user ID')
    } catch {
      showNotification('error', 'Failed to copy')
    }
  }

  const handleRefresh = async () => {
    if (!user?.id) return
    try {
      const { data: fresh, error: freshErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      if (freshErr) throw freshErr
      setUser(fresh)
      setGames([])
      setTransactions([])
      await fetchGames(fresh)
      await fetchTransactions(String(fresh.id))
      showNotification('success', 'Refreshed')
    } catch (e: any) {
      showNotification('error', e?.message || 'Failed to refresh')
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({ title: '', message: '' })

  const [messageOpen, setMessageOpen] = useState(false)
  const [messageTitle, setMessageTitle] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageSending, setMessageSending] = useState(false)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'stake' | 'win' | 'bonus'>('all')
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')

  const [avatarRefreshing, setAvatarRefreshing] = useState(false)

  useEffect(() => {
    if (!userId) return
    let mounted = true

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (userError) throw userError
        if (!mounted) return
        setUser(data)
      } catch (e: any) {
        console.error('Failed to load user:', e)
        if (!mounted) return
        setError(e?.message || 'Failed to load user')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void run()

    return () => {
      mounted = false
    }
  }, [userId])

  useEffect(() => {
    if (!user) return
    if (!admin) return
    if (!user.telegram_id) return

    const currentPhoto =
      (user as any)?.avatar_url ||
      (user as any)?.profile_image_url ||
      (user as any)?.photo_url ||
      null

    if (currentPhoto) return

    let cancelled = false
    const run = async () => {
      try {
        setAvatarRefreshing(true)
        const res = await fetch('/api/admin/users/fetch-telegram-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
          body: JSON.stringify({ userId: user.id }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) return
        if (cancelled) return
        if (json?.photo_url) {
          setUser((prev: any) => (prev ? { ...prev, photo_url: json.photo_url } : prev))
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setAvatarRefreshing(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, admin?.id])

  const wagering = useMemo(() => {
    const required = Number((user as any)?.wager_required || 0)
    const progress = Number((user as any)?.wager_progress || 0)
    if (!required || required <= 0) {
      return { required: 0, progress: 0, percent: 0, remaining: 0, has: false }
    }
    const pct = Math.max(0, Math.min(100, Math.round((progress / required) * 100)))
    return {
      required,
      progress,
      percent: pct,
      remaining: Math.max(0, required - progress),
      has: true,
    }
  }, [user])

  const bonusWins = Number((user as any)?.bonus_win_balance || 0)
  const bonusTotal = Number((user as any)?.bonus_balance || 0) + bonusWins

  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined') return

    const key = `userMgmt_adminNotes_${userId}`
    const raw = localStorage.getItem(key)
    if (!raw) {
      setSavedNotes([])
      return
    }
    try {
      const parsed = JSON.parse(raw)
      setSavedNotes(Array.isArray(parsed) ? parsed : [])
    } catch {
      setSavedNotes([])
    }
  }, [userId])

  const fetchGames = async (u: any) => {
    if (!u) return
    setLoadingGames(true)
    try {
      const uId = String(u.id)
      const tgIdStr = u.telegram_id ? String(u.telegram_id) : null
      const tgIdNum = u.telegram_id ? Number(u.telegram_id) : null
      const uname = u.username ? String(u.username) : null

      const playerKeys = Array.from(
        new Set([
          uId,
          tgIdStr,
          uname,
          tgIdNum !== null && !Number.isNaN(tgIdNum) ? String(tgIdNum) : null,
        ].filter(Boolean))
      ) as string[]

      try {
        const merged: any[] = []
        const seen = new Set<string>()

        for (const key of playerKeys) {
          const { data: gamesData, error: gamesError } = await supabase
            .from('games')
            .select(
              `
              *,
              rooms (
                name,
                color,
                stake,
                game_level
              )
            `
            )
            .contains('players', [key])
            .order('created_at', { ascending: false })
            .limit(1000)

          if (gamesError) continue
          for (const g of gamesData || []) {
            const gid = String((g as any)?.id || '')
            if (!gid || seen.has(gid)) continue
            seen.add(gid)
            merged.push(g)
          }
        }

        if (merged.length > 0) {
          merged.sort((a: any, b: any) => {
            const ta = new Date(a.created_at).getTime()
            const tb = new Date(b.created_at).getTime()
            return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
          })
          setGames(merged)
          return
        }
      } catch (e) {
        console.warn('Direct games.players lookup failed, falling back:', e)
      }

      const { data: txRows, error: txError } = await supabase
        .from('transactions')
        .select('game_id, type')
        .eq('user_id', uId)
        .in('type', ['stake', 'win'])
        .not('game_id', 'is', null)
        .limit(200)

      if (txError) throw txError

      const gameIds = Array.from(
        new Set((txRows || []).map((r: any) => r.game_id).filter((id: any) => !!id))
      ) as string[]

      let gamesQuery = supabase
        .from('games')
        .select(
          `
          *,
          rooms (
            name,
            color,
            stake,
            game_level
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(200)

      if (gameIds.length > 0) {
        gamesQuery = gamesQuery.in('id', gameIds)
      }

      const { data: gamesData, error: gamesError } = await gamesQuery
      if (gamesError) throw gamesError

      const rawGames = (gamesData || []) as any[]
      const filtered = rawGames.filter((g: any) => {
        const players: any[] = Array.isArray(g.players) ? g.players : []
        if (players.length === 0) return false
        return (
          players.includes(uId) ||
          (tgIdStr && players.includes(tgIdStr)) ||
          (tgIdNum !== null && players.includes(tgIdNum)) ||
          (uname && players.includes(uname))
        )
      })

      setGames(filtered)
    } catch (e) {
      console.error('Failed to load games:', e)
      setGames([])
    } finally {
      setLoadingGames(false)
    }
  }

  const fetchTransactions = async (uId: string) => {
    setLoadingTransactions(true)
    try {
      const { data, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', uId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (txError) throw txError

      const { data: withdrawalRows, error: wErr } = await supabase
        .from('withdrawals')
        .select('id, user_id, amount, status, created_at, bank_name, account_number, account_holder')
        .eq('user_id', uId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (wErr) {
        console.warn('Failed to load withdrawals table rows:', wErr)
      }

      const mappedWithdrawals = (withdrawalRows || []).map((w: any) => {
        const rawStatus = String(w.status || 'pending')
        const normalizedStatus =
          rawStatus === 'approved' || rawStatus === 'completed'
            ? 'completed'
            : rawStatus === 'rejected'
              ? 'failed'
              : 'pending'

        return {
          id: `withdrawal_${w.id}`,
          user_id: w.user_id,
          type: 'withdrawal',
          amount: -Number(w.amount || 0),
          status: normalizedStatus,
          created_at: w.created_at,
          description: 'Withdrawal Request',
          metadata: {
            withdrawal_id: w.id,
            bank_name: w.bank_name,
            account_number: w.account_number,
            account_holder: w.account_holder,
            source: 'withdrawals_table',
          },
        }
      })

      const merged = [...(data || []), ...mappedWithdrawals]
        .filter((tx: any) => !!tx && !!tx.id)
        .sort((a: any, b: any) => {
          const ta = new Date(a.created_at).getTime()
          const tb = new Date(b.created_at).getTime()
          return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
        })

      setTransactions(merged)
    } catch (e) {
      console.error('Failed to load transactions:', e)
      setTransactions([])
    } finally {
      setLoadingTransactions(false)
    }
  }

  const report = useMemo(() => {
    const played = games.length
    const won = games.filter((g: any) => String(g.winner_id || '') === String(user?.id || '')).length
    const lost = Math.max(0, played - won)

    const deposits = transactions
      .filter((t: any) => String(t.type || '') === 'deposit' && String(t.status || '') === 'completed')
      .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0)

    const withdrawals = transactions
      .filter((t: any) => String(t.type || '') === 'withdrawal' && String(t.status || '') === 'completed')
      .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0)

    return {
      played,
      won,
      lost,
      deposits,
      withdrawals,
    }
  }, [games, transactions, user?.id])

  useEffect(() => {
    if (!user) return
    if (games.length === 0) {
      void fetchGames(user)
    }
    if (transactions.length === 0) {
      void fetchTransactions(String(user.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id])

  const handleToggleSuspend = async () => {
    if (!user) return
    setSuspending(true)
    try {
      const nextAction = user.status === 'inactive' ? 'unsuspend' : 'suspend'
      const reason = nextAction === 'suspend'
        ? 'Manual suspension from admin User Details page'
        : ''

      const res = await fetch('/api/admin/users/suspension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin?.id || '' },
        body: JSON.stringify({ userId: user.id, action: nextAction, reason }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to update user status')

      const nextStatus = nextAction === 'suspend' ? 'inactive' : 'active'
      setUser((prev: any) => (prev ? { ...prev, status: nextStatus } : prev))
      showNotification('success', nextAction === 'suspend' ? 'User suspended successfully.' : 'User re-activated successfully.')
    } catch (e: any) {
      console.error('Failed to update status:', e)
      showNotification('error', e?.message || 'Failed to update status')
    } finally {
      setSuspending(false)
    }
  }

  const handleAdjustSubmit = async () => {
    if (!user) return
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    const cashFinal = Number(adjustCashFinal)
    const bonusFinal = Number(adjustBonusFinal)
    const lockedFinal = Number(adjustLockedFinal)

    if (Number.isNaN(cashFinal) || Number.isNaN(bonusFinal) || Number.isNaN(lockedFinal)) {
      showNotification('error', 'Please enter valid numeric balances.')
      return
    }

    const deltaCash = cashFinal - adjustCashCurrent
    const deltaBonus = bonusFinal - adjustBonusCurrent
    const deltaLocked = lockedFinal - adjustLockedCurrent

    if (deltaCash === 0 && deltaBonus === 0 && deltaLocked === 0) {
      showNotification('error', 'No changes detected.')
      return
    }

    setAdjustLoading(true)
    try {
      const res = await fetch('/api/admin/wallet/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': admin.id,
        },
        body: JSON.stringify({
          userId: user.id,
          deltaCash,
          deltaBonus,
          deltaLocked,
          reason: adjustReason || 'manual_adjustment',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust balances')
      }
      if (data.user) {
        setUser((prev: any) => (prev && prev.id === data.user.id ? { ...prev, ...data.user } : prev))
      }

      setShowAdjust(false)
      setAdjustCashFinal('')
      setAdjustBonusFinal('')
      setAdjustLockedFinal('')
      setAdjustReason('')
      showNotification('success', 'Balances updated successfully.')
    } catch (e: any) {
      console.error('Adjust balance error:', e)
      showNotification('error', e?.message || 'Failed to adjust balances')
    } finally {
      setAdjustLoading(false)
    }
  }

  const handleConvertBonusWins = async () => {
    if (!user) return
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    const wins = Number((user as any)?.bonus_win_balance || 0)
    if (!wins || wins <= 0) {
      showNotification('error', 'This user has no Bonus Wins to convert.')
      return
    }

    setConvertAmount(String(wins))
    setConvertReason('manual_admin_conversion')
    setConvertOpen(true)
  }

  const doConvertBonusWins = async () => {
    if (!user || !admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    const available = Number((user as any)?.bonus_win_balance || 0)
    const amt = Number(convertAmount)
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      showNotification('error', 'Enter a valid amount')
      return
    }
    if (amt > available) {
      showNotification('error', 'Amount exceeds bonus win balance')
      return
    }

    setConvertLoading(true)
    try {
      const res = await fetch('/api/admin/wallet/convert-bonus-wins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': admin.id,
        },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          reason: convertReason || 'manual_admin_conversion',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to convert Bonus Wins')

      if (data.user) {
        setUser((prev: any) => (prev && prev.id === data.user.id ? { ...prev, ...data.user } : prev))
      }

      showNotification('success', `Converted ${formatCurrency(data.convertedAmount || amt, 'ETB')} Bonus Wins to Cash Wallet.`)
      setConvertOpen(false)

      try {
        const { data: fresh } = await supabase
          .from('users')
          .select('balance, bonus_balance, bonus_win_balance, locked_balance')
          .eq('id', user.id)
          .single()
        if (fresh) {
          setUser((prev: any) => (prev ? { ...prev, ...fresh } : prev))
        }
      } catch {
        // ignore
      }
    } catch (e: any) {
      console.error('Convert bonus wins error:', e)
      showNotification('error', e?.message || 'Failed to convert Bonus Wins')
    } finally {
      setConvertLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!admin) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }
    if (!user?.id) return
    const title = messageTitle.trim() || `Message to ${user.username || user.id}`
    const message = messageBody.trim()
    if (!message) {
      showNotification('error', 'Please enter a message')
      return
    }

    setMessageSending(true)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': admin.id,
        },
        body: JSON.stringify({
          title,
          message,
          targetUserIds: [user.id],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to send message')

      showNotification('success', 'Message sent successfully')
      setMessageOpen(false)
      setMessageTitle('')
      setMessageBody('')
    } catch (e: any) {
      console.error('Send message error:', e)
      showNotification('error', e?.message || 'Failed to send message')
    } finally {
      setMessageSending(false)
    }
  }

  const filteredGames = useMemo(() => {
    if (!detailSearch.trim()) return games
    const q = detailSearch.toLowerCase()
    return games.filter((g: any) => {
      return (
        String(g.id || '').toLowerCase().includes(q) ||
        String(g.status || '').toLowerCase().includes(q) ||
        String(g.rooms?.name || '').toLowerCase().includes(q)
      )
    })
  }, [detailSearch, games])

  const filteredTransactions = useMemo(() => {
    if (!detailSearch.trim()) return transactions
    const q = detailSearch.toLowerCase()
    return transactions.filter((tx: any) => {
      return (
        String(tx.id || '').toLowerCase().includes(q) ||
        String(tx.type || '').toLowerCase().includes(q) ||
        String(tx.status || '').toLowerCase().includes(q)
      )
    })
  }, [detailSearch, transactions])

  const dateFilteredGames = useMemo(() => {
    const now = new Date()
    const rangeFrom = (() => {
      if (dateRange === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (dateRange === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      if (dateRange === 'custom' && dateFrom) return new Date(dateFrom)
      return null
    })()

    const rangeTo = (() => {
      if (dateRange === 'custom' && dateTo) return new Date(dateTo)
      return null
    })()

    return filteredGames.filter((g: any) => {
      const d = new Date(g.created_at)
      if (Number.isNaN(d.getTime())) return false
      if (rangeFrom && d < rangeFrom) return false
      if (rangeTo) {
        const end = new Date(rangeTo)
        end.setHours(23, 59, 59, 999)
        if (d > end) return false
      }
      return true
    })
  }, [filteredGames, dateRange, dateFrom, dateTo])

  const dateFilteredTransactions = useMemo(() => {
    const now = new Date()
    const rangeFrom = (() => {
      if (dateRange === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (dateRange === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      if (dateRange === 'custom' && dateFrom) return new Date(dateFrom)
      return null
    })()

    const rangeTo = (() => {
      if (dateRange === 'custom' && dateTo) return new Date(dateTo)
      return null
    })()

    return filteredTransactions
      .filter((tx: any) => {
        if (txTypeFilter !== 'all' && String(tx.type || '') !== txTypeFilter) return false
        if (txStatusFilter !== 'all' && String(tx.status || '') !== txStatusFilter) return false
        return true
      })
      .filter((tx: any) => {
        const d = new Date(tx.created_at)
        if (Number.isNaN(d.getTime())) return false
        if (rangeFrom && d < rangeFrom) return false
        if (rangeTo) {
          const end = new Date(rangeTo)
          end.setHours(23, 59, 59, 999)
          if (d > end) return false
        }
        return true
      })
  }, [filteredTransactions, dateRange, dateFrom, dateTo, txTypeFilter, txStatusFilter])

  const toCsv = (rows: Array<Record<string, any>>, headers: string[]) => {
    const escape = (v: any) => {
      const s = String(v ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [headers.map(escape).join(',')]
    for (const r of rows) {
      lines.push(headers.map((h) => escape((r as any)[h])).join(','))
    }
    return lines.join('\n')
  }

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownload = () => {
    const reportRows = [
      {
        user_id: user.id,
        username: user.username || '',
        telegram_id: user.telegram_id || '',
        phone: user.phone || '',
        location: locationText,
        real_balance_etb: canViewWallets ? Number(user.balance || 0) : null,
        bonus_balance_etb: canViewWallets ? Number(user.bonus_balance || 0) : null,
        bonus_win_balance_etb: canViewWallets ? Number((user as any)?.bonus_win_balance || 0) : null,
        locked_balance_etb: canViewWallets ? Number(user.locked_balance || 0) : null,
        games_played: report.played,
        wins: report.won,
        losses: report.lost,
        deposits_completed_etb: report.deposits,
        withdrawals_completed_etb: report.withdrawals,
      },
    ]
    const reportCsv = toCsv(reportRows, [
      'user_id',
      'username',
      'phone',
      'location',
      'real_balance_etb',
      'bonus_balance_etb',
      'bonus_win_balance_etb',
      'locked_balance_etb',
      'games_played',
      'wins',
      'losses',
      'deposits_completed_etb',
      'withdrawals_completed_etb',
    ])
    downloadCsv(`user_${user.id}_report.csv`, reportCsv)

    if (activeTab === 'games') {
      const rows = dateFilteredGames.map((g: any) => ({
        game: g.rooms?.name || 'Game',
        game_id: g.id,
        date_time: new Date(g.created_at).toLocaleString(),
        bet_amount_etb: Number(g.stake || g.rooms?.stake || 0),
        status: g.status || '',
      }))
      const csv = toCsv(rows, ['game', 'game_id', 'date_time', 'bet_amount_etb', 'status'])
      downloadCsv(`user_${user.id}_games.csv`, csv)
      showNotification('success', 'Report + CSV downloaded')
      return
    }

    if (activeTab === 'transactions') {
      const rows = dateFilteredTransactions.map((tx: any) => ({
        type: tx.type,
        tx_id: tx.id,
        date_time: new Date(tx.created_at).toLocaleString(),
        amount_etb: Number(tx.amount || 0),
        info: (() => {
          const meta = (tx as any)?.metadata || {}
          const t = String(tx.type || '')
          if (t === 'withdrawal') {
            const bank = String(meta?.bank_name || '')
            const acct = String(meta?.account_number || '')
            return `${bank}${bank && acct ? ' • ' : ''}${acct}` || String(tx.description || '')
          }
          if (t === 'deposit') {
            const method = String(meta?.method || meta?.provider || meta?.payment_method || '')
            return method ? `Method: ${method}` : String(tx.description || '')
          }
          return String(tx.description || '')
        })(),
        status: tx.status,
      }))
      const csv = toCsv(rows, ['type', 'tx_id', 'date_time', 'amount_etb', 'info', 'status'])
      downloadCsv(`user_${user.id}_transactions.csv`, csv)
      showNotification('success', 'Report + CSV downloaded')
      return
    }

    showNotification('success', 'Report downloaded')
  }

  useEffect(() => {
    setTablePage(1)
  }, [activeTab, detailSearch])

  const pagedGames = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize
    return dateFilteredGames.slice(start, start + tablePageSize)
  }, [dateFilteredGames, tablePage, tablePageSize])

  const totalGamePages = useMemo(() => {
    return Math.max(1, Math.ceil(dateFilteredGames.length / tablePageSize))
  }, [dateFilteredGames.length, tablePageSize])

  const pagedTransactions = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize
    return dateFilteredTransactions.slice(start, start + tablePageSize)
  }, [dateFilteredTransactions, tablePage, tablePageSize])

  const totalTxPages = useMemo(() => {
    return Math.max(1, Math.ceil(dateFilteredTransactions.length / tablePageSize))
  }, [dateFilteredTransactions.length, tablePageSize])

  const profileInitial = String(user?.username || 'U').slice(0, 1).toUpperCase()
  const status = String(user?.status || 'active')
  const locationText = (() => {
    const city = user?.last_seen_city || user?.registration_city || ''
    const country = user?.last_seen_country || user?.registration_country || ''
    const joined = [city, country].map((x: any) => String(x || '').trim()).filter(Boolean).join(', ')
    return joined || '—'
  })()

  const profileImageUrl =
    (user as any)?.avatar_url ||
    (user as any)?.profile_image_url ||
    (user as any)?.photo_url ||
    null

  if (loading) {
    return (
      <AdminShell title="User Details">
        <div className="max-w-[1280px] mx-auto">
          <div className="bg-[#252525] border border-[#333333] rounded-xl p-6 text-[#A0A0A0]">
            Loading user...
          </div>
        </div>
      </AdminShell>
    )
  }

  if (error || !user) {
    return (
      <AdminShell title="User Details">
        <div className="max-w-[1280px] mx-auto">
          <div className="bg-[#252525] border border-[#333333] rounded-xl p-6 text-red-300">
            {error || 'User not found'}
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
              onClick={() => router.push('/mgmt-portal-x7k9p2/users')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Users
            </button>
          </div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell title="User Details">
      <AdminConfirmModal
        open={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        cancelLabel={confirmConfig.cancelLabel}
        variant={confirmConfig.variant}
        onConfirm={() => {
          setConfirmOpen(false)
          confirmConfig.onConfirm?.()
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg font-semibold border shadow-xl ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
              : 'bg-red-500/15 text-red-200 border-red-500/30'
          }`}
        >
          {notification.message}
        </div>
      )}

      {convertOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => {
            if (!convertLoading) setConvertOpen(false)
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#252525] border border-[#333333] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#333333] flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Convert Bonus Wins</div>
                <div className="text-xs text-[#A0A0A0]">Available: {canViewWallets ? formatCurrency(Number(bonusWins || 0), 'ETB') : '—'}</div>
              </div>
              <button
                type="button"
                className="text-[#A0A0A0] hover:text-white"
                onClick={() => {
                  if (!convertLoading) setConvertOpen(false)
                }}
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Amount to convert (ETB)</div>
                <input
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Reason</div>
                <input
                  value={convertReason}
                  onChange={(e) => setConvertReason(e.target.value)}
                  className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                  placeholder="manual_admin_conversion"
                />
              </div>
              <div className="text-xs text-[#A0A0A0]">
                This converts from <span className="text-white">Bonus Wins</span> into <span className="text-white">Cash Wallet</span>.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#333333] flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
                disabled={convertLoading}
                onClick={() => setConvertOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[#d4af35] text-black font-semibold hover:bg-[#bfa030] disabled:opacity-60"
                disabled={convertLoading}
                onClick={() => void doConvertBonusWins()}
              >
                {convertLoading ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#252525] border border-[#333333] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#333333] flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Filters</div>
                <div className="text-xs text-[#A0A0A0]">Applies to the active tab</div>
              </div>
              <button type="button" className="text-[#A0A0A0] hover:text-white" onClick={() => setFiltersOpen(false)}>
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Date Range</div>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
                  className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                >
                  <option value="all">All time</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {dateRange === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[#A0A0A0] mb-1">From</div>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[#A0A0A0] mb-1">To</div>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-[#A0A0A0] mb-1">Type</div>
                    <select
                      value={txTypeFilter}
                      onChange={(e) => setTxTypeFilter(e.target.value as any)}
                      className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                    >
                      <option value="all">All</option>
                      <option value="deposit">Deposit</option>
                      <option value="withdrawal">Withdrawal</option>
                      <option value="stake">Stake</option>
                      <option value="win">Win</option>
                      <option value="bonus">Bonus</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-[#A0A0A0] mb-1">Status</div>
                    <select
                      value={txStatusFilter}
                      onChange={(e) => setTxStatusFilter(e.target.value as any)}
                      className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#333333] flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
                onClick={() => {
                  setDateRange('30d')
                  setDateFrom('')
                  setDateTo('')
                  setTxTypeFilter('all')
                  setTxStatusFilter('all')
                  setFiltersOpen(false)
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[#d4af35] text-black font-semibold hover:bg-[#bfa030]"
                onClick={() => setFiltersOpen(false)}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {messageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => {
            if (!messageSending) setMessageOpen(false)
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#252525] border border-[#333333] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#333333] flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Send Message</div>
                <div className="text-xs text-[#A0A0A0]">To @{user.username || 'user'} ({user.telegram_id || 'no telegram id'})</div>
              </div>
              <button
                type="button"
                className="text-[#A0A0A0] hover:text-white"
                onClick={() => {
                  if (!messageSending) setMessageOpen(false)
                }}
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Title</div>
                <input
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  className="w-full rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                  placeholder={`Message to ${user.username || 'user'}`}
                />
              </div>
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Message</div>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full min-h-[120px] rounded-lg bg-[#1A1A1A] border border-white/10 text-white px-3 py-2"
                  placeholder="Type your message..."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#333333] flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
                disabled={messageSending}
                onClick={() => setMessageOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[#d4af35] text-black font-semibold hover:bg-[#bfa030] disabled:opacity-60"
                disabled={messageSending}
                onClick={() => void handleSendMessage()}
              >
                {messageSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="text-[#A0A0A0] hover:text-white transition-colors"
              onClick={() => router.push('/mgmt-portal-x7k9p2/users')}
            >
              Users
            </button>
            <ChevronRight className="w-4 h-4 text-[#444]" />
            <span className="text-white font-medium">User Details</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
              onClick={() => void handleCopyId()}
            >
              <Copy className="w-4 h-4" />
              Copy ID
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
              onClick={() => void handleRefresh()}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#252525] rounded-xl p-6 shadow-lg border border-white/5 flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af35]/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />

            <div className="flex justify-between items-start z-10">
              <div className="flex gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border-2 border-[#3A3A3A] flex items-center justify-center overflow-hidden">
                    {profileImageUrl ? (
                      <Image
                        src={profileImageUrl}
                        alt="User avatar"
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover"
                      />
                    ) : (
                      <span className="text-[#d4af35] font-bold text-xl">{profileInitial}</span>
                    )}
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#252525] ${
                      status === 'inactive' ? 'bg-[#E74C3C]' : 'bg-[#2ECC71]'
                    }`}
                    title={status === 'inactive' ? 'Suspended' : 'Active'}
                  />
                </div>

                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">{user.username || 'Unknown'}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        status === 'inactive'
                          ? 'bg-[#E74C3C]/20 text-[#E74C3C]'
                          : 'bg-[#2ECC71]/20 text-[#2ECC71]'
                      }`}
                    >
                      {status === 'inactive' ? 'Suspended' : 'Active'}
                    </span>
                    {user.vip_level && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#3A3A3A] text-[#A0A0A0] uppercase tracking-wider">
                        VIP Level {user.vip_level}
                      </span>
                    )}
                  </div>
                  {avatarRefreshing && (
                    <div className="absolute -bottom-6 left-0 text-[10px] text-[#A0A0A0]">Fetching Telegram photo…</div>
                  )}
                </div>
              </div>

              <button type="button" className="text-[#A0A0A0] hover:text-white" title="More">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-2 z-10">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-[#A0A0A0]">User ID</span>
                <span className="text-sm font-mono text-white">#{String(user.id).slice(0, 8)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-[#A0A0A0]">Telegram</span>
                <span className="text-sm text-[#d4af35]">@{user.username || '—'}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-[#A0A0A0]">Phone</span>
                <span className="text-sm text-white">{user.phone || '—'}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-[#A0A0A0]">Location</span>
                <span className="text-sm text-white">{locationText}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-[#A0A0A0]">Joined</span>
                <span className="text-sm text-white">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#252525] rounded-xl p-5 border border-white/5 relative overflow-hidden group hover:border-[#d4af35]/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#d4af35]" />
                    <span className="text-sm font-medium text-[#A0A0A0]">Real Balance</span>
                  </div>
                  <span className="text-xs text-[#2ECC71] bg-[#2ECC71]/10 px-1.5 py-0.5 rounded">+0%</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {canViewWallets ? formatCurrency(Number(user.balance || 0), 'ETB') : '—'}
                </div>
                <div className="text-xs text-[#A0A0A0] mt-1">—</div>
              </div>

              <div className="bg-[#252525] rounded-xl p-5 border border-white/5 relative overflow-hidden group hover:border-[#F39C12]/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#F39C12]" />
                    <span className="text-sm font-medium text-[#A0A0A0]">Bonus Balance</span>
                  </div>
                  {wagering.has ? (
                    <span className="text-xs text-[#2ECC71] bg-[#2ECC71]/10 px-1.5 py-0.5 rounded">{wagering.percent}%</span>
                  ) : (
                    <span className="text-xs text-[#2ECC71] bg-[#2ECC71]/10 px-1.5 py-0.5 rounded">0%</span>
                  )}
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {canViewWallets ? formatCurrency(Number(bonusTotal || 0), 'ETB') : '—'}
                </div>
                {wagering.has ? (
                  <>
                    <div className="w-full bg-[#333] h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-[#F39C12] h-full rounded-full" style={{ width: `${wagering.percent}%` }} />
                    </div>
                    <div className="text-xs text-[#A0A0A0] mt-1">
                      {wagering.percent}% Wagering Complete • Remaining {formatCurrency(wagering.remaining, 'ETB')}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-[#A0A0A0] mt-3">
                    {canViewWallets
                      ? `Bonus: ${formatCurrency(Number(user.bonus_balance || 0), 'ETB')} • Bonus Wins: ${formatCurrency(Number(bonusWins || 0), 'ETB')}`
                      : '—'}
                  </div>
                )}
              </div>

              <div className="bg-[#252525] rounded-xl p-5 border border-white/5 relative overflow-hidden group hover:border-white/20 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#A0A0A0]" />
                    <span className="text-sm font-medium text-[#A0A0A0]">Locked</span>
                  </div>
                  <span className="text-xs text-[#E74C3C] bg-[#E74C3C]/10 px-1.5 py-0.5 rounded">-0%</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {canViewWallets ? formatCurrency(Number(user.locked_balance || 0), 'ETB') : '—'}
                </div>
                <div className="text-xs text-[#A0A0A0] mt-1">Pending verification</div>
              </div>
            </div>

            <div className="bg-[#252525] rounded-xl p-5 border border-white/5">
              <h3 className="text-sm font-semibold text-[#A0A0A0] uppercase tracking-wider mb-4">Account Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                    canViewWallets
                      ? 'bg-[#d4af35] text-[#1C1C1C] hover:bg-[#bfa030]'
                      : 'bg-[#333] text-[#A0A0A0] cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (!canViewWallets) {
                      showNotification('error', 'Wallet balances are hidden for your role (support_can_view_wallets is disabled).')
                      return
                    }
                    void (async () => {
                      try {
                        const { data: fresh, error: freshErr } = await supabase
                          .from('users')
                          .select('balance, bonus_balance, locked_balance')
                          .eq('id', user.id)
                          .single()

                        if (!freshErr && fresh) {
                          setUser((prev: any) => (prev ? { ...prev, ...fresh } : prev))
                        }

                        const cash = Number((fresh as any)?.balance ?? user.balance ?? 0)
                        const bonus = Number((fresh as any)?.bonus_balance ?? user.bonus_balance ?? 0)
                        const locked = Number((fresh as any)?.locked_balance ?? user.locked_balance ?? 0)
                        setAdjustCashCurrent(cash)
                        setAdjustBonusCurrent(bonus)
                        setAdjustLockedCurrent(locked)
                        setAdjustCashFinal(String(cash))
                        setAdjustBonusFinal(String(bonus))
                        setAdjustLockedFinal(String(locked))
                        setAdjustReason('')
                        setShowAdjust(true)
                      } catch {
                        const cash = Number(user.balance || 0)
                        const bonus = Number(user.bonus_balance || 0)
                        const locked = Number(user.locked_balance || 0)
                        setAdjustCashCurrent(cash)
                        setAdjustBonusCurrent(bonus)
                        setAdjustLockedCurrent(locked)
                        setAdjustCashFinal(String(cash))
                        setAdjustBonusFinal(String(bonus))
                        setAdjustLockedFinal(String(locked))
                        setAdjustReason('')
                        setShowAdjust(true)
                      }
                    })()
                  }}
                  disabled={!canViewWallets}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Adjust Balance
                </button>

                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#333] text-white text-sm font-medium hover:bg-[#444] border border-white/5 transition-colors"
                  onClick={() => setMessageOpen(true)}
                >
                  <Mail className="w-4 h-4" />
                  Send Message
                </button>

                <button
                  type="button"
                  className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    status === 'inactive'
                      ? 'bg-[#2ECC71]/10 text-[#2ECC71] hover:bg-[#2ECC71]/20 border-[#2ECC71]/20'
                      : 'bg-[#E74C3C]/10 text-[#E74C3C] hover:bg-[#E74C3C]/20 border-[#E74C3C]/20'
                  }`}
                  onClick={handleToggleSuspend}
                  disabled={suspending}
                >
                  <Ban className="w-4 h-4" />
                  {suspending ? 'Updating...' : status === 'inactive' ? 'Reactivate User' : 'Suspend User'}
                </button>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="text-xs text-[#A0A0A0] hover:text-white inline-flex items-center gap-2"
                  onClick={() => {
                    void (async () => {
                      if (adminLoading) {
                        showNotification('error', 'Loading admin session...')
                        return
                      }
                      if (!admin) {
                        showNotification('error', 'Admin session missing. Please log in again.')
                        return
                      }
                      if (!canViewWallets) {
                        showNotification('error', 'Wallet balances are hidden for your role (support_can_view_wallets is disabled).')
                        return
                      }
                      try {
                        const { data: fresh, error: freshErr } = await supabase
                          .from('users')
                          .select('bonus_win_balance')
                          .eq('id', user.id)
                          .single()
                        if (freshErr) throw freshErr

                        const winsNow = Number((fresh as any)?.bonus_win_balance || 0)
                        if (!winsNow || winsNow <= 0) {
                          showNotification('error', 'This user has no Bonus Wins to convert.')
                          return
                        }

                        setUser((prev: any) => (prev ? { ...prev, bonus_win_balance: winsNow } : prev))
                        setConvertAmount(String(winsNow))
                        setConvertReason('manual_admin_conversion')
                        setConvertOpen(true)
                      } catch {
                        await handleConvertBonusWins()
                      }
                    })()
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Convert Bonus Wins
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#252525] rounded-xl p-5 border border-white/5">
          <div className="text-sm font-semibold text-[#A0A0A0] uppercase tracking-wider">User Report</div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-[#A0A0A0]">Games Played</div>
              <div className="text-white text-xl font-bold mt-1">{report.played}</div>
            </div>
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-[#A0A0A0]">Wins / Losses</div>
              <div className="text-white text-xl font-bold mt-1">
                {report.won} / {report.lost}
              </div>
            </div>
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-[#A0A0A0]">Deposits (Completed)</div>
              <div className="text-white text-xl font-bold mt-1">{formatCurrency(report.deposits, 'ETB')}</div>
            </div>
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-[#A0A0A0]">Withdrawals (Completed)</div>
              <div className="text-white text-xl font-bold mt-1">{formatCurrency(report.withdrawals, 'ETB')}</div>
            </div>
          </div>
        </div>

        <div className="bg-[#252525] rounded-xl border border-white/5 flex flex-col overflow-hidden min-h-[400px]">
          <div className="flex border-b border-white/5 px-4 pt-4">
            <button
              type="button"
              onClick={() => setActiveTab('games')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'games'
                  ? 'text-white border-b-2 border-[#d4af35] relative'
                  : 'text-[#A0A0A0] hover:text-white border-b-2 border-transparent hover:border-white/10 transition-colors'
              }`}
            >
              Game History
              {activeTab === 'games' && (
                <span className="absolute top-1 right-0 w-2 h-2 bg-[#d4af35] rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'transactions'
                  ? 'text-white border-b-2 border-[#d4af35]'
                  : 'text-[#A0A0A0] hover:text-white border-b-2 border-transparent hover:border-white/10 transition-colors'
              }`}
            >
              Transactions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logins')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'logins'
                  ? 'text-white border-b-2 border-[#d4af35]'
                  : 'text-[#A0A0A0] hover:text-white border-b-2 border-transparent hover:border-white/10 transition-colors'
              }`}
            >
              Login Logs
            </button>

            <div className="ml-auto flex items-center gap-2 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#A0A0A0]" />
                <input
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="bg-[#1A1A1A] border border-white/10 text-white text-sm rounded-lg block w-64 pl-9 p-2 focus:ring-[#d4af35] focus:border-[#d4af35] placeholder-[#A0A0A0]/50"
                  placeholder="Search logs..."
                  type="text"
                />
              </div>
              <button
                type="button"
                className="p-2 text-[#A0A0A0] hover:text-white rounded-lg hover:bg-[#333]"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 text-[#A0A0A0] hover:text-white rounded-lg hover:bg-[#333]"
                onClick={handleDownload}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            {activeTab === 'games' && (
              <table className="w-full text-left text-sm text-[#A0A0A0]">
                <thead className="bg-[#2A2A2A] text-xs uppercase font-semibold text-[#A0A0A0]">
                  <tr>
                    <th className="px-6 py-4">Game</th>
                    <th className="px-6 py-4">Game ID</th>
                    <th className="px-6 py-4">Date &amp; Time</th>
                    <th className="px-6 py-4">Bet Amount</th>
                    <th className="px-6 py-4">Multiplier</th>
                    <th className="px-6 py-4 text-right">Result</th>
                    <th className="px-6 py-4 text-center">Replay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingGames ? (
                    <tr>
                      <td className="px-6 py-10 text-center" colSpan={7}>
                        Loading...
                      </td>
                    </tr>
                  ) : pagedGames.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center" colSpan={7}>
                        No games found.
                      </td>
                    </tr>
                  ) : (
                    pagedGames.map((g: any) => {
                      const bet = Number(g.stake || g.rooms?.stake || 0)
                      const won = String(g.winner_id || '') === String(user.id)
                      const winAmount = Number(g.net_prize || 0)
                      const result = won ? winAmount : -bet

                      return (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center text-[#d4af35]">
                                <span className="text-xs font-bold">B</span>
                              </div>
                              <span className="text-white font-medium">{g.rooms?.name || 'Game'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">#{String(g.id).slice(0, 8)}</td>
                          <td className="px-6 py-4">{new Date(g.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-white">{formatCurrency(bet, 'ETB')}</td>
                          <td className="px-6 py-4 text-white">--</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`${result >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'} font-bold`}>
                              {result >= 0 ? '+' : '-'}{formatCurrency(Math.abs(result), 'ETB')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              className="text-[#A0A0A0] hover:text-white"
                              onClick={() => router.push(`/mgmt-portal-x7k9p2/games/${g.id}?view=history`)}
                            >
                              <PlayCircle className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'transactions' && (
              <table className="w-full text-left text-sm text-[#A0A0A0]">
                <thead className="bg-[#2A2A2A] text-xs uppercase font-semibold text-[#A0A0A0]">
                  <tr>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Tx ID</th>
                    <th className="px-6 py-4">Date &amp; Time</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Info</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingTransactions ? (
                    <tr>
                      <td className="px-6 py-10 text-center" colSpan={6}>
                        Loading...
                      </td>
                    </tr>
                  ) : pagedTransactions.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center" colSpan={6}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    pagedTransactions.map((tx: any) => {
                      const positive = ['win', 'deposit'].includes(String(tx.type || ''))
                      const amt = Number(tx.amount || 0)
                      const meta = (tx as any)?.metadata || {}
                      const infoText = (() => {
                        const t = String(tx.type || '')
                        if (t === 'withdrawal') {
                          const bank = String(meta?.bank_name || '')
                          const acct = String(meta?.account_number || '')
                          if (bank || acct) return `${bank}${bank && acct ? ' • ' : ''}${acct}`
                          return String(tx.description || 'Withdrawal')
                        }
                        if (t === 'deposit') {
                          const method = String(meta?.method || meta?.provider || meta?.payment_method || '')
                          if (method) return `Method: ${method}`
                          return String(tx.description || '')
                        }
                        return String(tx.description || '')
                      })()
                      return (
                        <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4 text-white font-medium">{String(tx.type || 'tx').toUpperCase()}</td>
                          <td className="px-6 py-4 font-mono text-xs">#{String(tx.id).slice(0, 8)}</td>
                          <td className="px-6 py-4">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`${positive ? 'text-[#2ECC71]' : 'text-[#E74C3C]'} font-bold`}>
                              {positive ? '+' : '-'}{formatCurrency(Math.abs(amt), 'ETB')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-[#A0A0A0] max-w-[280px] truncate" title={infoText}>
                            {infoText || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                String(tx.status || '') === 'completed'
                                  ? 'text-[#2ECC71] bg-[#2ECC71]/10 border-[#2ECC71]/20'
                                  : String(tx.status || '') === 'failed'
                                    ? 'text-[#E74C3C] bg-[#E74C3C]/10 border-[#E74C3C]/20'
                                    : 'text-[#F39C12] bg-[#F39C12]/10 border-[#F39C12]/20'
                              }`}
                            >
                              {String(tx.status || 'pending').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'logins' && (
              <div className="p-6 text-sm text-[#A0A0A0]">Login logs not wired yet.</div>
            )}
          </div>

          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            {activeTab === 'games' ? (
              <div className="text-sm text-[#A0A0A0]">
                Showing <span className="text-white font-medium">{dateFilteredGames.length === 0 ? 0 : (tablePage - 1) * tablePageSize + 1}-
                {Math.min(tablePage * tablePageSize, dateFilteredGames.length)}</span> of{' '}
                <span className="text-white font-medium">{dateFilteredGames.length}</span> results
              </div>
            ) : activeTab === 'transactions' ? (
              <div className="text-sm text-[#A0A0A0]">
                Showing <span className="text-white font-medium">{dateFilteredTransactions.length === 0 ? 0 : (tablePage - 1) * tablePageSize + 1}-
                {Math.min(tablePage * tablePageSize, dateFilteredTransactions.length)}</span> of{' '}
                <span className="text-white font-medium">{dateFilteredTransactions.length}</span> results
              </div>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded bg-[#333] text-[#A0A0A0] hover:text-white disabled:opacity-50 text-sm"
                disabled={tablePage <= 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>

              <button
                type="button"
                className="px-3 py-1 rounded bg-[#d4af35] text-[#1C1C1C] font-medium text-sm"
              >
                {tablePage}
              </button>

              <button
                type="button"
                className="px-3 py-1 rounded bg-[#333] text-[#A0A0A0] hover:text-white disabled:opacity-50 text-sm"
                disabled={
                  activeTab === 'games'
                    ? tablePage >= totalGamePages
                    : activeTab === 'transactions'
                      ? tablePage >= totalTxPages
                      : true
                }
                onClick={() => setTablePage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#252525] rounded-xl border border-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#A0A0A0] text-sm font-semibold uppercase tracking-wider">Admin Notes</span>
          </div>
          <div className="relative">
            <textarea
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-3 text-sm text-white placeholder-[#A0A0A0]/50 focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] resize-none"
              placeholder="Add a private note about this user..."
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
            />
            <button
              type="button"
              className="absolute bottom-3 right-3 bg-[#d4af35] text-[#1C1C1C] text-xs font-bold px-3 py-1.5 rounded hover:bg-[#bfa030] transition-colors"
              onClick={() => {
                const trimmed = notesDraft.trim()
                if (!trimmed) return
                const entry = `${new Date().toLocaleString()} — ${trimmed}`
                const key = `userMgmt_adminNotes_${userId}`
                const next = [...savedNotes, entry]
                setSavedNotes(next)
                setNotesDraft('')
                if (typeof window !== 'undefined') {
                  localStorage.setItem(key, JSON.stringify(next))
                }
              }}
            >
              Save Note
            </button>
          </div>

          {savedNotes.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {savedNotes
                .slice()
                .reverse()
                .slice(0, 6)
                .map((n, idx) => (
                  <div key={`${idx}-${n}`} className="bg-[#333] p-3 rounded-lg border border-white/5 text-sm text-[#A0A0A0]">
                    {n}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {showAdjust && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#252525] border border-[#333333] rounded-2xl p-5">
            <div className="text-white font-semibold text-lg">Adjust Wallet Balances</div>
            <div className="text-xs text-[#A0A0A0] mt-1">Edit the final balances. Requires super admin.</div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Cash (ETB)</div>
                <input
                  value={adjustCashFinal}
                  onChange={(e) => setAdjustCashFinal(e.target.value)}
                  className="w-full rounded-lg bg-[#1C1C1C] border border-[#333333] text-white px-3 py-2"
                  placeholder="0"
                />
                <div className="mt-1 text-[11px] text-[#A0A0A0]">Current: {formatCurrency(adjustCashCurrent, 'ETB')}</div>
              </div>
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Bonus (ETB)</div>
                <input
                  value={adjustBonusFinal}
                  onChange={(e) => setAdjustBonusFinal(e.target.value)}
                  className="w-full rounded-lg bg-[#1C1C1C] border border-[#333333] text-white px-3 py-2"
                  placeholder="0"
                />
                <div className="mt-1 text-[11px] text-[#A0A0A0]">Current: {formatCurrency(adjustBonusCurrent, 'ETB')}</div>
              </div>
              <div>
                <div className="text-xs text-[#A0A0A0] mb-1">Locked (ETB)</div>
                <input
                  value={adjustLockedFinal}
                  onChange={(e) => setAdjustLockedFinal(e.target.value)}
                  className="w-full rounded-lg bg-[#1C1C1C] border border-[#333333] text-white px-3 py-2"
                  placeholder="0"
                />
                <div className="mt-1 text-[11px] text-[#A0A0A0]">Current: {formatCurrency(adjustLockedCurrent, 'ETB')}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs text-[#A0A0A0] mb-1">Reason</div>
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full rounded-lg bg-[#1C1C1C] border border-[#333333] text-white px-3 py-2"
                placeholder="manual_adjustment"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-[#333333] bg-[#1C1C1C] text-white hover:bg-white/5"
                onClick={() => setShowAdjust(false)}
                disabled={adjustLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[#d4af35] text-black font-semibold hover:bg-yellow-400 disabled:opacity-50"
                onClick={handleAdjustSubmit}
                disabled={adjustLoading}
              >
                {adjustLoading ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
