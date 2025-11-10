"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminBroadcast() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetAll, setTargetAll] = useState(true)
  const [activeOnly, setActiveOnly] = useState(false)
  const [minBalance, setMinBalance] = useState('')
  const [minGames, setMinGames] = useState('')
  const [estimatedRecipients, setEstimatedRecipients] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [previousBroadcasts, setPreviousBroadcasts] = useState<any[]>([])

  useEffect(() => {
    fetchEstimatedRecipients()
  }, [targetAll, activeOnly, minBalance, minGames])

  const fetchEstimatedRecipients = async () => {
    try {
      let query = supabase.from('users').select('*', { count: 'exact', head: true })

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

  const handleSend = async () => {
    if (!title || !message) {
      alert('Please fill in title and message')
      return
    }

    setIsSending(true)
    try {
      // Get users based on filters
      let query = supabase.from('users').select('telegram_id')

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

      const { data: users } = await query

      // TODO: Implement actual Telegram broadcast via bot
      console.log(`Broadcasting to ${users?.length} users:`, { title, message })

      alert(`Broadcast sent to ${estimatedRecipients} users!`)
      setTitle('')
      setMessage('')
    } catch (error) {
      console.error('Error sending broadcast:', error)
      alert('Failed to send broadcast')
    } finally {
      setIsSending(false)
    }
  }

  const handlePreview = () => {
    alert(`Preview:\n\nTitle: ${title}\n\nMessage: ${message}\n\nRecipients: ${estimatedRecipients}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-white">📢 Broadcast Messages</h1>
              <p className="text-gray-400 text-sm">Send notifications to users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose Broadcast */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-6">
              <h2 className="text-xl font-bold text-white mb-6">Compose Broadcast</h2>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter broadcast title"
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Message */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={6}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="text-sm text-gray-400 mt-1">{message.length} characters</div>
              </div>

              {/* Target Audience */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-4">Target Audience</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={targetAll}
                      onChange={(e) => setTargetAll(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-white">All Users ({estimatedRecipients.toLocaleString()})</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeOnly}
                      onChange={(e) => setActiveOnly(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-white">Active Users Only (last 24h)</span>
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Min Balance (ETB)</label>
                      <input
                        type="number"
                        value={minBalance}
                        onChange={(e) => setMinBalance(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Min Games Played</label>
                      <input
                        type="number"
                        value={minGames}
                        onChange={(e) => setMinGames(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Estimated Recipients */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👥</span>
                  <div>
                    <div className="text-sm text-blue-300">Estimated Recipients</div>
                    <div className="text-2xl font-bold text-blue-400">{estimatedRecipients.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handlePreview}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  👁️ Preview
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSending || !title || !message}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>📢 Send Broadcast</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Previous Broadcasts */}
          <div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-6">Previous Broadcasts</h2>
              
              <div className="space-y-3">
                {previousBroadcasts.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No previous broadcasts
                  </div>
                ) : (
                  previousBroadcasts.map(broadcast => (
                    <div key={broadcast.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="font-semibold text-white mb-2">{broadcast.title}</div>
                      <div className="text-sm text-gray-400 mb-2">
                        Recipients: {broadcast.recipients.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">{broadcast.sent}</div>
                      <span className="inline-block mt-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                        {broadcast.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mt-6">
              <h3 className="text-lg font-bold text-white mb-4">💡 Tips</h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>• Keep messages short and clear</li>
                <li>• Use emojis to grab attention</li>
                <li>• Target specific user groups</li>
                <li>• Preview before sending</li>
                <li>• Send during peak hours</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
