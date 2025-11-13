"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface BotPlayer {
  id: string
  name: string
  username: string
  avatar_url?: string
  is_enabled: boolean
  win_rate: number
  response_time_min: number
  response_time_max: number
  aggression_level: number
  personality: string
  chat_enabled: boolean
  chat_frequency: number
  skill_level: string
  auto_join_enabled: boolean
  max_concurrent_games: number
  games_played: number
  games_won: number
  total_winnings: number
  created_at: string
}

const personalities = [
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'competitive', label: 'Competitive', emoji: '🔥' },
  { value: 'casual', label: 'Casual', emoji: '😎' },
  { value: 'silent', label: 'Silent', emoji: '🤫' }
]

const skillLevels = [
  { value: 'easy', label: 'Easy', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'hard', label: 'Hard', color: 'text-red-600' }
]

export default function BotManagement() {
  const [bots, setBots] = useState<BotPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingBot, setEditingBot] = useState<BotPlayer | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    win_rate: 30,
    response_time_min: 2000,
    response_time_max: 8000,
    aggression_level: 50,
    personality: 'friendly',
    chat_enabled: true,
    chat_frequency: 30,
    skill_level: 'medium',
    auto_join_enabled: true,
    max_concurrent_games: 1,
    is_enabled: true
  })

  useEffect(() => {
    fetchBots()
  }, [])

  const fetchBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_players')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBots(data || [])
    } catch (error) {
      console.error('Error fetching bots:', error)
      showNotification('error', 'Failed to fetch bot players')
    } finally {
      setLoading(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleCreateBot = () => {
    setEditingBot(null)
    setFormData({
      name: '',
      username: '',
      win_rate: 30,
      response_time_min: 2000,
      response_time_max: 8000,
      aggression_level: 50,
      personality: 'friendly',
      chat_enabled: true,
      chat_frequency: 30,
      skill_level: 'medium',
      auto_join_enabled: true,
      max_concurrent_games: 1,
      is_enabled: true
    })
    setShowCreateModal(true)
  }

  const handleEditBot = (bot: BotPlayer) => {
    setEditingBot(bot)
    setFormData({
      name: bot.name,
      username: bot.username,
      win_rate: bot.win_rate,
      response_time_min: bot.response_time_min,
      response_time_max: bot.response_time_max,
      aggression_level: bot.aggression_level,
      personality: bot.personality,
      chat_enabled: bot.chat_enabled,
      chat_frequency: bot.chat_frequency,
      skill_level: bot.skill_level,
      auto_join_enabled: bot.auto_join_enabled,
      max_concurrent_games: bot.max_concurrent_games,
      is_enabled: bot.is_enabled
    })
    setShowCreateModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const botData = {
        name: formData.name,
        username: formData.username,
        win_rate: formData.win_rate,
        response_time_min: formData.response_time_min,
        response_time_max: formData.response_time_max,
        aggression_level: formData.aggression_level,
        personality: formData.personality,
        chat_enabled: formData.chat_enabled,
        chat_frequency: formData.chat_frequency,
        skill_level: formData.skill_level,
        auto_join_enabled: formData.auto_join_enabled,
        max_concurrent_games: formData.max_concurrent_games,
        is_enabled: formData.is_enabled
      }

      if (editingBot) {
        const { error } = await supabase
          .from('bot_players')
          .update(botData)
          .eq('id', editingBot.id)
        
        if (error) throw error
        showNotification('success', 'Bot updated successfully!')
      } else {
        const { error } = await supabase
          .from('bot_players')
          .insert(botData)
        
        if (error) throw error
        showNotification('success', 'Bot created successfully!')
      }

      setShowCreateModal(false)
      fetchBots()
    } catch (error: any) {
      console.error('Error saving bot:', error)
      showNotification('error', error.message || 'Failed to save bot')
    }
  }

  const toggleBotStatus = async (botId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('bot_players')
        .update({ is_enabled: !currentStatus })
        .eq('id', botId)

      if (error) throw error
      
      showNotification('success', `Bot ${!currentStatus ? 'enabled' : 'disabled'} successfully!`)
      fetchBots()
    } catch (error: any) {
      console.error('Error updating bot status:', error)
      showNotification('error', 'Failed to update bot status')
    }
  }

  const handleDeleteBot = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('bot_players')
        .delete()
        .eq('id', botId)

      if (error) throw error
      
      showNotification('success', 'Bot deleted successfully!')
      fetchBots()
    } catch (error: any) {
      console.error('Error deleting bot:', error)
      showNotification('error', 'Failed to delete bot')
    }
  }

  const getPersonalityEmoji = (personality: string) => {
    return personalities.find(p => p.value === personality)?.emoji || '🤖'
  }

  const getSkillColor = (skill: string) => {
    return skillLevels.find(s => s.value === skill)?.color || 'text-gray-600'
  }

  const getWinRateColor = (winRate: number) => {
    if (winRate <= 25) return 'text-green-600'
    if (winRate <= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const startBotMonitoring = async () => {
    try {
      const response = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_monitoring' })
      })

      const data = await response.json()
      if (data.success) {
        showNotification('success', 'Bot auto-join monitoring started!')
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to start monitoring')
    }
  }

  const stopBotMonitoring = async () => {
    try {
      const response = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_monitoring' })
      })

      const data = await response.json()
      if (data.success) {
        showNotification('success', 'Bot auto-join monitoring stopped!')
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to stop monitoring')
    }
  }

  const testBotJoin = async () => {
    try {
      // Get a random room for testing
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, name')
        .limit(1)

      if (!rooms || rooms.length === 0) {
        showNotification('error', 'No rooms available for testing')
        return
      }

      const response = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add_to_room',
          roomId: rooms[0].id
        })
      })

      const data = await response.json()
      if (data.success) {
        showNotification('success', `Test bot added to room ${rooms[0].name}!`)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to test bot join')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-2xl font-bold text-white">🤖 Bot Player Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border animate-slide-in ${
            notification.type === 'success'
              ? 'bg-green-500/90 border-green-400 text-white'
              : 'bg-red-500/90 border-red-400 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}>
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {notification.type === 'success' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-blue-400 text-lg">🤖</span>
              </div>
              <div>
                <p className="text-white/70 text-sm">Total Bots</p>
                <p className="text-white text-xl font-bold">{bots.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <span className="text-green-400 text-lg">✅</span>
              </div>
              <div>
                <p className="text-white/70 text-sm">Active Bots</p>
                <p className="text-white text-xl font-bold">{bots.filter(b => b.is_enabled).length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-purple-400 text-lg">🎮</span>
              </div>
              <div>
                <p className="text-white/70 text-sm">Auto-Join Enabled</p>
                <p className="text-white text-xl font-bold">{bots.filter(b => b.auto_join_enabled).length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <span className="text-yellow-400 text-lg">🏆</span>
              </div>
              <div>
                <p className="text-white/70 text-sm">Total Games</p>
                <p className="text-white text-xl font-bold">{bots.reduce((sum, bot) => sum + bot.games_played, 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bot Controls */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={handleCreateBot}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span className="text-lg">🤖</span>
            Create New Bot
          </button>
          
          <button
            onClick={startBotMonitoring}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span className="text-lg">▶️</span>
            Start Auto-Join
          </button>
          
          <button
            onClick={stopBotMonitoring}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span className="text-lg">⏹️</span>
            Stop Auto-Join
          </button>
          
          <button
            onClick={testBotJoin}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span className="text-lg">🧪</span>
            Test Bot Join
          </button>
        </div>

        {/* Bots Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              Loading bot players...
            </div>
          ) : bots.length === 0 ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              No bot players found
            </div>
          ) : (
            bots.map((bot) => (
              <div key={bot.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {getPersonalityEmoji(bot.personality)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{bot.name}</h3>
                      <p className="text-gray-400 text-sm">@{bot.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      bot.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {bot.is_enabled ? 'Active' : 'Inactive'}
                    </span>
                    {bot.auto_join_enabled && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                        Auto-Join
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Skill Level:</span>
                      <span className={`ml-2 font-semibold ${getSkillColor(bot.skill_level)}`}>
                        {bot.skill_level.charAt(0).toUpperCase() + bot.skill_level.slice(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Win Rate:</span>
                      <span className={`ml-2 font-semibold ${getWinRateColor(bot.win_rate)}`}>
                        {bot.win_rate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Games:</span>
                      <span className="ml-2 text-white font-semibold">{bot.games_played}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Won:</span>
                      <span className="ml-2 text-white font-semibold">{bot.games_won}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Personality:</span>
                      <span className="ml-2 text-white font-semibold capitalize">{bot.personality}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Response:</span>
                      <span className="ml-2 text-white font-semibold">
                        {bot.response_time_min/1000}-{bot.response_time_max/1000}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEditBot(bot)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleBotStatus(bot.id, bot.is_enabled)}
                    className={`py-2 rounded-lg font-semibold transition-colors text-sm ${
                      bot.is_enabled
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {bot.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteBot(bot.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingBot ? 'Edit Bot Player' : 'Create New Bot Player'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Bot Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    placeholder="Lucky Lucy"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    placeholder="lucky_lucy_bot"
                    required
                  />
                </div>
              </div>

              {/* Behavior Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Win Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.win_rate}
                    onChange={(e) => setFormData({...formData, win_rate: parseInt(e.target.value)})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">Chance to win games (0-100%)</p>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Aggression Level</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.aggression_level}
                    onChange={(e) => setFormData({...formData, aggression_level: parseInt(e.target.value)})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-400 mt-1">How aggressive in marking (0-100)</p>
                </div>
              </div>

              {/* Response Times */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Min Response Time (ms)</label>
                  <input
                    type="number"
                    min="500"
                    max="30000"
                    value={formData.response_time_min}
                    onChange={(e) => setFormData({...formData, response_time_min: parseInt(e.target.value)})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Max Response Time (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="60000"
                    value={formData.response_time_max}
                    onChange={(e) => setFormData({...formData, response_time_max: parseInt(e.target.value)})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
              </div>

              {/* Personality & Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Personality</label>
                  <select
                    value={formData.personality}
                    onChange={(e) => setFormData({...formData, personality: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  >
                    {personalities.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.emoji} {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Skill Level</label>
                  <select
                    value={formData.skill_level}
                    onChange={(e) => setFormData({...formData, skill_level: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  >
                    {skillLevels.map(s => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chat Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="chat_enabled"
                    checked={formData.chat_enabled}
                    onChange={(e) => setFormData({...formData, chat_enabled: e.target.checked})}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="chat_enabled" className="text-gray-300">Enable Chat</label>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Chat Frequency (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.chat_frequency}
                    onChange={(e) => setFormData({...formData, chat_frequency: parseInt(e.target.value)})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    disabled={!formData.chat_enabled}
                  />
                </div>
              </div>

              {/* Game Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="auto_join_enabled"
                    checked={formData.auto_join_enabled}
                    onChange={(e) => setFormData({...formData, auto_join_enabled: e.target.checked})}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="auto_join_enabled" className="text-gray-300">Auto-Join Games</label>
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Max Concurrent Games</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.max_concurrent_games}
                    onChange={(e) => setFormData({...formData, max_concurrent_games: parseInt(e.target.value)})}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_enabled"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({...formData, is_enabled: e.target.checked})}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_enabled" className="text-gray-300">Bot Enabled</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  {editingBot ? 'Update Bot' : 'Create Bot'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
