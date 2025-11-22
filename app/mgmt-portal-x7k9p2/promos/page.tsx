"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { formatCurrency } from '@/lib/utils'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'

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

export default function AdminPromosPage() {
  const { admin, loading: adminLoading } = useAdminAuth()

  const [title, setTitle] = useState('Surprise Bonus Promo')
  const [message, setMessage] = useState('You have received a special promo code only for selected players.')

  const [promoAmount, setPromoAmount] = useState('50')
  const [promoTournamentId, setPromoTournamentId] = useState('')
  const [promoMetric, setPromoMetric] = useState<'deposits' | 'plays'>('deposits')
  const [promoRank, setPromoRank] = useState(1)
  const [promoExpiresInDays, setPromoExpiresInDays] = useState(7)

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

  useEffect(() => {
    fetchEstimatedRecipients()
  }, [activeOnly, minBalance, minGames, newUsersSinceDays, dormantDays, selectedUsers])

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
      setEstimatedRecipients(count || 0)
    } catch (e) {
      console.error('Error estimating promo recipients:', e)
    } finally {
      setLoadingRecipients(false)
    }
  }, [activeOnly, minBalance, minGames, newUsersSinceDays, dormantDays, selectedUsers.length])

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
        promo: {
          amount: amountNum,
          tournamentId: promoTournamentId,
          metric: promoMetric,
          rank: promoRank || 1,
          expiresInDays: promoExpiresInDays || 7,
        },
        imageUrl: bannerUrl || null,
      }

      const res = await fetch('/api/admin/promo-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
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
    if (!promoTournamentId) {
      showNotification('error', 'Please select a tournament for this promo')
      return
    }
    if (!amountNum || amountNum <= 0) {
      showNotification('error', 'Please enter a valid promo amount')
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

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        Loading admin session…
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Admin Login Required</h1>
          <p className="text-slate-400 text-sm">Please sign in to manage promos.</p>
        </div>
      </div>
    )
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
          className={`fixed top-4 right-4 px-4 sm:px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top text-sm sm:text-base ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}
        >
          {notification.message}
        </div>
      )}

      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/mgmt-portal-x7k9p2"
              className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Promo Campaigns</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Generate and broadcast single-use promo codes to targeted players.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Estimated recipients</span>
            <span className="text-lg font-bold text-emerald-400">
              {loadingRecipients ? '…' : estimatedRecipients.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:gap-8">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Promo configuration</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60"
                    placeholder="Promo headline shown at the top of message"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2">Tournament Context</label>
                  <select
                    value={promoTournamentId}
                    onChange={(e) => setPromoTournamentId(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60"
                  >
                    <option value="">Select tournament</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.settings?.display_name || t.name || 'Tournament'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-slate-300 text-xs font-medium mb-2">Message body</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm resize-none"
                  placeholder="Write the promo text shown to users. The system will automatically append the promo code line and standard how-to-claim steps (no amount)."
                />
                <p className="mt-1 text-[11px] text-slate-500">{message.length} characters</p>
              </div>

              <div className="mt-4">
                <label className="block text-slate-300 text-xs font-medium mb-2">Promo banner image (optional)</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-slate-300 text-xs font-medium">Banner URL</label>
                    <input
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      placeholder="https://mrayxghardqswonihwjs.supabase.co/storage/v1/object/public/broadcasts/logo.jpg"
                      className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                    />
                    <p className="text-[11px] text-slate-500">
                      Upload your banner manually to the <span className="font-semibold">broadcasts</span> bucket in Supabase, then paste the
                      public URL here (for example the logo URL you shared).
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 flex items-center justify-center min-h-[120px]">
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Promo banner preview" className="max-h-24 object-contain rounded" />
                    ) : (
                      <span className="text-slate-500 text-xs text-center">Banner preview will appear here</span>
                    )}
                  </div>
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setBannerUrl('')
                      }}
                      className="sm:col-span-2 w-full bg-slate-700/50 text-slate-300 py-2 rounded-lg border border-slate-600 text-sm hover:bg-slate-700 transition-colors"
                    >
                      Remove banner
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2">Promo amount (ETB)</label>
                  <input
                    type="number"
                    min={1}
                    value={promoAmount}
                    onChange={(e) => setPromoAmount(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60"
                    placeholder="e.g. 50"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2">Metric tag</label>
                  <select
                    value={promoMetric}
                    onChange={(e) => setPromoMetric(e.target.value as 'deposits' | 'plays')}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60"
                  >
                    <option value="deposits">Top Depositor</option>
                    <option value="plays">Most Played</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2">Rank tag</label>
                  <input
                    type="number"
                    min={1}
                    value={promoRank}
                    onChange={(e) => setPromoRank(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2">Expires in (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={promoExpiresInDays}
                    onChange={(e) => setPromoExpiresInDays(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div className="sm:col-span-2 text-[11px] text-slate-400 flex items-center">
                  Each selected user receives a unique single-use code linked to this tournament. When they claim in the mini app, their real balance is credited automatically.
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4 sm:p-6 lg:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Audience & targeting</h2>

              <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
                <span className="text-slate-500 mr-1">Quick segments:</span>
                <button
                  type="button"
                  onClick={() => applySegment('newcomers')}
                  className="px-3 py-1 rounded-full border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200"
                >
                  Newcomers (7d)
                </button>
                <button
                  type="button"
                  onClick={() => applySegment('highRollers')}
                  className="px-3 py-1 rounded-full border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200"
                >
                  High rollers
                </button>
                <button
                  type="button"
                  onClick={() => applySegment('dormant')}
                  className="px-3 py-1 rounded-full border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200"
                >
                  Dormant users
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                    <div>
                      <p className="text-slate-200 text-sm font-medium">Active users only</p>
                      <p className="text-[11px] text-slate-500">Last active within the past 24 hours.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveOnly((v) => !v)}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                        activeOnly ? 'bg-emerald-600' : 'bg-slate-600'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          activeOnly ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-slate-300 text-xs font-medium">Minimum balance (ETB)</label>
                    <input
                      type="number"
                      value={minBalance}
                      onChange={(e) => setMinBalance(e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                      placeholder="Leave empty for no limit"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-slate-300 text-xs font-medium">Minimum games played</label>
                    <input
                      type="number"
                      value={minGames}
                      onChange={(e) => setMinGames(e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                      placeholder="Leave empty for no limit"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-slate-300 text-xs font-medium">New users (days since registration)</label>
                    <input
                      type="number"
                      value={newUsersSinceDays}
                      onChange={(e) => setNewUsersSinceDays(e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                      placeholder="e.g. 7 for newcomers in last week"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-slate-300 text-xs font-medium">Dormant users (days since last active)</label>
                    <input
                      type="number"
                      value={dormantDays}
                      onChange={(e) => setDormantDays(e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                      placeholder="e.g. 14 for inactive players"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-900/60 rounded-lg border border-slate-700 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-slate-200 text-sm font-medium">Target specific users</p>
                        <p className="text-[11px] text-slate-500">Search by username, phone, or Telegram ID.</p>
                      </div>
                      {selectedUsers.length > 0 && (
                        <span className="px-2 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
                          {selectedUsers.length} selected
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => searchUsers(e.target.value)}
                      placeholder="Search users..."
                      className="w-full bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/60 text-sm"
                    />

                    {searchTerm && (
                      <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800 bg-slate-950/80">
                        {isSearching ? (
                          <div className="p-3 text-xs text-slate-400">Searching…</div>
                        ) : userResults.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400">No users found</div>
                        ) : (
                          userResults.map((user) => {
                            const isSelected = selectedUsers.some((u) => u.id === user.id)
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => toggleUserSelection(user)}
                                className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between hover:bg-slate-800/70 ${
                                  isSelected ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{user.username || 'Unnamed user'}</p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    TG: {user.telegram_id || 'n/a'} · Phone: {user.phone || 'n/a'} · Bal: {formatCurrency(user.balance || 0)}
                                  </p>
                                </div>
                                <span className="text-[11px]">{isSelected ? '✓' : 'Select'}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}

                    {selectedUsers.length > 0 && (
                      <div className="pt-2 mt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <p className="text-slate-400">Selected recipients:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUsers.map((u) => (
                            <span
                              key={u.id}
                              className="px-2 py-1 rounded-full bg-slate-800 border border-slate-600 text-[11px] max-w-[140px] truncate"
                            >
                              {u.username || u.telegram_id || 'User'}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedUsers([])}
                          className="mt-1 text-emerald-300 hover:text-emerald-200"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between bg-slate-900/60 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
                    <div>
                      <p className="font-medium text-slate-200">Estimated recipients</p>
                      <p className="text-[11px] text-slate-500">
                        Based on filters and manual selection.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-400">
                        {loadingRecipients ? '…' : estimatedRecipients.toLocaleString()}
                      </div>
                      {filtersSummary.length > 0 && (
                        <button
                          type="button"
                          className="text-[11px] text-slate-400 hover:text-slate-200"
                          onClick={() => alert(filtersSummary.join('\n'))}
                        >
                          View filters
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-500">
                  Promo messages are delivered via Telegram using unique codes. Users claim them inside the mini app under
                  <span className="font-semibold text-slate-300"> Profile → Claim Promo</span>.
                </p>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleSendPromos}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 border border-emerald-500/80 flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                      <span>Sending promos…</span>
                    </>
                  ) : (
                    <>
                      <span>Send promo campaign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/60 backdrop-blur-md rounded-lg border border-slate-700/60 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-slate-100 mb-2">Telegram message preview</h3>
              <div className="mt-2 bg-[#141414] text-[11px] text-slate-100 rounded-lg border border-yellow-500/40 overflow-hidden">
                {bannerUrl && (
                  <div className="bg-black/80 border-b border-yellow-500/40 flex items-center justify-center">
                    <img src={bannerUrl} alt="Promo banner preview" className="max-h-32 object-contain" />
                  </div>
                )}
                <div className="bg-yellow-500/90 text-slate-900 px-3 py-1.5 flex items-center gap-2 text-xs font-semibold">
                  <span>✅ Promo</span>
                </div>
                <div className="px-3 py-2 space-y-2">
                  <p className="font-semibold">✅ {title || 'Promo'} 🎁</p>
                  {message && <p className="whitespace-pre-line text-slate-200">{message}</p>}
                  <div className="pt-1 space-y-1">
                    <p className="text-slate-100">
                      🎟 Your promo code: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{sampleCode}</span>
                    </p>
                    <p className="text-slate-300 font-semibold mt-1">How to claim:</p>
                    <p>1️⃣ Open the BingoX mini app</p>
                    <p>2️⃣ Go to Profile → Claim Promo</p>
                    <p>3️⃣ Enter your promo code and confirm</p>
                    <p className="text-[10px] text-amber-200 mt-1">
                      🔥 Do not share this code. It works only once and expires in {promoExpiresInDays || 7} day
                      {promoExpiresInDays === 1 ? '' : 's'}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 backdrop-blur-md rounded-lg border border-slate-700/60 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Recent promo campaigns</h3>
              {previousPromos.length === 0 ? (
                <p className="text-xs text-slate-500">No promo campaigns recorded yet.</p>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto text-xs">
                  {previousPromos.map((p) => {
                    const sent = p.sent ?? 0
                    const failed = p.failed ?? 0
                    const total = p.recipients ?? sent + failed
                    const filters = (p.filters || {}) as any
                    const promo = filters.promo || {}
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-50 truncate">{p.title}</p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {new Date(p.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right text-[10px] text-slate-300">
                            <div>
                              Sent: <span className="text-emerald-300 font-semibold">{sent}</span>
                            </div>
                            {failed > 0 && (
                              <div>
                                Failed: <span className="text-rose-300 font-semibold">{failed}</span>
                              </div>
                            )}
                            {total > 0 && (
                              <div className="text-slate-500">Total: {total}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {promo.amount && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
                              {formatCurrency(promo.amount)} ETB
                            </span>
                          )}
                          {promo.metric && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600">
                              {promo.metric === 'deposits' ? 'Top Depositor' : 'Most Played'}
                            </span>
                          )}
                          {promo.expiresInDays && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/40">
                              Expires in {promo.expiresInDays}d
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
