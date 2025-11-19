"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

interface UserResult {
  id: string
  username: string | null
  telegram_id: string | null
  phone: string | null
  balance: number | null
}

export default function AdminBroadcast() {
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
  const [estimatedRecipients, setEstimatedRecipients] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [previousBroadcasts, setPreviousBroadcasts] = useState<any[]>([])
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [userResults, setUserResults] = useState<UserResult[]>([])
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    fetchEstimatedRecipients()
    fetchPreviousBroadcasts()
  }, [targetAll, activeOnly, minBalance, minGames, selectedUsers])

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

      if (activeOnly) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gte('last_active', yesterday.toISOString())
      }

      if (minBalance) {
        query = query.gte('balance', parseInt(minBalance))
      }

      if (minGames) {
        query = query.gte('games_played', parseInt(minGames))
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

  const handleSend = async () => {
    if (!title || !message) {
      showNotification('error', 'Please fill in title and message')
      return
    }

    if (!confirm(`Send broadcast to ${estimatedRecipients} users?`)) {
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

      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': adminId },
        body: JSON.stringify({
          title,
          message: formattedMessage,
          filters: {
            activeOnly,
            minBalance: minBalance ? parseInt(minBalance) : null,
            minGames: minGames ? parseInt(minGames) : null
          },
          targetUserIds: selectedUsers.length > 0 ? selectedUsers.map(user => user.id) : null,
          imageUrl: finalImageUrl || null
        })
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

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `broadcast-${Date.now()}.${fileExt}`
      const filePath = `broadcasts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload failed:', uploadError)
        showNotification('error', 'Failed to upload image. Please try again.')
        return ''
      }

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath)

      setImageUrl(publicUrl)
      return publicUrl
    } catch (error) {
      console.error('Unexpected upload error:', error)
      showNotification('error', 'Failed to upload image. Please try again.')
      return ''
    } finally {
      setImageUploading(false)
    }
  }, [showNotification])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 sm:px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top text-sm sm:text-base ${
          notification.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Broadcast Messages</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">Send announcements to your users via Telegram</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Compose Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Compose Card */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Compose Message</h2>
              
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Announcement title"
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Your broadcast message..."
                    rows={5}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors resize-none text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-2">{message.length} characters</p>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Broadcast Image (optional)</label>
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
                        className="w-full text-sm text-slate-300 bg-slate-700/50 border border-slate-600 rounded-lg file:mr-3 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:bg-emerald-500 file:text-white hover:file:bg-emerald-600"
                      />
                      <div className="relative">
                        <label className="block text-slate-300 text-xs font-medium mb-2">Or paste image URL</label>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                        />
                      </div>
                      <p className="text-xs text-slate-500">If you select an image, it will be uploaded and attached to the broadcast. Otherwise, the URL will be used directly.</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-center min-h-[140px]">
                      {imageUrl ? (
                        <img src={imageUrl} alt="Broadcast preview" className="max-h-32 object-cover rounded" />
                      ) : (
                        <span className="text-slate-500 text-sm">Image preview will appear here</span>
                      )}
                    </div>
                    {imageUrl && (
                      <button
                        onClick={() => {
                          setImageFile(null)
                          setImageUrl('')
                        }}
                        className="sm:col-span-2 w-full bg-slate-700/50 text-slate-300 py-2 rounded-lg border border-slate-600 text-sm hover:bg-slate-700 transition-colors"
                        type="button"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  {imageUploading && (
                    <p className="text-xs text-emerald-400 mt-2">Uploading image...</p>
                  )}
                </div>

                {/* Filters Section */}
                <div className="pt-6 border-t border-slate-700">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-4">Target Audience</h3>
                  
                  <div className="space-y-3 sm:space-y-4">
                    {/* Direct User Search */}
                    <div className="bg-slate-700/30 rounded-lg border border-slate-700 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-300 font-medium text-sm">Send to Specific Users</p>
                          <p className="text-xs text-slate-500 mt-1">Search by username, phone, or Telegram ID</p>
                        </div>
                        {selectedUsers.length > 0 && (
                          <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {selectedUsers.length} selected
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={searchTerm}
                        onChange={e => searchUsers(e.target.value)}
                        placeholder="Search users..."
                        className="w-full bg-slate-800/50 border border-slate-600 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/50 text-sm"
                      />

                      {searchTerm && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-700">
                          {isSearching ? (
                            <div className="p-3 text-xs text-slate-400">Searching...</div>
                          ) : userResults.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400">No users found</div>
                          ) : (
                            userResults.map((user: UserResult) => {
                              const isSelected = selectedUsers.some(u => u.id === user.id)
                              return (
                                <button
                                  key={user.id}
                                  onClick={() => toggleUserSelection(user)}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between transition-colors ${
                                    isSelected ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-200 hover:bg-slate-700/50'
                                  }`}
                                >
                                  <div>
                                    <p className="font-medium">{user.username || 'Unnamed user'}</p>
                                    <p className="text-[11px] text-slate-400">
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
                        <div className="pt-2 border-t border-slate-700 text-xs text-slate-300 space-y-1">
                          <p className="text-slate-400">Selected recipients:</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedUsers.map(user => (
                              <span key={user.id} className="px-2 py-1 bg-slate-800 border border-slate-600 rounded-full">
                                {user.username || user.telegram_id || 'User'}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => setSelectedUsers([])}
                            type="button"
                            className="mt-2 text-emerald-300 hover:text-emerald-200"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Target All Toggle */}
                    <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-700/30 rounded-lg border border-slate-700">
                      <div>
                        <p className="text-slate-300 font-medium text-sm">Send to All Users</p>
                        <p className="text-xs text-slate-500 mt-1">Include all users with Telegram connected</p>
                      </div>
                      <button
                        onClick={() => setTargetAll(!targetAll)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                          targetAll ? 'bg-emerald-600' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          targetAll ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Active Only */}
                    <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-700/30 rounded-lg border border-slate-700">
                      <div>
                        <p className="text-slate-300 font-medium text-sm">Active Users Only</p>
                        <p className="text-xs text-slate-500 mt-1">Last active in the past 24 hours</p>
                      </div>
                      <button
                        onClick={() => setActiveOnly(!activeOnly)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                          activeOnly ? 'bg-emerald-600' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          activeOnly ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Min Balance */}
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Minimum Balance (ETB)</label>
                      <input
                        type="number"
                        value={minBalance}
                        onChange={(e) => setMinBalance(e.target.value)}
                        placeholder="Leave empty for no limit"
                        className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                      />
                    </div>

                    {/* Min Games */}
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2">Minimum Games Played</label>
                      <input
                        type="number"
                        value={minGames}
                        onChange={(e) => setMinGames(e.target.value)}
                        placeholder="Leave empty for no limit"
                        className="w-full bg-slate-700/50 border border-slate-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Send Button */}
                <div className="pt-6 border-t border-slate-700">
                  <button
                    onClick={handleSend}
                    disabled={isSending || !title || !message}
                    className={`w-full py-2.5 sm:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base ${
                      isSending || !title || !message
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span className="hidden sm:inline">Sending to {estimatedRecipients} users...</span>
                        <span className="sm:hidden">Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>📢</span>
                        <span>Send Broadcast</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recipients Card */}
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 backdrop-blur-md rounded-lg border border-emerald-500/30 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-xs sm:text-sm">Estimated Recipients</p>
                <span className="text-xl sm:text-2xl">👥</span>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-emerald-400">{estimatedRecipients.toLocaleString()}</p>
              <p className="text-xs text-emerald-300 mt-2">Users will receive via Telegram</p>
            </div>

            {/* Filter Summary */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Active Filters</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">All Users:</span>
                  <span className={targetAll ? 'text-emerald-400' : 'text-slate-500'}>
                    {targetAll ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Active Only:</span>
                  <span className={activeOnly ? 'text-emerald-400' : 'text-slate-500'}>
                    {activeOnly ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
                {minBalance && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Min Balance:</span>
                    <span className="text-emerald-400">{minBalance} ETB</span>
                  </div>
                )}
                {minGames && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Min Games:</span>
                    <span className="text-emerald-400">{minGames}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Previous Broadcasts */}
        <div className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Recent Broadcasts</h2>
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 overflow-hidden">
            {loading ? (
              <div className="p-8 sm:p-12 text-center text-slate-400">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                Loading broadcasts...
              </div>
            ) : previousBroadcasts.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-400">
                No broadcasts sent yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50 border-b border-slate-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-300">Title</th>
                      <th className="hidden sm:table-cell px-6 py-4 text-left text-sm font-semibold text-slate-300">Recipients</th>
                      <th className="hidden md:table-cell px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {previousBroadcasts.map((broadcast: any) => (
                      <tr key={broadcast.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <p className="font-medium text-white text-xs sm:text-sm">{broadcast.title}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1 hidden sm:block">{broadcast.message}</p>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-slate-300 text-sm">{broadcast.recipients ?? 0}</td>
                        <td className="hidden md:table-cell px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ✓ Sent
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-400 text-xs sm:text-sm">
                          {new Date(broadcast.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
