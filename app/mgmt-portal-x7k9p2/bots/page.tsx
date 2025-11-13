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
  const [systemStatus, setSystemStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown')
  
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
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    try {
      // Check if there are any bots currently in waiting rooms
      const { data: activeBotGames, error } = await supabase
        .from('games')
        .select('id')
        .eq('status', 'waiting')
        .in('user_id', (await supabase
          .from('users')
          .select('id')
          .eq('is_bot', true)
        ).data?.map(u => u.id) || [])

      if (error) {
        console.error('Error checking system status:', error)
        setSystemStatus('unknown')
        return
      }

      // If there are active bot games, system is likely running
      setSystemStatus(activeBotGames && activeBotGames.length > 0 ? 'running' : 'stopped')
    } catch (error) {
      console.error('Error checking system status:', error)
      setSystemStatus('unknown')
    }
  }

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
      setSystemStatus('running')
      
      // First, start the bot monitoring system
      const monitorResponse = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_monitoring' })
      })

      const monitorData = await monitorResponse.json()
      if (!monitorData.success) {
        throw new Error(monitorData.error || 'Failed to start monitoring')
      }

      // Then, initialize bot presence in all rooms
      const { error: presenceError } = await supabase.rpc('maintain_bot_presence')
      if (presenceError) {
        console.error('Error initializing bot presence:', presenceError)
        // Don't fail completely, just log the error
      }

      // Refresh bot data to show updated status
      await fetchBots()
      
      showNotification('success', 'Bot system started! Bots are now active in all rooms.')
    } catch (error: any) {
      setSystemStatus('stopped')
      showNotification('error', error.message || 'Failed to start bot system')
    }
  }

  const stopBotMonitoring = async () => {
    try {
      setSystemStatus('stopped')
      
      // Stop the bot monitoring system
      const response = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_monitoring' })
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to stop monitoring')
      }

      // Remove all bots from waiting rooms
      // First get bot user IDs
      const { data: botUsers, error: botUsersError } = await supabase
        .from('users')
        .select('id')
        .eq('is_bot', true)

      if (botUsersError) {
        console.error('Error fetching bot users:', botUsersError)
      } else if (botUsers && botUsers.length > 0) {
        // Delete bot games in batches to avoid URL length issues
        const botUserIds = botUsers.map(u => u.id)
        const { error: removeError } = await supabase
          .from('games')
          .delete()
          .eq('status', 'waiting')
          .in('user_id', botUserIds)

        if (removeError) {
          console.error('Error removing bots from rooms:', removeError)
        }
      }

      // Update room counts
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ 
          waiting_players: 0,
          prize_pool: 0 
        })
        .neq('id', '')

      if (updateError) {
        console.error('Error updating room counts:', updateError)
      }

      // Refresh bot data
      await fetchBots()
      
      showNotification('success', 'Bot system stopped! All bots removed from rooms.')
    } catch (error: any) {
      setSystemStatus('running')
      showNotification('error', error.message || 'Failed to stop bot system')
    }
  }

  const rotateBots = async () => {
    try {
      // First, get all rooms
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name')

      if (roomsError) {
        throw new Error('Failed to fetch rooms: ' + roomsError.message)
      }

      if (!rooms || rooms.length === 0) {
        throw new Error('No rooms found to rotate bots')
      }

      // Rotate bots for each room
      let rotatedRooms = 0
      for (const room of rooms) {
        const { error } = await supabase.rpc('rotate_room_bots', {
          room_id_param: room.id
        })
        
        if (!error) {
          rotatedRooms++
        } else {
          console.error(`Failed to rotate bots in room ${room.name}:`, error)
        }
      }

      // Update overall bot presence
      const { error: maintainError } = await supabase.rpc('maintain_bot_presence')
      if (maintainError) {
        console.error('Error maintaining bot presence:', maintainError)
      }

      if (rotatedRooms > 0) {
        showNotification('success', `Bot rotation completed! Shuffled bots in ${rotatedRooms} rooms.`)
      } else {
        throw new Error('Failed to rotate bots in any rooms')
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to rotate bots')
    }
  }

  const updatePrizePools = async () => {
    try {
      // Get all rooms with their current data
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name, stake')

      if (roomsError) {
        throw new Error('Failed to fetch rooms: ' + roomsError.message)
      }

      if (!rooms || rooms.length === 0) {
        throw new Error('No rooms found to update')
      }

      let updatedRooms = 0
      
      // Update each room's prize pool and waiting players count
      for (const room of rooms) {
        try {
          // Count waiting players in this room
          const { data: waitingGames, error: gamesError } = await supabase
            .from('games')
            .select('id')
            .eq('room_id', room.id)
            .eq('status', 'waiting')

          if (gamesError) {
            console.error(`Error counting games for room ${room.name}:`, gamesError)
            continue
          }

          const waitingCount = waitingGames?.length || 0
          const prizePool = room.stake * waitingCount // Full amount before commission

          // Update the room
          const { error: updateError } = await supabase
            .from('rooms')
            .update({
              waiting_players: waitingCount,
              prize_pool: prizePool
            })
            .eq('id', room.id)

          if (updateError) {
            console.error(`Error updating room ${room.name}:`, updateError)
          } else {
            updatedRooms++
          }
        } catch (roomError) {
          console.error(`Error processing room ${room.name}:`, roomError)
        }
      }

      if (updatedRooms > 0) {
        showNotification('success', `Prize pools updated for ${updatedRooms} rooms!`)
      } else {
        throw new Error('Failed to update any room prize pools')
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to update prize pools')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/mgmt-portal-x7k9p2" className="text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Bot Management</h1>
                <p className="text-sm text-gray-500">Manage AI players and system settings</p>
              </div>
            </div>
            
            {/* System Status Indicator */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                systemStatus === 'running' 
                  ? 'bg-green-100 text-green-800' 
                  : systemStatus === 'stopped'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  systemStatus === 'running' 
                    ? 'bg-green-500 animate-pulse' 
                    : systemStatus === 'stopped'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}></div>
                {systemStatus === 'running' ? 'System Active' : 
                 systemStatus === 'stopped' ? 'System Stopped' : 'Status Unknown'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${notification.type === 'success' ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {notification.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                )}
              </svg>
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Bots</p>
                <p className="text-2xl font-semibold text-gray-900">{bots.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Bots</p>
                <p className="text-2xl font-semibold text-gray-900">{bots.filter(b => b.is_enabled).length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9 4h10a1 1 0 001-1V7a1 1 0 00-1-1H6a1 1 0 00-1 1v10a1 1 0 001 1z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Auto-Join Enabled</p>
                <p className="text-2xl font-semibold text-gray-900">{bots.filter(b => b.auto_join_enabled).length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Games</p>
                <p className="text-2xl font-semibold text-gray-900">{bots.reduce((sum, bot) => sum + bot.games_played, 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">System Controls</h2>
            <p className="text-sm text-gray-500">Manage bot system and operations</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <button
                onClick={handleCreateBot}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Bot
              </button>
              
              <button
                onClick={startBotMonitoring}
                disabled={systemStatus === 'running'}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  systemStatus === 'running'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9 4h10a1 1 0 001-1V7a1 1 0 00-1-1H6a1 1 0 00-1 1v10a1 1 0 001 1z" />
                </svg>
                {systemStatus === 'running' ? 'System Running' : 'Start System'}
              </button>
              
              <button
                onClick={stopBotMonitoring}
                disabled={systemStatus === 'stopped'}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                  systemStatus === 'stopped'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                {systemStatus === 'stopped' ? 'System Stopped' : 'Stop System'}
              </button>
              
              <button
                onClick={rotateBots}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rotate Bots
              </button>
              
              <button
                onClick={updatePrizePools}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                Update Pools
              </button>
            </div>
          </div>
        </div>

        {/* Bot List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Bot Players</h2>
            <p className="text-sm text-gray-500">Manage individual bot configurations</p>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-500">Loading bot players...</p>
            </div>
          ) : bots.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-4 text-gray-500">No bot players found</p>
              <button
                onClick={handleCreateBot}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Create your first bot
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {bots.map((bot) => (
                <div key={bot.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {getPersonalityEmoji(bot.personality)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">{bot.name}</h3>
                          <div className="flex gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              bot.is_enabled 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {bot.is_enabled ? 'Active' : 'Inactive'}
                            </span>
                            {bot.auto_join_enabled && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Auto-Join
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">@{bot.username}</p>
                        
                        {/* Bot Stats - Mobile Responsive */}
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Skill:</span>
                            <span className={`ml-1 font-medium ${getSkillColor(bot.skill_level)}`}>
                              {bot.skill_level.charAt(0).toUpperCase() + bot.skill_level.slice(1)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Win Rate:</span>
                            <span className={`ml-1 font-medium ${getWinRateColor(bot.win_rate)}`}>
                              {bot.win_rate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Games:</span>
                            <span className="ml-1 font-medium text-gray-900">{bot.games_played}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Won:</span>
                            <span className="ml-1 font-medium text-gray-900">{bot.games_won}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditBot(bot)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleBotStatus(bot.id, bot.is_enabled)}
                        className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          bot.is_enabled
                            ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                            : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        }`}
                      >
                        {bot.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteBot(bot.id)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
