"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'

interface UserResult {
  id: string
  username: string | null
  telegram_id: string | null
  phone: string | null
  balance: number | null
}

export default function AdminBroadcast() {
  const bucketName = process.env.NEXT_PUBLIC_BROADCAST_BUCKET || process.env.BROADCAST_BUCKET || 'broadcasts'
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [channelLink] = useState(process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/BingoXofficial')
  const [botLink] = useState(process.env.NEXT_PUBLIC_BOT_LINK || (process.env.MINI_APP_URL ? `${process.env.MINI_APP_URL}` : 'https://t.me/BingoXOfficialBot'))
  const [targetAll, setTargetAll] = useState(true)
  const [activeOnly, setActiveOnly] = useState(false)
  const [minBalance, setMinBalance] = useState('')
  const [minGames, setMinGames] = useState('')
  const [newUsersSinceDays, setNewUsersSinceDays] = useState('')
  const [dormantDays, setDormantDays] = useState('')
  const [estimatedRecipients, setEstimatedRecipients] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [previousBroadcasts, setPreviousBroadcasts] = useState<any[]>([])
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [loading, setLoading] = useState(true)
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
  }>({ title: '', message: '' })

  useEffect(() => {
    fetchEstimatedRecipients()
    fetchPreviousBroadcasts()
  }, [targetAll, activeOnly, minBalance, minGames, newUsersSinceDays, dormantDays, selectedUsers])

  const fetchEstimatedRecipients = async () => {
    try {
      if (selectedUsers.length > 0) {
        setEstimatedRecipients(selectedUsers.length)
        return
      }
      let query = supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('telegram_id', 'is', null)

      if (targetAll) {
        const { count } = await query
        setEstimatedRecipients(count || 0)
        return
      }

      if (activeOnly) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gte('updated_at', yesterday.toISOString())
      }

      if (minBalance) {
        query = query.gte('balance', parseInt(minBalance))
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
    } catch (error) {
      console.error('Error fetching recipients:', error)
    }
  }

  const fetchPreviousBroadcasts = async () => {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
      setPreviousBroadcasts(data || [])
    } catch (error) {
      console.error('Error fetching broadcasts:', error)
    } finally {
      setLoading(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const composeMessageWithLinks = useCallback(() => {
    const baseMessage = message.trim()
    const parts = [
      baseMessage,
      '',
      `📢 Stay updated: ${channelLink}`,
      `🤖 Play with us: ${botLink}`
    ]
      .map(part => part.trim())
      .filter(Boolean)

    return parts.join('\n')
  }, [message, channelLink, botLink])

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
        .select('id, username, telegram_id, phone, balance')
        .or(`username.ilike.%${term}%,phone.ilike.%${term}%,telegram_id.ilike.%${term}%`)
        .limit(10)

      if (error) throw error
      const typedData = (data || []) as UserResult[]
      const filtered = typedData.filter((user: UserResult) => Boolean(user.telegram_id))
      setUserResults(filtered)
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const toggleUserSelection = useCallback((user: UserResult) => {
    setSelectedUsers(prev => {
      const exists = prev.some(u => u.id === user.id)
      if (exists) {
        return prev.filter(u => u.id !== user.id)
      }
      return [...prev, user]
    })
  }, [])

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

  const doSendBroadcast = async () => {
    if (!title || !message) {
      showNotification('error', 'Please fill in title and message')
      return
    }

    const adminId = localStorage.getItem('admin_id')
    if (!adminId) {
      showNotification('error', 'Admin session missing. Please log in again.')
      return
    }

    setIsSending(true)
    try {
      let finalImageUrl = imageUrl.trim()

      if (imageFile) {
        setImageUploading(true)
        finalImageUrl = await handleImageUpload(imageFile)
        setImageUploading(false)
        if (!finalImageUrl) {
          setIsSending(false)
          return
        }
      }

      const formattedMessage = composeMessageWithLinks()

      const effectiveTargetUserIds = selectedUsers.length > 0 ? selectedUsers.map((user) => user.id) : null
      const effectiveFilters = targetAll && !effectiveTargetUserIds
        ? null
        : {
            activeOnly,
            minBalance: minBalance ? parseInt(minBalance) : null,
            minGames: minGames ? parseInt(minGames) : null,
            newUsersSinceDays: newUsersSinceDays ? parseInt(newUsersSinceDays) : null,
            dormantDays: dormantDays ? parseInt(dormantDays) : null,
          }

      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message: formattedMessage,
          filters: effectiveFilters,
          targetUserIds: effectiveTargetUserIds,
          imageUrl: finalImageUrl || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send broadcast')
      }

      showNotification('success', `Broadcast sent to ${data.results.sent} users!`)
      setTitle('')
      setMessage('')
      setImageUrl('')
      setImageFile(null)
      setSearchTerm('')
      setUserResults([])
      setSelectedUsers([])
      fetchPreviousBroadcasts()
    } catch (error: any) {
      console.error('Error sending broadcast:', error)
      showNotification('error', error.message || 'Failed to send broadcast')
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = () => {
    if (!title || !message) {
      showNotification('error', 'Please fill in title and message')
      return
    }

    const approx = estimatedRecipients || 0
    const plural = approx === 1 ? '' : 's'

    setConfirmConfig({
      title: 'Send broadcast',
      message: approx
        ? `Send broadcast to approximately ${approx.toLocaleString()} user${plural}?`
        : 'No users currently match your filters (0 recipients). Send this broadcast anyway?',
      confirmLabel: 'Send broadcast',
      cancelLabel: 'Cancel',
      variant: approx ? 'default' : 'destructive',
      onConfirm: () => {
        void doSendBroadcast()
      },
    })
    setConfirmOpen(true)
  }

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      setImageUploading(true)
      const adminId = localStorage.getItem('admin_id')
      if (!adminId) {
        showNotification('error', 'Admin session missing. Please log in again.')
        return ''
      }

      const form = new FormData()
      form.append('file', file)
      form.append('bucket', bucketName)

      const res = await fetch('/api/admin/broadcast-upload', {
        method: 'POST',
        headers: { 'x-admin-id': adminId },
        body: form,
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to upload image')

      const publicUrl = String(json?.url || '')
      if (!publicUrl) throw new Error('Upload succeeded but no URL returned')

      setImageUrl(publicUrl)
      return publicUrl
    } catch (error: any) {
      console.error('Unexpected upload error:', error)
      showNotification('error', error?.message || 'Failed to upload image. Please try again.')
      return ''
    } finally {
      setImageUploading(false)
    }
  }, [bucketName])

  return (
    <AdminShell title="Broadcast">
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
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 sm:px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top text-sm sm:text-base ${
          notification.type === 'success'
            ? 'bg-[#d4af35]/15 text-[#d4af35] border border-[#d4af35]/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumbs */}
        <div className="flex gap-2 items-center text-sm mb-6">
          <Link className="text-[#A0A0A0] hover:text-white transition-colors" href="/mgmt-portal-x7k9p2">
            Dashboard
          </Link>
          <span className="text-[#555]">/</span>
          <span className="text-white font-medium">Broadcasts</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-white text-3xl font-bold leading-tight mb-2">New Broadcast</h1>
            <p className="text-[#A0A0A0] text-base">Create and schedule announcements for your players.</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="hidden sm:flex flex-col items-end text-right text-xs text-[#A0A0A0]">
              <span className="font-semibold text-white">Estimated recipients</span>
              <span className="text-lg font-bold text-[#d4af35]">{estimatedRecipients.toLocaleString()}</span>
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-[#252525] hover:bg-[#333] border border-[#333] rounded-lg text-white text-sm font-semibold transition-colors"
              onClick={fetchPreviousBroadcasts}
            >
              View Logs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Compose Form */}
          <div className="xl:col-span-7 flex flex-col gap-6">
            <div className="bg-[#252525] p-6 rounded-xl border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-6 border-b border-[#333333] pb-4">
                <span className="text-[#d4af35] text-lg font-bold">✎</span>
                <h3 className="text-lg font-bold text-white">Compose Message</h3>
              </div>
              
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-[#A0A0A0] text-sm font-medium mb-2">Broadcast Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Weekend Mega Tournament!"
                    className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-3 sm:px-4 py-3 rounded-lg focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] transition-colors text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[#A0A0A0] text-sm font-medium">Target Audience</label>
                    <div className="relative">
                      <select
                        className="bg-[#1C1C1C] border border-[#333333] text-white text-sm rounded-lg focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] block w-full p-3 appearance-none cursor-pointer"
                        value={targetAll ? 'all' : 'filtered'}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === 'all') {
                            setTargetAll(true)
                            setSelectedUsers([])
                          } else {
                            setTargetAll(false)
                          }
                        }}
                      >
                        <option value="all">All Players</option>
                        <option value="filtered">Use Filters / Selected Users</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#A0A0A0]">▾</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[#A0A0A0] text-sm font-medium">Schedule Delivery</label>
                    <div className="flex items-center gap-3 bg-[#1C1C1C] border border-[#333333] rounded-lg p-2.5 px-4 h-[46px]">
                      <label className="inline-flex items-center cursor-pointer">
                        <input className="sr-only peer" type="checkbox" value="" />
                        <div className="relative w-9 h-5 bg-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#d4af35]"></div>
                        <span className="ms-3 text-sm font-medium text-[#A0A0A0]">Send Later</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="flex flex-col gap-2">
                  <label className="text-[#A0A0A0] text-sm font-medium">Message Content</label>
                  <div className="relative">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your announcement here..."
                      rows={6}
                      className="bg-[#1C1C1C] border border-[#333333] text-white text-sm rounded-lg focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] block w-full p-3 placeholder-[#555] transition-all resize-none"
                    ></textarea>
                    <div className="absolute bottom-2 right-2 text-xs text-[#555]">{Math.min(500, message.length)}/500</div>
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-[#A0A0A0] text-sm font-medium mb-2">Broadcast Image (optional)</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] || null
                          if (!file) {
                            setImageFile(null)
                            setImageUrl('')
                            return
                          }

                          if (!file.type.startsWith('image/')) {
                            showNotification('error', 'Please select a valid image file')
                            return
                          }

                          if (file.size > 5 * 1024 * 1024) {
                            showNotification('error', 'Image must be 5MB or smaller')
                            return
                          }

                          setImageFile(file)
                          await handleImageUpload(file)
                        }}
                        className="w-full text-sm text-[#A0A0A0] bg-[#1C1C1C] border border-[#333333] rounded-lg file:mr-3 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:bg-[#d4af35] file:text-black hover:file:bg-[#bfa030]"
                      />
                      <div className="relative">
                        <label className="block text-[#A0A0A0] text-xs font-medium mb-2">Or paste image URL</label>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] transition-colors text-sm"
                        />
                      </div>
                      <p className="text-xs text-[#A0A0A0]">If you select an image, it will be uploaded and attached to the broadcast. Otherwise, the URL will be used directly.</p>
                    </div>
                    <div className="bg-[#1C1C1C] border border-[#333333] rounded-lg p-3 flex items-center justify-center min-h-[140px]">
                      {imageUrl ? (
                        <img src={imageUrl} alt="Broadcast preview" className="max-h-32 object-cover rounded" />
                      ) : (
                        <span className="text-[#A0A0A0] text-sm">Image preview will appear here</span>
                      )}
                    </div>
                    {imageUrl && (
                      <button
                        onClick={() => {
                          setImageFile(null)
                          setImageUrl('')
                        }}
                        className="sm:col-span-2 w-full bg-[#1C1C1C] text-[#A0A0A0] py-2 rounded-lg border border-[#333333] text-sm hover:bg-white/5 hover:text-white transition-colors"
                        type="button"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  {imageUploading && (
                    <p className="text-xs text-[#d4af35] mt-2">Uploading image...</p>
                  )}
                </div>

                {/* Filters Section */}
                <div className="pt-6 border-t border-[#333333]">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Target Audience</h3>

                  <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="text-[#A0A0A0] mr-1">Quick segments:</span>
                    <button
                      type="button"
                      onClick={() => applySegment('newcomers')}
                      className="px-3 py-1 rounded-full border border-[#333333] bg-[#1C1C1C] text-white hover:border-[#d4af35]/60 hover:text-[#d4af35]"
                    >
                      Newcomers (7d)
                    </button>
                    <button
                      type="button"
                      onClick={() => applySegment('highRollers')}
                      className="px-3 py-1 rounded-full border border-[#333333] bg-[#1C1C1C] text-white hover:border-[#d4af35]/60 hover:text-[#d4af35]"
                    >
                      High rollers
                    </button>
                    <button
                      type="button"
                      onClick={() => applySegment('dormant')}
                      className="px-3 py-1 rounded-full border border-[#333333] bg-[#1C1C1C] text-white hover:border-[#d4af35]/60 hover:text-[#d4af35]"
                    >
                      Dormant users
                    </button>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {/* Direct User Search */}
                    <div className="bg-[#1C1C1C] rounded-lg border border-[#333333] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">Send to Specific Users</p>
                          <p className="text-xs text-[#A0A0A0] mt-1">Search by username, phone, or Telegram ID</p>
                        </div>
                        {selectedUsers.length > 0 && (
                          <span className="px-2 py-1 text-xs rounded-full bg-[#d4af35]/10 text-[#d4af35] border border-[#d4af35]/30">
                            {selectedUsers.length} selected
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={searchTerm}
                        onChange={e => searchUsers(e.target.value)}
                        placeholder="Search users..."
                        className="w-full bg-black/20 border border-[#333333] text-white px-3 py-2 rounded-lg focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] text-sm"
                      />

                      {searchTerm && (
                        <div className="bg-black/20 border border-[#333333] rounded-lg max-h-52 overflow-y-auto divide-y divide-[#333333]">
                          {isSearching ? (
                            <div className="p-3 text-xs text-[#A0A0A0]">Searching...</div>
                          ) : userResults.length === 0 ? (
                            <div className="p-3 text-xs text-[#A0A0A0]">No users found</div>
                          ) : (
                            userResults.map((user: UserResult) => {
                              const isSelected = selectedUsers.some(u => u.id === user.id)
                              return (
                                <button
                                  key={user.id}
                                  onClick={() => toggleUserSelection(user)}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between transition-colors ${
                                    isSelected ? 'bg-[#d4af35]/10 text-[#d4af35]' : 'text-white hover:bg-white/5'
                                  }`}
                                >
                                  <div>
                                    <p className="font-medium">{user.username || 'Unnamed user'}</p>
                                    <p className="text-[11px] text-[#A0A0A0]">
                                      TG: {user.telegram_id || 'n/a'} · Phone: {user.phone || 'n/a'} · Balance: {formatCurrency(user.balance || 0)}
                                    </p>
                                  </div>
                                  <span className="text-xs">
                                    {isSelected ? '✓ Selected' : 'Select'}
                                  </span>
                                </button>
                              )
                            })
                          )}
                        </div>
                      )}

                      {selectedUsers.length > 0 && (
                        <div className="pt-2 border-t border-[#333333] text-xs text-white space-y-1">
                          <p className="text-[#A0A0A0]">Selected recipients:</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedUsers.map(user => (
                              <span key={user.id} className="px-2 py-1 bg-black/20 border border-[#333333] rounded-full">
                                {user.username || user.telegram_id || 'User'}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => setSelectedUsers([])}
                            type="button"
                            className="mt-2 text-[#d4af35] hover:text-white"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Target All Toggle */}
                    <div className="flex items-center justify-between p-3 sm:p-4 bg-[#1C1C1C] rounded-lg border border-[#333333]">
                      <div>
                        <p className="text-white font-medium text-sm">Send to All Users</p>
                        <p className="text-xs text-[#A0A0A0] mt-1">Include all users with Telegram connected</p>
                      </div>
                      <button
                        onClick={() => setTargetAll(!targetAll)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                          targetAll ? 'bg-[#d4af35]' : 'bg-[#333333]'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          targetAll ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Active Only */}
                    <div className="flex items-center justify-between p-3 sm:p-4 bg-[#1C1C1C] rounded-lg border border-[#333333]">
                      <div>
                        <p className="text-white font-medium text-sm">Active Users Only</p>
                        <p className="text-xs text-[#A0A0A0] mt-1">Last active in the past 24 hours</p>
                      </div>
                      <button
                        onClick={() => setActiveOnly(!activeOnly)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                          activeOnly ? 'bg-[#d4af35]' : 'bg-[#333333]'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          activeOnly ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Min Balance */}
                    <div>
                      <label className="block text-[#A0A0A0] text-sm font-medium mb-2">Minimum Balance (ETB)</label>
                      <input
                        type="number"
                        value={minBalance}
                        onChange={(e) => setMinBalance(e.target.value)}
                        placeholder="Leave empty for no limit"
                        className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] transition-colors text-sm"
                      />
                    </div>

                    {/* Min Games */}
                    <div>
                      <label className="block text-[#A0A0A0] text-sm font-medium mb-2">Minimum Games Played</label>
                      <input
                        type="number"
                        value={minGames}
                        onChange={(e) => setMinGames(e.target.value)}
                        placeholder="Leave empty for no limit"
                        className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35] focus:ring-1 focus:ring-[#d4af35] transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#333333]">
                    <button
                      className="px-6 py-2.5 rounded-lg text-sm font-bold text-[#A0A0A0] hover:text-white hover:bg-[#333] transition-all"
                      type="button"
                      onClick={() => {
                        showNotification('success', 'Draft saved (local only)')
                      }}
                    >
                      Save Draft
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={isSending || imageUploading}
                      className="px-6 py-2.5 bg-[#d4af35] hover:bg-[#bfa030] disabled:opacity-60 text-black rounded-lg text-sm font-bold shadow-lg shadow-[#d4af35]/20 transition-all flex items-center gap-2"
                      type="button"
                    >
                      {isSending ? 'Sending...' : 'Send Broadcast'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: History */}
          <div className="xl:col-span-5 flex flex-col gap-6 min-h-0">
            <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#333333]">
                <div className="flex items-center gap-2">
                  <span className="text-white/50">⟲</span>
                  <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                </div>
                <button className="text-xs font-bold text-[#d4af35] hover:text-white transition-colors" type="button">
                  View All
                </button>
              </div>

              <div className="px-6 pb-6 flex flex-col gap-4 overflow-y-auto min-h-0 max-h-[520px] xl:max-h-[calc(100vh-300px)] pr-2">
                {loading ? (
                  <div className="text-sm text-[#A0A0A0] py-10 text-center">Loading…</div>
                ) : previousBroadcasts.length === 0 ? (
                  <div className="text-sm text-[#A0A0A0] py-10 text-center">No broadcasts yet.</div>
                ) : (
                  previousBroadcasts.map((b) => (
                    <div
                      key={b.id}
                      className="group flex flex-col bg-[#1C1C1C] hover:bg-[#222] border border-[#333333] hover:border-[#444] rounded-lg p-4 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        {(() => {
                          const total = Number(b?.recipients || 0)
                          const sent = Number(b?.sent || 0)
                          const failed = Number(b?.failed || 0)
                          const status = total > 0 && failed >= total ? 'failed' : failed > 0 ? 'partial' : 'sent'
                          const badgeClass =
                            status === 'failed'
                              ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                              : status === 'partial'
                                ? 'bg-[#F39C12]/10 text-[#F39C12] border border-[#F39C12]/30'
                                : 'bg-[#0bda1d]/10 text-[#0bda1d] border border-[#0bda1d]/30'
                          const dotClass = status === 'failed' ? 'bg-red-400' : status === 'partial' ? 'bg-[#F39C12]' : 'bg-[#0bda1d]'
                          const label = status === 'failed' ? 'Failed' : status === 'partial' ? 'Partial' : 'Sent'

                          const createdAt = b?.created_at ? new Date(b.created_at).getTime() : NaN
                          const ageMin = Number.isFinite(createdAt) ? Math.floor((Date.now() - createdAt) / 60000) : null
                          const timeText =
                            ageMin == null
                              ? '—'
                              : ageMin < 1
                                ? 'Just now'
                                : ageMin < 60
                                  ? `${ageMin}m ago`
                                  : `${Math.floor(ageMin / 60)}h ago`

                          return (
                            <>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                                <span className={`size-1.5 rounded-full ${dotClass}`} />
                                {label}
                              </span>
                              <span className="text-xs text-[#666] whitespace-nowrap" title={b.created_at ? new Date(b.created_at).toLocaleString() : '—'}>
                                {timeText}
                              </span>
                            </>
                          )
                        })()}
                      </div>
                      <h4 className="text-white font-semibold text-sm mb-1 line-clamp-1">{b.title || 'Untitled'}</h4>
                      <p className="text-[#A0A0A0] text-xs mb-3 line-clamp-2">{String(b.message || '')}</p>
                      <div className="flex items-center justify-between text-xs text-[#666] border-t border-[#333333] pt-3 mt-1">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">Audience: {b?.filters?.targetUserIds ? 'Selected' : 'All'}</span>
                          <span className="flex items-center gap-1">Sent: {Number(b?.sent || 0)}/{Number(b?.recipients || 0)}</span>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[#A0A0A0] hover:text-white" type="button">
                          …
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
