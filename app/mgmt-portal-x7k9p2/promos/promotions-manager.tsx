"use client"

import { useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { Bell, HelpCircle, Search, Plus, Ticket, Pencil, Ban, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type PromoTab = 'all' | 'active' | 'scheduled' | 'expired'

type PromoSort = 'newest' | 'highest_value' | 'expiring_soon'

type PromotionRecord = {
  id: string
  code: string
  name: string
  description: string | null
  promo_type: 'bonus' | 'deposit_match' | 'cashback' | 'reload' | 'free_spins'
  amount: number
  currency: string
  is_non_withdrawable: boolean
  wagering_multiplier: number
  min_deposit: number
  min_bet: number
  vip_tier_min: number | null
  start_at: string | null
  end_at: string | null
  image_url?: string | null
  tags: string[]
  is_enabled: boolean
  created_at: string
}

type UserResult = {
  id: string
  username: string | null
  telegram_id: string | null
  phone: string | null
  balance: number | null
  games_played?: number | null
  updated_at?: string | null
  created_at?: string | null
}

function generatePromoCode(prefix = 'PRM') {
  try {
    const bytes = new Uint8Array(4)
    window.crypto.getRandomValues(bytes)
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let out = ''
    for (let i = 0; i < 6; i++) {
      out += alphabet[bytes[i % bytes.length] % alphabet.length]
    }
    return `${prefix}-${out}`
  } catch {
    const base = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${prefix}-${base}`
  }
}

function statusOf(p: PromotionRecord, now: Date): 'active' | 'scheduled' | 'expired' | 'disabled' {
  if (!p.is_enabled) return 'disabled'
  const s = p.start_at ? new Date(p.start_at).getTime() : null
  const e = p.end_at ? new Date(p.end_at).getTime() : null
  if (s != null && s > now.getTime()) return 'scheduled'
  if (e != null && e <= now.getTime()) return 'expired'
  return 'active'
}

function formatMoney(n: number, currency: string) {
  const num = Number(n || 0)
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PromotionsManager() {
  const { admin, loading: adminLoading } = useAdminAuth()

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4500)
  }

  function openSend(p: PromotionRecord) {
    setSendPromotion(p)
    setSendTitle(p.name)
    setSendMessage(p.description || `You have received a special promotion: ${p.name}`)
    setSendExpiresAmount(7)
    setSendExpiresUnit('days')
    setSendMaxRecipients('')

    setSendImageUrl((p as any)?.image_url || '')
    setSendImageFile(null)

    setActiveOnly(true)
    setMinBalance('')
    setMinGames('')
    setNewUsersSinceDays('')
    setDormantDays('')

    setUserSearchTerm('')
    setUserResults([])
    setSelectedUsers([])

    setSendOpen(true)
  }

  function toggleUser(u: UserResult) {
    setSelectedUsers((prev) => {
      const exists = prev.some((x) => x.id === u.id)
      if (exists) return prev.filter((x) => x.id !== u.id)
      return [...prev, u]
    })
  }

  async function searchUsers(term: string) {
    setUserSearchTerm(term)
    if (!term || term.trim().length < 2) {
      setUserResults([])
      return
    }
    try {
      setSearchingUsers(true)
      const res = await fetch('/api/admin/user-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, limit: 15 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to search users')
      setUserResults(Array.isArray(json.users) ? (json.users as UserResult[]) : [])
    } catch (e: any) {
      console.error('User search error:', e)
      showNotification('error', e?.message || 'Failed to search users')
    } finally {
      setSearchingUsers(false)
    }
  }

  function applySegment(segment: 'all' | 'newcomers' | 'highRollers' | 'dormant') {
    setSelectedUsers([])
    setUserSearchTerm('')
    setUserResults([])

    if (segment === 'all') {
      setActiveOnly(false)
      setNewUsersSinceDays('')
      setMinBalance('')
      setMinGames('')
      setDormantDays('')
      return
    }

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

  async function sendToUsers() {
    if (!sendPromotion) return
    if (!sendTitle.trim() || !sendMessage.trim()) {
      showNotification('error', 'Title and message are required')
      return
    }

    try {
      setSending(true)

      const filters: any = {
        activeOnly,
        minBalance: minBalance ? Number(minBalance) : null,
        minGames: minGames ? parseInt(minGames) : null,
      }
      const days = parseInt(newUsersSinceDays)
      if (!Number.isNaN(days) && days > 0) filters.newUsersSinceDays = days
      const dormant = parseInt(dormantDays)
      if (!Number.isNaN(dormant) && dormant > 0) filters.dormantDays = dormant

      const maxRecipients = (() => {
        const n = parseInt(sendMaxRecipients)
        return !Number.isNaN(n) && n > 0 ? n : null
      })()

      const res = await fetch('/api/admin/promo-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sendTitle,
          message: sendMessage,
          filters,
          targetUserIds: selectedUsers.length > 0 ? selectedUsers.map((u) => u.id) : null,
          maxRecipients,
          imageUrl: sendImageUrl || null,
          promo: {
            type: 'generic',
            amount: Number(sendPromotion.amount || 0),
            metric: 'deposits',
            rank: 1,
            expiresAmount: sendExpiresAmount,
            expiresUnit: sendExpiresUnit,
          },
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || json?.details || 'Failed to send promo')

      const sentCount = json?.results?.sent ?? 0
      showNotification('success', `Promo sent to ${sentCount} users.`)
      setSendOpen(false)
      setSendPromotion(null)
    } catch (e: any) {
      console.error('Send promo error:', e)
      showNotification('error', e?.message || 'Failed to send promo')
    } finally {
      setSending(false)
    }
  }

  const [promoSearch, setPromoSearch] = useState('')
  const [promoTab, setPromoTab] = useState<PromoTab>('all')
  const [promoSort, setPromoSort] = useState<PromoSort>('newest')

  const [loadingPromos, setLoadingPromos] = useState(false)
  const [promotions, setPromotions] = useState<PromotionRecord[]>([])
  const [now, setNow] = useState(() => new Date())

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PromotionRecord | null>(null)
  const [formSaving, setFormSaving] = useState(false)

  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState<PromotionRecord['promo_type']>('bonus')
  const [formAmount, setFormAmount] = useState('0')
  const [formCurrency, setFormCurrency] = useState('ETB')
  const [formNonWithdrawable, setFormNonWithdrawable] = useState(true)
  const [formWagering, setFormWagering] = useState('0')
  const [formMinDeposit, setFormMinDeposit] = useState('0')
  const [formMinBet, setFormMinBet] = useState('0')
  const [formVipTierMin, setFormVipTierMin] = useState('')
  const [formStartAt, setFormStartAt] = useState('')
  const [formEndAt, setFormEndAt] = useState('')
  const [formTags, setFormTags] = useState('')

  const [formImageUrl, setFormImageUrl] = useState<string>('')
  const [formImageFile, setFormImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)

  const [sendOpen, setSendOpen] = useState(false)
  const [sendPromotion, setSendPromotion] = useState<PromotionRecord | null>(null)
  const [sendTitle, setSendTitle] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendExpiresAmount, setSendExpiresAmount] = useState(7)
  const [sendExpiresUnit, setSendExpiresUnit] = useState<'days' | 'hours'>('days')
  const [sendMaxRecipients, setSendMaxRecipients] = useState('')

  const [sendImageUrl, setSendImageUrl] = useState<string>('')
  const [sendImageFile, setSendImageFile] = useState<File | null>(null)
  const [sendImageUploading, setSendImageUploading] = useState(false)

  const [activeOnly, setActiveOnly] = useState(true)
  const [minBalance, setMinBalance] = useState('')
  const [minGames, setMinGames] = useState('')
  const [newUsersSinceDays, setNewUsersSinceDays] = useState('')
  const [dormantDays, setDormantDays] = useState('')

  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [sending, setSending] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({ title: '', message: '' })

  const refreshPromotions = async () => {
    try {
      setLoadingPromos(true)
      const sp = new URLSearchParams({ search: promoSearch, tab: promoTab, sort: promoSort, limit: '100' })
      const res = await fetch(`/api/admin/promotions?${sp.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load promotions')
      setPromotions(Array.isArray(json.promotions) ? (json.promotions as PromotionRecord[]) : [])
    } catch (e: any) {
      console.error('Error loading promotions:', e)
      showNotification('error', e?.message || 'Failed to load promotions')
    } finally {
      setLoadingPromos(false)
    }
  }

  useEffect(() => {
    void refreshPromotions()
  }, [promoSearch, promoTab, promoSort])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const tabCounts = useMemo(() => {
    const c = { all: promotions.length, active: 0, scheduled: 0, expired: 0 }
    for (const p of promotions) {
      const st = statusOf(p, now)
      if (st === 'active') c.active++
      if (st === 'scheduled') c.scheduled++
      if (st === 'expired' || st === 'disabled') c.expired++
    }
    return c
  }, [promotions, now])

  const openCreate = () => {
    setEditing(null)
    setFormCode(generatePromoCode('PRM'))
    setFormName('')
    setFormDescription('')
    setFormType('bonus')
    setFormAmount('0')
    setFormCurrency('ETB')
    setFormNonWithdrawable(true)
    setFormWagering('0')
    setFormMinDeposit('0')
    setFormMinBet('0')
    setFormVipTierMin('')
    setFormStartAt('')
    setFormEndAt('')
    setFormTags('')
    setFormImageUrl('')
    setFormImageFile(null)
    setEditorOpen(true)
  }

  const openEdit = (p: PromotionRecord) => {
    setEditing(p)
    setFormCode(p.code || '')
    setFormName(p.name || '')
    setFormDescription(p.description || '')
    setFormType(p.promo_type)
    setFormAmount(String(p.amount ?? 0))
    setFormCurrency(p.currency || 'ETB')
    setFormNonWithdrawable(Boolean(p.is_non_withdrawable))
    setFormWagering(String(p.wagering_multiplier ?? 0))
    setFormMinDeposit(String(p.min_deposit ?? 0))
    setFormMinBet(String(p.min_bet ?? 0))
    setFormVipTierMin(p.vip_tier_min == null ? '' : String(p.vip_tier_min))
    setFormStartAt(p.start_at ? p.start_at.slice(0, 16) : '')
    setFormEndAt(p.end_at ? p.end_at.slice(0, 16) : '')
    setFormTags(Array.isArray(p.tags) ? p.tags.join(', ') : '')
    setFormImageUrl((p as any)?.image_url || '')
    setFormImageFile(null)
    setEditorOpen(true)
  }

  async function uploadPromoImage(file: File): Promise<string> {
    const bucketName =
      (process.env.NEXT_PUBLIC_BROADCAST_BUCKET as string) ||
      (process.env.BROADCAST_BUCKET as string) ||
      'broadcasts'

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `promo-${Date.now()}.${ext}`
    const filePath = `${bucketName === 'broadcasts' ? '' : 'broadcasts/'}${fileName}`.replace(/^\//, '')

    const storage = (supabase as any).storage?.from(bucketName)
    if (!storage) {
      throw new Error('Supabase storage is not configured')
    }

    const { error: uploadError } = await storage.upload(filePath, file, { cacheControl: '3600', upsert: true })
    if (uploadError) {
      throw uploadError
    }

    const { data } = storage.getPublicUrl(filePath)
    if (!data?.publicUrl) {
      throw new Error('Failed to get public URL')
    }
    return data.publicUrl as string
  }

  async function handleUploadFormImage() {
    if (!formImageFile) {
      showNotification('error', 'Select an image first')
      return
    }
    try {
      setImageUploading(true)
      const url = await uploadPromoImage(formImageFile)
      setFormImageUrl(url)
      showNotification('success', 'Image uploaded')
    } catch (e: any) {
      console.error('Image upload error:', e)
      showNotification('error', e?.message || 'Failed to upload image')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleUploadSendImage() {
    if (!sendImageFile) {
      showNotification('error', 'Select an image first')
      return
    }
    try {
      setSendImageUploading(true)
      const url = await uploadPromoImage(sendImageFile)
      setSendImageUrl(url)
      showNotification('success', 'Image uploaded')
    } catch (e: any) {
      console.error('Send image upload error:', e)
      showNotification('error', e?.message || 'Failed to upload image')
    } finally {
      setSendImageUploading(false)
    }
  }

  const savePromotion = async () => {
    try {
      if (!formCode.trim()) {
        showNotification('error', 'Code is required')
        return
      }
      if (!formName.trim()) {
        showNotification('error', 'Name is required')
        return
      }

      setFormSaving(true)

      const payload: any = {
        code: formCode.trim(),
        name: formName.trim(),
        description: formDescription.trim() ? formDescription.trim() : null,
        promo_type: formType,
        amount: Number(formAmount || 0),
        currency: formCurrency.trim() || 'ETB',
        is_non_withdrawable: Boolean(formNonWithdrawable),
        wagering_multiplier: Number(formWagering || 0),
        min_deposit: Number(formMinDeposit || 0),
        min_bet: Number(formMinBet || 0),
        vip_tier_min: formVipTierMin.trim() ? Number(formVipTierMin) : null,
        start_at: formStartAt ? new Date(formStartAt).toISOString() : null,
        end_at: formEndAt ? new Date(formEndAt).toISOString() : null,
        image_url: formImageUrl ? formImageUrl : null,
        tags: formTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }

      const res = editing
        ? await fetch(`/api/admin/promotions/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/promotions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save promotion')

      setEditorOpen(false)
      setEditing(null)
      showNotification('success', editing ? 'Promotion updated' : 'Promotion created')
      await refreshPromotions()
    } catch (e: any) {
      console.error('Error saving promotion:', e)
      showNotification('error', e?.message || 'Failed to save promotion')
    } finally {
      setFormSaving(false)
    }
  }

  const confirmToggle = (p: PromotionRecord) => {
    const enable = !p.is_enabled
    setConfirmConfig({
      title: enable ? 'Enable promotion' : 'Disable promotion',
      message: enable ? `Enable "${p.name}"?` : `Disable "${p.name}"?`,
      confirmLabel: enable ? 'Enable' : 'Disable',
      cancelLabel: 'Cancel',
      variant: enable ? 'default' : 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const res = await fetch(`/api/admin/promotions/${p.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_enabled: enable }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json?.error || 'Failed to update promotion')
            showNotification('success', enable ? 'Promotion enabled' : 'Promotion disabled')
            await refreshPromotions()
          } catch (e: any) {
            showNotification('error', e?.message || 'Failed to update promotion')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const confirmDelete = (p: PromotionRecord) => {
    setConfirmConfig({
      title: 'Delete promotion',
      message: `Delete "${p.name}" permanently?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const res = await fetch(`/api/admin/promotions/${p.id}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json?.error || 'Failed to delete promotion')
            showNotification('success', 'Promotion deleted')
            await refreshPromotions()
          } catch (e: any) {
            showNotification('error', e?.message || 'Failed to delete promotion')
          }
        })()
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Promotions Management</h2>
                <p className="text-[#A1A1AA] mt-1">Manage active bonuses, wagering requirements, and player incentives.</p>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] px-5 py-2.5 rounded-lg font-bold transition-all border border-[#d4af35] shadow-[0_0_15px_rgba(212,175,53,0.3)] hover:shadow-[0_0_20px_rgba(212,175,53,0.5)]"
                onClick={() => void openCreate()}
              >
                <Plus className="w-5 h-5" />
                Create New Promo
              </button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#252525]/50 p-2 rounded-xl border border-[#333333]">
              <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                {([
                  ['all', 'All Promos'],
                  ['active', `Active${tabCounts.active ? ` (${tabCounts.active})` : ''}`],
                  ['scheduled', `Scheduled${tabCounts.scheduled ? ` (${tabCounts.scheduled})` : ''}`],
                  ['expired', `Expired${tabCounts.expired ? ` (${tabCounts.expired})` : ''}`],
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
                  onChange={(e) => setPromoSort(e.target.value as PromoSort)}
                  className="bg-[#1C1C1C] border border-[#333333] text-white text-sm rounded-lg focus:ring-[#d4af35] focus:border-[#d4af35] block p-2"
                >
                  <option value="newest">Newest First</option>
                  <option value="highest_value">Highest Value</option>
                  <option value="expiring_soon">Expiring Soon</option>
                </select>
              </div>
            </div>

            {loadingPromos ? (
              <div className="text-[#A1A1AA] text-sm">Loading promotions…</div>
            ) : promotions.length === 0 ? (
              <div className="text-[#A1A1AA] text-sm">No promotions found for this filter.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {promotions.map((p) => {
                  const st = statusOf(p, now)
                  const label = st === 'active' ? 'ACTIVE' : st === 'scheduled' ? 'SCHEDULED' : st === 'expired' ? 'EXPIRED' : 'DISABLED'
                  const badge =
                    st === 'active'
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : st === 'scheduled'
                      ? 'bg-sky-500/10 border-sky-500/20 text-sky-300'
                      : st === 'expired'
                      ? 'bg-[#F39C12]/10 border-[#F39C12]/20 text-[#F39C12]'
                      : 'bg-gray-700/50 border-gray-600/50 text-gray-300'

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
                            <h3 className="text-white font-bold text-lg leading-tight">{p.name}</h3>
                            <p className="text-[#b6b1a0] text-xs font-mono mt-0.5">ID: {p.code}</p>
                          </div>
                        </div>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${badge}`}>
                          {label}
                        </span>
                      </div>

                      <div className="py-2 z-10">
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm text-[#b6b1a0] font-medium">{p.currency || 'ETB'}</span>
                          <span className="text-4xl font-bold text-[#d4af35] tracking-tight">{Number(p.amount || 0).toFixed(2)}</span>
                        </div>
                        {p.is_non_withdrawable && (
                          <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-[#1C1C1C] border border-[#37342a]">
                            <span className="text-[10px] font-semibold text-[#b6b1a0] uppercase tracking-wide">Non-Withdrawable</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-[#1C1C1C]/50 rounded-lg p-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm border border-[#37342a]/50 z-10">
                        <div className="flex flex-col">
                          <span className="text-[#b6b1a0] text-xs">Wagering Req</span>
                          <span className="text-white font-medium">{Number(p.wagering_multiplier || 0)}x Bonus</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#b6b1a0] text-xs">Min Deposit</span>
                          <span className="text-white font-medium">{formatMoney(p.min_deposit || 0, p.currency || 'ETB')}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#b6b1a0] text-xs">Min Bet</span>
                          <span className="text-white font-medium">{formatMoney(p.min_bet || 0, p.currency || 'ETB')}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#b6b1a0] text-xs">Validity</span>
                          <span className="text-white font-medium">
                            {p.end_at ? `Expires ${new Date(p.end_at).toLocaleDateString()}` : 'No Expiry'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end mt-auto pt-2 z-10 gap-2">
                        <button
                          type="button"
                          className="h-9 px-3 flex items-center justify-center rounded-lg bg-[#1C1C1C] text-white border border-[#37342a] hover:border-[#d4af35]/60 hover:text-[#d4af35] transition-colors gap-2 text-xs font-bold"
                          onClick={() => openSend(p)}
                          title="Send to users"
                        >
                          <Ticket className="w-4 h-4" />
                          Send
                        </button>
                        <button
                          type="button"
                          className="size-9 flex items-center justify-center rounded-lg bg-[#1C1C1C] hover:bg-[#d4af35] hover:text-[#1C1C1C] text-white border border-[#37342a] transition-colors"
                          onClick={() => void openEdit(p)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="h-9 px-3 flex items-center justify-center rounded-lg bg-[#1C1C1C] text-[#b6b1a0] border border-[#37342a] hover:border-red-500 hover:text-red-400 transition-colors gap-2 text-xs font-bold"
                          onClick={() => confirmToggle(p)}
                        >
                          <Ban className="w-4 h-4" />
                          {p.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="size-9 flex items-center justify-center rounded-lg bg-[#1C1C1C] text-[#b6b1a0] border border-[#37342a] hover:border-red-500 hover:text-red-400 transition-colors"
                          onClick={() => confirmDelete(p)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {editorOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] rounded-xl border border-[#333333] bg-[#252525] shadow-2xl flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[#333333] flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-white font-bold text-lg truncate">{editing ? 'Edit Promotion' : 'Create Promotion'}</div>
                  <div className="text-xs text-[#A1A1AA]">Configure rules, schedule, and visibility.</div>
                </div>
                <button
                  type="button"
                  className="text-[#A1A1AA] hover:text-white text-sm"
                  onClick={() => setEditorOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Code</label>
                  <div className="flex gap-2">
                    <input
                      value={formCode}
                      readOnly
                      className="flex-1 bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                      placeholder="PRM-XXXXXX"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-white hover:border-[#d4af35]/60 transition-colors text-sm"
                      onClick={() => setFormCode(generatePromoCode('PRM'))}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Name</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                    placeholder="VIP Cashback"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Description</label>
                  <input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                    placeholder="Optional short description"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PromotionRecord['promo_type'])}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  >
                    <option value="bonus">Bonus</option>
                    <option value="deposit_match">Deposit Match</option>
                    <option value="cashback">Cashback</option>
                    <option value="reload">Reload</option>
                    <option value="free_spins">Free Spins</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Amount</label>
                  <input
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Currency</label>
                  <input
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-[#A1A1AA] select-none">
                    <input
                      type="checkbox"
                      checked={formNonWithdrawable}
                      onChange={(e) => setFormNonWithdrawable(e.target.checked)}
                      className="accent-[#d4af35]"
                    />
                    Non-withdrawable
                  </label>
                </div>

                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Wagering Multiplier</label>
                  <input
                    value={formWagering}
                    onChange={(e) => setFormWagering(e.target.value)}
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">VIP Tier Min</label>
                  <input
                    value={formVipTierMin}
                    onChange={(e) => setFormVipTierMin(e.target.value)}
                    type="number"
                    min={0}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                    placeholder="(optional)"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Min Deposit</label>
                  <input
                    value={formMinDeposit}
                    onChange={(e) => setFormMinDeposit(e.target.value)}
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Min Bet</label>
                  <input
                    value={formMinBet}
                    onChange={(e) => setFormMinBet(e.target.value)}
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Start At (optional)</label>
                  <input
                    value={formStartAt}
                    onChange={(e) => setFormStartAt(e.target.value)}
                    type="datetime-local"
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">End At (optional)</label>
                  <input
                    value={formEndAt}
                    onChange={(e) => setFormEndAt(e.target.value)}
                    type="datetime-local"
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                    placeholder="vip, weekend, reload"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Promo card image (optional)</label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFormImageFile(e.target.files?.[0] || null)}
                        className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-white hover:border-[#d4af35]/60 transition-colors text-sm disabled:opacity-60"
                          onClick={() => void handleUploadFormImage()}
                          disabled={imageUploading || !formImageFile}
                        >
                          {imageUploading ? 'Uploading…' : 'Upload image'}
                        </button>
                        {formImageUrl && (
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white transition-colors text-sm"
                            onClick={() => setFormImageUrl('')}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-full md:w-56">
                      <div className="w-full aspect-[16/9] rounded-lg border border-[#333333] bg-[#1C1C1C] overflow-hidden flex items-center justify-center">
                        {formImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={formImageUrl} alt="Promo card" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-xs text-[#A1A1AA]">No image</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-[#333333] flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white hover:border-[#d4af35]/50 transition-colors"
                  onClick={() => setEditorOpen(false)}
                  disabled={formSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] font-bold border border-[#d4af35] transition-colors disabled:opacity-60"
                  onClick={() => void savePromotion()}
                  disabled={formSaving}
                >
                  {formSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {sendOpen && sendPromotion && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] rounded-xl border border-[#333333] bg-[#252525] shadow-2xl flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[#333333] flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-white font-bold text-lg truncate">Send Promo</div>
                  <div className="text-xs text-[#A1A1AA] truncate">{sendPromotion.name} ({sendPromotion.code})</div>
                </div>
                <button
                  type="button"
                  className="text-[#A1A1AA] hover:text-white text-sm"
                  onClick={() => setSendOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
                <div className="md:col-span-2">
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Title</label>
                  <input
                    value={sendTitle}
                    onChange={(e) => setSendTitle(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Message</label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    rows={4}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Expires in</label>
                  <div className="flex gap-2">
                    <input
                      value={sendExpiresAmount}
                      onChange={(e) => setSendExpiresAmount(parseInt(e.target.value) || 1)}
                      type="number"
                      min={1}
                      className="w-24 bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                    />
                    <select
                      value={sendExpiresUnit}
                      onChange={(e) => setSendExpiresUnit(e.target.value as any)}
                      className="flex-1 bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                    >
                      <option value="days">Days</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Max recipients (optional)</label>
                  <input
                    value={sendMaxRecipients}
                    onChange={(e) => setSendMaxRecipients(e.target.value)}
                    type="number"
                    min={1}
                    className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-sm font-semibold text-white mb-2">Recipients</div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white"
                      onClick={() => applySegment('all')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white"
                      onClick={() => applySegment('newcomers')}
                    >
                      New users
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white"
                      onClick={() => applySegment('highRollers')}
                    >
                      High rollers
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white"
                      onClick={() => applySegment('dormant')}
                    >
                      Dormant
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <label className="flex items-center gap-2 text-sm text-[#A1A1AA] select-none">
                      <input
                        type="checkbox"
                        checked={activeOnly}
                        onChange={(e) => setActiveOnly(e.target.checked)}
                        className="accent-[#d4af35]"
                      />
                      Active in last 24h
                    </label>
                    <div />

                    <div>
                      <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Min balance</label>
                      <input
                        value={minBalance}
                        onChange={(e) => setMinBalance(e.target.value)}
                        type="number"
                        min={0}
                        className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Min games</label>
                      <input
                        value={minGames}
                        onChange={(e) => setMinGames(e.target.value)}
                        type="number"
                        min={0}
                        className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#A1A1AA] text-xs font-medium mb-1">New users since (days)</label>
                      <input
                        value={newUsersSinceDays}
                        onChange={(e) => setNewUsersSinceDays(e.target.value)}
                        type="number"
                        min={0}
                        className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#A1A1AA] text-xs font-medium mb-1">Dormant days</label>
                      <input
                        value={dormantDays}
                        onChange={(e) => setDormantDays(e.target.value)}
                        type="number"
                        min={0}
                        className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-white mb-2">Manual selection (optional)</div>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={userSearchTerm}
                      onChange={(e) => {
                        const v = e.target.value
                        void searchUsers(v)
                      }}
                      className="flex-1 bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Search username, phone, or telegram id"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-white"
                      onClick={() => void searchUsers(userSearchTerm)}
                    >
                      {searchingUsers ? 'Searching…' : 'Search'}
                    </button>
                  </div>

                  {userResults.length > 0 && (
                    <div className="border border-[#333333] rounded-lg overflow-hidden mb-3">
                      {userResults.map((u) => {
                        const selected = selectedUsers.some((x) => x.id === u.id)
                        return (
                          <button
                            key={u.id}
                            type="button"
                            className={`w-full px-3 py-2 flex items-center justify-between text-left text-sm border-b border-[#333333] last:border-b-0 ${
                              selected ? 'bg-[#d4af35]/10' : 'bg-[#1C1C1C]'
                            }`}
                            onClick={() => toggleUser(u)}
                          >
                            <div className="min-w-0">
                              <div className="text-white truncate">{u.username || u.phone || u.telegram_id || u.id}</div>
                              <div className="text-xs text-[#A1A1AA] truncate">Balance: {u.balance ?? 0} | Games: {u.games_played ?? 0}</div>
                            </div>
                            <div className={`text-xs font-semibold ${selected ? 'text-[#d4af35]' : 'text-[#A1A1AA]'}`}>{selected ? 'Selected' : 'Select'}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {selectedUsers.length > 0 && (
                    <div className="text-xs text-[#A1A1AA]">Selected: {selectedUsers.length} users (manual overrides filters)</div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className="text-sm font-semibold text-white mb-2">Promo card image (optional)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSendImageFile(e.target.files?.[0] || null)}
                        className="w-full bg-[#1C1C1C] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-white hover:border-[#d4af35]/60 transition-colors text-sm disabled:opacity-60"
                          onClick={() => void handleUploadSendImage()}
                          disabled={sendImageUploading || !sendImageFile}
                        >
                          {sendImageUploading ? 'Uploading…' : 'Upload / Override image'}
                        </button>
                        {sendImageUrl && (
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white transition-colors text-sm"
                            onClick={() => setSendImageUrl('')}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-[#A1A1AA] mt-2">
                        If set, this image will be sent as a photo with the promo caption.
                      </div>
                    </div>
                    <div>
                      <div className="w-full aspect-[16/9] rounded-lg border border-[#333333] bg-[#1C1C1C] overflow-hidden flex items-center justify-center">
                        {sendImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sendImageUrl} alt="Promo card" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-xs text-[#A1A1AA]">No image</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-[#333333] flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#333333] text-[#A1A1AA] hover:text-white hover:border-[#d4af35]/50 transition-colors"
                  onClick={() => setSendOpen(false)}
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] font-bold border border-[#d4af35] transition-colors disabled:opacity-60"
                  onClick={() => void sendToUsers()}
                  disabled={sending}
                >
                  {sending ? 'Sending…' : 'Send promo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
