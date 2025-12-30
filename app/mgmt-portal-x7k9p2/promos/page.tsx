"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { formatCurrency } from '@/lib/utils'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { HelpCircle, Bell, Search, Plus, Ticket, Pencil, Ban } from 'lucide-react'
import PromotionsManager from '@/app/mgmt-portal-x7k9p2/promos/promotions-manager'

interface UserResult {
  id: string
  username: string | null
  telegram_id: string | null
  phone: string | null
  balance: number | null
  games_played?: number | null
  created_at?: string | null
}

interface TournamentOption {
  id: string
  name: string | null
  settings: any | null
}

interface BroadcastRecord {
  id: string
  title: string
  message: string
  recipients: number | null
  sent: number | null
  failed: number | null
  filters: any | null
  created_at: string
}

interface PublicPromoRecord {
  id: string
  code: string
  amount: number
  max_uses: number
  used_count: number
  expires_at: string | null
  created_at: string
}

interface ClaimRecord {
  id: string
  code: string
  amount: number
  used_at: string | null
  user_id: string
  username: string | null
  telegram_id: string | null
  phone: string | null
}

function LegacyAdminPromosPage() {
  const { admin, loading: adminLoading } = useAdminAuth()

  const [title, setTitle] = useState('Surprise Bonus Promo')
  const [message, setMessage] = useState('You have received a special promo code only for selected players.')

  const [promoType, setPromoType] = useState<'tournament' | 'generic'>('tournament')
  const [promoAmount, setPromoAmount] = useState('50')
  const [promoTournamentId, setPromoTournamentId] = useState('')
  const [promoMetric, setPromoMetric] = useState<'deposits' | 'plays'>('deposits')
  const [promoRank, setPromoRank] = useState(1)
  const [promoExpiresAmount, setPromoExpiresAmount] = useState(7)
  const [promoExpiresUnit, setPromoExpiresUnit] = useState<'days' | 'hours'>('days')

  const [targetAll, setTargetAll] = useState(true)
  const [activeOnly, setActiveOnly] = useState(true)
  const [minBalance, setMinBalance] = useState('')
  const [minGames, setMinGames] = useState('')
  const [newUsersSinceDays, setNewUsersSinceDays] = useState('')
  const [dormantDays, setDormantDays] = useState('')

  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerUploading, setBannerUploading] = useState(false)

  const [estimatedRecipients, setEstimatedRecipients] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [previousPromos, setPreviousPromos] = useState<BroadcastRecord[]>([])
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [maxRecipients, setMaxRecipients] = useState('')

  const [promoStats, setPromoStats] = useState<
    Record<string, { total: number; used: number; expired: number; active: number }>
  >({})

  const [promoStatusFilter, setPromoStatusFilter] = useState<'all' | 'active' | 'expired' | 'fully_claimed'>(
    'all',
  )

  const [publicAmount, setPublicAmount] = useState('50')
  const [publicMaxUses, setPublicMaxUses] = useState('100')
  const [publicExpiresAmount, setPublicExpiresAmount] = useState(7)
  const [publicExpiresUnit, setPublicExpiresUnit] = useState<'days' | 'hours'>('days')
  const [publicCode, setPublicCode] = useState('')
  const [publicGenerating, setPublicGenerating] = useState(false)
  const [publicPromos, setPublicPromos] = useState<PublicPromoRecord[]>([])
  const [publicStatusFilter, setPublicStatusFilter] = useState<'all' | 'active' | 'expired' | 'fully_claimed'>(
    'all',
  )

  const [promoClaims, setPromoClaims] = useState<Record<string, ClaimRecord[]>>({})
  const [promoClaimsLoading, setPromoClaimsLoading] = useState<Record<string, boolean>>({})

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({
    title: '',
    message: '',
  })

  const [promoSearch, setPromoSearch] = useState('')
  const [promoTab, setPromoTab] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all')
  const [promoSort, setPromoSort] = useState<'newest' | 'highest_value' | 'expiring_soon'>('newest')
  const [showBuilder, setShowBuilder] = useState(false)

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('id, name, settings')
          .order('created_at', { ascending: false })

        if (error) throw error
        setTournaments((data || []) as TournamentOption[])
      } catch (e) {
        console.error('Error loading tournaments for promos:', e)
      }
    }

    const loadPrevious = async () => {
      try {
        const { data, error } = await supabase
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        const typed = (data || []) as BroadcastRecord[]
        const promosOnly = typed.filter((b: any) => (b.filters as any)?.promo)
        setPreviousPromos(promosOnly)
      } catch (e) {
        console.error('Error loading promo broadcasts:', e)
      }
    }

    loadTournaments()
    loadPrevious()
  }, [])

  const loadPublicPromos = useCallback(
    async (status: 'all' | 'active' | 'expired' | 'fully_claimed') => {
      try {
        const res = await fetch('/api/admin/promo/public-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, limit: 20 }),
        })
        const json = await res.json()
        if (res.ok && Array.isArray(json.promos)) {
          setPublicPromos(json.promos as PublicPromoRecord[])
        }
      } catch (e) {
        console.error('Error loading public promos:', e)
      }
    },
    [],
  )

  useEffect(() => {
    void loadPublicPromos(publicStatusFilter)
  }, [publicStatusFilter, loadPublicPromos])

  const generatePublicPromo = useCallback(async () => {
    try {
      setPublicGenerating(true)

      const amountNum = Number(publicAmount || 0)
      const maxUsesNum = Number(publicMaxUses || 0)
      if (!amountNum || amountNum <= 0) {
        showNotification('error', 'Enter a valid public promo amount')
        return
      }
      if (!maxUsesNum || maxUsesNum <= 0) {
        showNotification('error', 'Enter how many players can claim this code')
        return
      }

      const res = await fetch('/api/admin/promo/public-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          maxUses: maxUsesNum,
          expiresAmount: publicExpiresAmount,
          expiresUnit: publicExpiresUnit,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to generate public promo')
      }

      setPublicCode(json.code)
      if (json.promo) {
        setPublicPromos((prev) => [json.promo as PublicPromoRecord, ...prev])
      }
      showNotification('success', 'Public promo code generated')
    } catch (e: any) {
      console.error('Error generating public promo:', e)
      showNotification('error', e?.message || 'Failed to generate public promo')
    } finally {
      setPublicGenerating(false)
    }
  }, [publicAmount, publicMaxUses, publicExpiresAmount, publicExpiresUnit])

  const loadClaimsForBroadcast = useCallback(
    async (broadcastId: string) => {
      if (!broadcastId) return

      // If already loaded, do not refetch
      if (promoClaims[broadcastId] && promoClaims[broadcastId].length > 0) {
        return
      }

      setPromoClaimsLoading((prev) => ({ ...prev, [broadcastId]: true }))
      try {
        const res = await fetch('/api/admin/promo/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broadcastId }),
        })
        const json = await res.json()
        if (res.ok && Array.isArray(json.claims)) {
          setPromoClaims((prev) => ({ ...prev, [broadcastId]: json.claims as ClaimRecord[] }))
        }
      } catch (e) {
        console.error('Error loading promo claims:', e)
      } finally {
        setPromoClaimsLoading((prev) => ({ ...prev, [broadcastId]: false }))
      }
    },
    [promoClaims],
  )

  useEffect(() => {
    fetchEstimatedRecipients()
  }, [activeOnly, minBalance, minGames, newUsersSinceDays, dormantDays, selectedUsers])

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (!previousPromos.length) {
          setPromoStats({})
          return
        }
        const res = await fetch('/api/admin/promo/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broadcastIds: previousPromos.map((p) => p.id) }),
        })
        const json = await res.json()
        if (!res.ok) {
          console.warn('Failed to load promo stats:', json?.error || json)
          return
        }
        setPromoStats(json.stats || {})
      } catch (e) {
        console.warn('Error while loading promo stats:', e)
      }
    }

    loadStats()
  }, [previousPromos])

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4500)
  }

  const handleBannerUpload = useCallback(async (file: File) => {
    try {
      setBannerUploading(true)
      const bucketName = process.env.NEXT_PUBLIC_BROADCAST_BUCKET || process.env.BROADCAST_BUCKET || 'broadcasts'

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `broadcast-${Date.now()}.${fileExt}`
      const filePath = `${bucketName === 'broadcasts' ? '' : 'broadcasts/'}${fileName}`.replace(/^\//, '')

      const storageClient = supabase.storage.from(bucketName)
      const { error: uploadError } = await storageClient.upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

      if (uploadError) {
        console.error('Promo banner upload failed:', uploadError)
        showNotification('error', 'Failed to upload banner image. Please try again.')
        return ''
      }

      const {
        data: { publicUrl },
      } = storageClient.getPublicUrl(filePath)

      setBannerUrl(publicUrl)
      return publicUrl
    } catch (e) {
      console.error('Unexpected promo banner upload error:', e)
      showNotification('error', 'Failed to upload banner image. Please try again.')
      return ''
    } finally {
      setBannerUploading(false)
    }
  }, [])

  const fetchEstimatedRecipients = useCallback(async () => {
    try {
      if (selectedUsers.length > 0) {
        setEstimatedRecipients(selectedUsers.length)
        return
      }
      setLoadingRecipients(true)

      let query = supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('telegram_id', 'is', null)

      if (activeOnly) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gte('updated_at', yesterday.toISOString())
      }

      if (minBalance) {
        query = query.gte('balance', parseFloat(minBalance))
      }

      if (minGames) {
        query = query.gte('games_played', parseInt(minGames))
      }

      if (newUsersSinceDays) {
        const days = parseInt(newUsersSinceDays)
        if (!Number.isNaN(days) && days > 0) {
          const since = new Date()
          since.setDate(since.getDate() - days)
          query = query.gte('created_at', since.toISOString())
        }
      }

      if (dormantDays) {
        const days = parseInt(dormantDays)
        if (!Number.isNaN(days) && days > 0) {
          const since = new Date()
          since.setDate(since.getDate() - days)
          query = query.lt('updated_at', since.toISOString())
        }
      }

      const { count } = await query

      let estimated = count || 0
      const maxNum = parseInt(maxRecipients)
      if (!Number.isNaN(maxNum) && maxNum > 0) {
        estimated = Math.min(estimated, maxNum)
      }

      setEstimatedRecipients(estimated)
    } catch (e) {
      console.error('Error estimating promo recipients:', e)
    } finally {
      setLoadingRecipients(false)
    }
  }, [activeOnly, minBalance, minGames, newUsersSinceDays, dormantDays, selectedUsers.length, maxRecipients])

  const applySegment = (segment: 'newcomers' | 'highRollers' | 'dormant') => {
    setSelectedUsers([])
    setSearchTerm('')
    setUserResults([])

    if (segment === 'newcomers') {
      setActiveOnly(true)
      setNewUsersSinceDays('7')
      setMinBalance('')
      setMinGames('1')
      setDormantDays('')
    } else if (segment === 'highRollers') {
      setActiveOnly(true)
      setNewUsersSinceDays('')
      setMinBalance('500')
      setMinGames('20')
      setDormantDays('')
    } else if (segment === 'dormant') {
      setActiveOnly(false)
      setNewUsersSinceDays('')
      setMinBalance('')
      setMinGames('')
      setDormantDays('14')
    }
  }

  const searchUsers = useCallback(async (term: string) => {
    setSearchTerm(term)
    if (!term || term.trim().length < 2) {
      setUserResults([])
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, telegram_id, phone, balance, games_played, created_at')
        .or(`username.ilike.%${term}%,phone.ilike.%${term}%,telegram_id.ilike.%${term}%`)
        .limit(15)

      if (error) throw error
      const typed = (data || []) as UserResult[]
      const filtered = typed.filter((u) => Boolean(u.telegram_id))
      setUserResults(filtered)
    } catch (e) {
      console.error('Error searching users for promos:', e)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const toggleUserSelection = useCallback((user: UserResult) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id)
      if (exists) return prev.filter((u) => u.id !== user.id)
      return [...prev, user]
    })
  }, [])

  const doSendPromos = async () => {
    if (!admin) return

    const amountNum = Number(promoAmount || 0)

    try {
      setIsSending(true)

      const filters: any = {
        activeOnly,
        minBalance: minBalance ? Number(minBalance) : null,
        minGames: minGames ? parseInt(minGames) : null,
      }
      const days = parseInt(newUsersSinceDays)
      if (!Number.isNaN(days) && days > 0) {
        filters.newUsersSinceDays = days
      }
      const dormant = parseInt(dormantDays)
      if (!Number.isNaN(dormant) && dormant > 0) {
        filters.dormantDays = dormant
      }

      const body: any = {
        title,
        message,
        filters,
        targetUserIds: selectedUsers.length > 0 ? selectedUsers.map((u) => u.id) : null,
        maxRecipients: (() => {
          const n = parseInt(maxRecipients)
          return !Number.isNaN(n) && n > 0 ? n : null
        })(),
        promo: {
          type: promoType,
          amount: amountNum,
          tournamentId: promoTournamentId,
          metric: promoMetric,
          rank: promoRank || 1,
          expiresAmount: promoExpiresAmount || 1,
          expiresUnit: promoExpiresUnit,
          ...(promoExpiresUnit === 'days'
            ? { expiresInDays: promoExpiresAmount || 1 }
            : {}),
        },
        imageUrl: bannerUrl || null,
      }

      const res = await fetch('/api/admin/promo-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to send promos')
      }

      const sentCount = json?.results?.sent ?? 0
      showNotification('success', `Promo sent to ${sentCount} users!`)

      setSelectedUsers([])
      setSearchTerm('')
      setUserResults([])

      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (!error) {
        const typed = (data || []) as BroadcastRecord[]
        const promosOnly = typed.filter((b: any) => (b.filters as any)?.promo)
        setPreviousPromos(promosOnly)
      }
    } catch (e: any) {
      console.error('Error sending promos:', e)
      showNotification('error', e?.message || 'Failed to send promos')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendPromos = () => {
    if (!admin) return

    if (!title.trim() || !message.trim()) {
      showNotification('error', 'Please fill in title and message')
      return
    }

    const amountNum = Number(promoAmount || 0)
    if (!amountNum || amountNum <= 0) {
      showNotification('error', 'Please enter a valid promo amount')
      return
    }

    if (promoType === 'tournament' && !promoTournamentId) {
      showNotification('error', 'Please select a tournament for this tournament promo')
      return
    }

    const approx = estimatedRecipients || 0
    const plural = approx === 1 ? '' : 's'

    setConfirmConfig({
      title: 'Send promo campaign',
      message: approx
        ? `Send promo codes to approximately ${approx.toLocaleString()} user${plural}?`
        : 'No users currently match your filters (0 recipients). Send this promo anyway?',
      confirmLabel: 'Send promo',
      cancelLabel: 'Cancel',
      variant: approx ? 'default' : 'destructive',
      onConfirm: () => {
        void doSendPromos()
      },
    })
    setConfirmOpen(true)
  }

  const sampleCode = 'FRIWIN520'
  const amountText = promoAmount && Number(promoAmount) > 0 ? Number(promoAmount).toFixed(2) : '0.00'

  const filtersSummary: string[] = []
  if (activeOnly) filtersSummary.push('Active in last 24h')
  if (minBalance) filtersSummary.push(`Balance ≥ ${minBalance} ETB`)
  if (minGames) filtersSummary.push(`Games ≥ ${minGames}`)
  if (newUsersSinceDays) filtersSummary.push(`New in last ${newUsersSinceDays} days`)
  if (dormantDays) filtersSummary.push(`Dormant for at least ${dormantDays} days`)
  if (selectedUsers.length > 0) filtersSummary.push(`${selectedUsers.length} user(s) manually selected`)

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        Loading admin session…
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <div className="bg-[#252525] border border-[#333333] rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">403 - Forbidden</h1>
          <p className="text-[#A1A1AA]">You do not have permission to access Promotions.</p>
        </div>
      </div>
    )
  }

  return (
    <AdminShell title="Promotions">
      <div className="min-h-screen bg-[#1C1C1C] text-white">
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
          className={`fixed top-4 right-4 px-4 sm:px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top text-sm sm:text-base border shadow-lg ${
            notification.type === 'success'
              ? 'bg-[#d4af35]/15 text-[#d4af35] border-[#d4af35]/30'
              : 'bg-red-500/20 text-red-300 border-red-500/30'
          }`}
        >
          {notification.message}
        </div>
      )}

      <header className="h-16 flex items-center justify-between border-b border-[#333333] px-6 bg-[#1C1C1C]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] group-focus-within:text-[#d4af35] transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input
              className="w-full bg-[#252525] border border-[#333333] rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] placeholder-[#A1A1AA]/60 transition-all"
              placeholder="Search promotions, ID, or tags..."
              type="text"
              value={promoSearch}
              onChange={(e) => setPromoSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            className="relative p-2 text-[#A1A1AA] hover:text-white transition-colors rounded-lg hover:bg-[#252525]"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#1C1C1C]" />
          </button>
          <button
            type="button"
            className="p-2 text-[#A1A1AA] hover:text-white transition-colors rounded-lg hover:bg-[#252525]"
            title="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#A1A1AA]">Dashboard</span>
            <span className="text-[#A1A1AA]/40">/</span>
            <span className="text-white font-medium">Promotions</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Promotions Management</h2>
              <p className="text-[#A1A1AA] mt-1">Manage active bonuses, wagering requirements, and player incentives.</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] px-5 py-2.5 rounded-lg font-bold transition-all border border-[#d4af35] shadow-[0_0_15px_rgba(212,175,53,0.3)] hover:shadow-[0_0_20px_rgba(212,175,53,0.5)]"
              onClick={() => {
                setShowBuilder(true)
                document.getElementById('promo-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <Plus className="w-5 h-5" />
              Create New Promo
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#252525]/50 p-2 rounded-xl border border-[#333333]">
            <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              {([
                ['all', 'All Promos'],
                ['active', 'Active'],
                ['scheduled', 'Scheduled'],
                ['expired', 'Expired'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPromoTab(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
                    promoTab === key
                      ? 'bg-[#252525] text-white border-[#333333]'
                      : 'text-[#A1A1AA] hover:text-white hover:bg-[#252525] border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center text-[#A1A1AA] text-sm mr-2">Sort by:</div>
              <select
                value={promoSort}
                onChange={(e) => setPromoSort(e.target.value as any)}
                className="bg-[#1C1C1C] border border-[#333333] text-white text-sm rounded-lg focus:ring-[#d4af35] focus:border-[#d4af35] block p-2"
              >
                <option value="newest">Newest First</option>
                <option value="highest_value">Highest Value</option>
                <option value="expiring_soon">Expiring Soon</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {publicPromos
              .filter((p) => {
                const hay = `${p.code} ${p.amount} ${p.created_at}`.toLowerCase()
                const okSearch = promoSearch.trim() ? hay.includes(promoSearch.trim().toLowerCase()) : true
                if (!okSearch) return false

                const expiresAt = p.expires_at ? new Date(p.expires_at) : null
                const now = new Date()
                const isExpired = expiresAt ? expiresAt.getTime() <= now.getTime() : false
                const fullyClaimed = p.used_count >= p.max_uses
                const isActive = !isExpired && !fullyClaimed

                if (promoTab === 'active') return isActive
                if (promoTab === 'expired') return isExpired || fullyClaimed
                if (promoTab === 'scheduled') return false
                return true
              })
              .slice(0, 18)
              .map((p) => {
                const expiresAt = p.expires_at ? new Date(p.expires_at) : null
                const now = new Date()
                const isExpired = expiresAt ? expiresAt.getTime() <= now.getTime() : false
                const fullyClaimed = p.used_count >= p.max_uses
                const statusLabel = fullyClaimed ? 'Disabled' : isExpired ? 'Expired' : 'Active'
                const statusClass = fullyClaimed
                  ? 'bg-gray-700/50 border-gray-600/50 text-gray-300'
                  : isExpired
                  ? 'bg-[#F39C12]/10 border-[#F39C12]/20 text-[#F39C12]'
                  : 'bg-green-500/10 border-green-500/20 text-green-400'

                return (
                  <div
                    key={p.id}
                    className="group bg-[#252525] rounded-lg border border-[#37342a] p-5 flex flex-col gap-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)] hover:border-[#d4af35]/50 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Ticket className="w-24 h-24 text-[#d4af35] -rotate-12 translate-x-4 -translate-y-4" />
                    </div>

                    <div className="flex justify-between items-start z-10">
                      <div className="flex gap-3">
                        <div className="size-10 rounded-full bg-[#1C1C1C] border border-[#37342a] flex items-center justify-center shrink-0">
                          <Ticket className="w-5 h-5 text-[#d4af35]" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg leading-tight">Public Promo</h3>
                          <p className="text-[#b6b1a0] text-xs font-mono mt-0.5">ID: {p.code}</p>
                        </div>
                      </div>

                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="py-2 z-10">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-[#b6b1a0] font-medium">ETB</span>
                        <span className="text-4xl font-bold text-[#d4af35] tracking-tight">{Number(p.amount).toFixed(2)}</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-[#1C1C1C] border border-[#37342a]">
                        <span className="text-[10px] font-semibold text-[#b6b1a0] uppercase tracking-wide">Non-Withdrawable</span>
                      </div>
                    </div>

                    <div className="bg-[#1C1C1C]/50 rounded-lg p-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm border border-[#37342a]/50 z-10">
                      <div className="flex flex-col">
                        <span className="text-[#b6b1a0] text-xs">Uses</span>
                        <span className="text-white font-medium">{p.used_count}/{p.max_uses}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#b6b1a0] text-xs">Created</span>
                        <span className="text-white font-medium">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-col col-span-2 pt-2 border-t border-[#37342a]/50 mt-1">
                        <span className="text-[#b6b1a0] text-xs">Validity</span>
                        <div className="flex items-center gap-1 text-white font-medium">
                          {expiresAt ? `Expires ${expiresAt.toLocaleDateString()}` : 'No Expiry'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 z-10">
                      <span className="text-xs text-[#b6b1a0]">Claims tracked</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="size-9 flex items-center justify-center rounded-lg bg-[#1C1C1C] hover:bg-[#d4af35] hover:text-[#1C1C1C] text-white border border-[#37342a] transition-colors"
                          onClick={() => {
                            setShowBuilder(true)
                            document.getElementById('promo-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="h-9 px-3 flex items-center justify-center rounded-lg bg-[#1C1C1C] text-[#b6b1a0] border border-[#37342a] hover:border-red-500 hover:text-red-400 transition-colors gap-2 text-xs font-bold"
                        >
                          <Ban className="w-4 h-4" />
                          Disable
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>

          <div className="text-xs text-[#A1A1AA]">
            Use the Create New Promo button to generate and send promotions.
          </div>
        </div>
      </div>
              

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Amount (ETB)</label>
                  <input
                    type="number"
                    min={1}
                    value={publicAmount}
                    onChange={(e) => setPublicAmount(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Max players</label>
                  <input
                    type="number"
                    min={1}
                    value={publicMaxUses}
                    onChange={(e) => setPublicMaxUses(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Expires in</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={publicExpiresAmount}
                      onChange={(e) => setPublicExpiresAmount(parseInt(e.target.value) || 1)}
                      className="w-20 bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                    />
                    <select
                      value={publicExpiresUnit}
                      onChange={(e) => setPublicExpiresUnit(e.target.value as 'days' | 'hours')}
                      className="flex-1 bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                    >
                      <option value="days">Days</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void generatePublicPromo()}
                    disabled={publicGenerating}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm shadow-emerald-900/60 transition-colors"
                  >
                    {publicGenerating ? 'Generating…' : 'Generate public promo code'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-700/80 rounded-lg p-3 text-xs text-slate-300 flex items-center justify-between gap-3">
                <div>
                  <div className="text-slate-400 mb-1">Latest generated code</div>
                  <div className="font-mono text-sm text-emerald-300">
                    {publicCode || 'No code generated yet'}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-slate-200 font-semibold">Recent public promos</div>
                  <div className="flex flex-wrap gap-1">
                      {([
                        ['all', 'All'],
                        ['active', 'Active'],
                        ['fully_claimed', 'Fully claimed'],
                        ['expired', 'Expired'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPublicStatusFilter(value)}
                          className={`px-2 py-0.5 rounded-full border text-[10px] transition-colors ${
                            publicStatusFilter === value
                              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/60'
                              : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-emerald-500/60'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {publicPromos.length === 0 ? (
                  <div className="text-[11px] text-slate-500">No public promos for this filter yet.</div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-hide pr-1">
                    {publicPromos.map((p) => {
                      const expiresAt = p.expires_at ? new Date(p.expires_at) : null
                      const now = new Date()
                      const isExpired = expiresAt ? expiresAt.getTime() <= now.getTime() : false
                      const fullyClaimed = p.used_count >= p.max_uses
                      const statusLabel = fullyClaimed
                        ? 'Fully claimed'
                        : isExpired
                        ? 'Expired'
                        : 'Active'
                      const statusClass = fullyClaimed
                        ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/60'
                        : isExpired
                        ? 'bg-amber-500/10 text-amber-200 border-amber-500/60'
                        : 'bg-sky-500/10 text-sky-200 border-sky-500/60'

                      return (
                        <div
                          key={p.id}
                          className="border border-slate-700/80 bg-slate-950/70 rounded-lg px-3 py-2 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-mono text-[11px] text-emerald-300 truncate">{p.code}</div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {new Date(p.created_at).toLocaleString()}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-200 border border-emerald-500/40">
                              {formatCurrency(p.amount)} ETB
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600">
                              Used {p.used_count}/{p.max_uses}
                            </span>
                            {expiresAt && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/40">
                                Expires {expiresAt.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
    </AdminShell>
  )
}

export default function AdminPromosPage() {
  return <PromotionsManager />
}
