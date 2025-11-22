"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useLocalStorage('rooms_search', '')
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    stake: '',
    max_players: '',
    description: '',
    color: 'from-blue-500 to-blue-700',
    default_level: 'medium'
  })

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
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('stake', { ascending: true })

      if (error) throw error
      setRooms(data || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const toggleRoomStatus = async (roomId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      const { error } = await supabase
        .from('rooms')
        .update({ status: newStatus })
        .eq('id', roomId)

      if (error) throw error
      
      showNotification('success', `Room ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`)
      fetchRooms()
    } catch (error) {
      console.error('Error updating room:', error)
      showNotification('error', 'Failed to update room status')
    }
  }

  

  const handleCreateRoom = () => {
    setEditingRoom(null)
    setFormData({
      id: '',
      name: '',
      stake: '',
      max_players: '',
      description: '',
      color: 'from-blue-500 to-blue-700',
      default_level: 'medium'
    })
    setShowCreateModal(true)
  }

  const handleEditRoom = (room: any) => {
    setEditingRoom(room)
    setFormData({
      id: room.id,
      name: room.name,
      stake: room.stake.toString(),
      max_players: room.max_players.toString(),
      description: room.description || '',
      color: room.color || 'from-blue-500 to-blue-700',
      default_level: room.default_level || 'medium'
    })
    setShowCreateModal(true)
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const roomData = {
        name: formData.name,
        stake: parseFloat(formData.stake),
        max_players: parseInt(formData.max_players),
        description: formData.description,
        color: formData.color,
        prize_pool: 0, // Set to 0 - will be calculated dynamically
        default_level: formData.default_level,
        game_level: formData.default_level, // Also set game_level
        status: 'active',
        current_players: 0
      }

      if (editingRoom) {

        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id)
        
        if (error) throw error
        alert('Room updated successfully!')
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert({
            ...roomData,
            id: formData.id
          })
        
        if (error) throw error
        alert('Room created successfully!')
      }

      setShowCreateModal(false)
      fetchRooms()
    } catch (error) {
      console.error('Error saving room:', error)
      alert('Failed to save room')
    }
  }

  const doDeleteRoom = async (roomId: string) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)

      if (error) {
        console.error('Error deleting room:', error)

        if ((error as any).code === '23503') {
          showNotification(
            'error',
            'Cannot delete room due to foreign key constraints. Please run the SQL fix script in Supabase first.',
          )
        } else {
          showNotification('error', `Failed to delete room: ${error.message}`)
        }
        return
      }

      showNotification('success', 'Room deleted successfully!')
      fetchRooms()
    } catch (error: any) {
      console.error('Error deleting room:', error)
      showNotification('error', `Failed to delete room: ${error?.message || 'Unknown error'}`)
    }
  }

  const handleDeleteRoom = (roomId: string) => {
    const message =
      `Are you sure you want to delete room "${roomId}"?` +
      '\n\nThis will permanently delete the room and all associated games, players, and data.' +
      '\n\nThis action cannot be undone.'

    setConfirmConfig({
      title: 'Delete room',
      message,
      confirmLabel: 'Delete room',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void doDeleteRoom(roomId)
      },
    })
    setConfirmOpen(true)
  }

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top ${
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">Rooms Management</h1>
                <p className="text-slate-400 text-sm mt-1">Create, edit, and manage game rooms</p>
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <span>+</span> New Room
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search rooms by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">Total Rooms</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{rooms.length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">Active Rooms</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1">{rooms.filter(r => r.status === 'active').length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-3 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">Avg Entry Fee</p>
            <p className="text-2xl sm:text-3xl font-bold text-cyan-400 mt-1">{formatCurrency(rooms.length > 0 ? rooms.reduce((sum, r) => sum + r.stake, 0) / rooms.length : 0)}</p>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              Loading rooms...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="col-span-full bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-12 text-center text-slate-400">
              {searchTerm ? 'No rooms match your search' : 'No rooms found'}
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div key={room.id} className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-4 sm:p-5 hover:border-slate-600/50 transition-all group">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{room.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 truncate">ID: {room.id}</p>
                  </div>
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                    room.status === 'active' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-slate-600/20 text-slate-400 border border-slate-600/30'
                  }`}>
                    {room.status === 'active' ? '● Active' : '○ Inactive'}
                  </span>
                </div>

                {/* Description */}
                {room.description && (
                  <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4 line-clamp-2">{room.description}</p>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-slate-700/30">
                  <div>
                    <p className="text-xs text-slate-500">Entry Fee</p>
                    <p className="text-xs sm:text-sm font-semibold text-cyan-400">{formatCurrency(room.stake)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Max Players</p>
                    <p className="text-xs sm:text-sm font-semibold text-white">{room.max_players}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Difficulty</p>
                    <p className="text-xs sm:text-sm font-semibold">
                      {(room.game_level || room.default_level) === 'easy' ? '🟢 Easy' : 
                       (room.game_level || room.default_level) === 'hard' ? '🔴 Hard' : '🟡 Medium'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Prize Pool</p>
                    <p className="text-xs sm:text-sm font-semibold text-emerald-400">Dynamic</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    onClick={() => handleEditRoom(room)}
                    className="bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-600/30 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg font-semibold transition-colors text-xs"
                    title="Edit room"
                  >
                    ✎ Edit
                  </button>
                  <button
                    onClick={() => toggleRoomStatus(room.id, room.status)}
                    className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg font-semibold transition-colors text-xs border ${
                      room.status === 'active'
                        ? 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border-amber-600/30'
                        : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border-emerald-600/30'
                    }`}
                    title={room.status === 'active' ? 'Disable room' : 'Enable room'}
                  >
                    {room.status === 'active' ? '⊘' : '✓'}
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg font-semibold transition-colors text-xs"
                    title="Delete room"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-1">
              {editingRoom ? 'Edit Room' : 'Create New Room'}
            </h2>
            <p className="text-slate-400 text-sm mb-6">Manage room settings and configurations</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Room ID</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({...formData, id: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="speed-bingo"
                  disabled={!!editingRoom}
                  required={!editingRoom}
                />
                <p className="text-xs text-slate-500 mt-1">Unique identifier (cannot be changed)</p>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Room Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="Speed Bingo"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Entry Fee (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stake}
                  onChange={(e) => setFormData({...formData, stake: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="5.00"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Max Players</label>
                <input
                  type="number"
                  value={formData.max_players}
                  onChange={(e) => setFormData({...formData, max_players: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="200"
                  required
                />
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>💡</span>
                  <label className="text-cyan-300 font-medium text-sm">Prize Pool</label>
                </div>
                <p className="text-cyan-200/80 text-xs">
                  Calculated dynamically: Entry Fee × Waiting Players × 90%
                </p>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="Fast-paced action! Numbers called every 2 seconds."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Default Difficulty</label>
                <select
                  value={formData.default_level}
                  onChange={(e) => setFormData({...formData, default_level: e.target.value})}
                  className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
                >
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
                <p className="text-slate-400 text-xs mt-1">Players can choose their preferred difficulty when joining</p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-semibold transition-colors"
                >
                  {editingRoom ? 'Update Room' : 'Create Room'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg font-semibold transition-colors"
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
