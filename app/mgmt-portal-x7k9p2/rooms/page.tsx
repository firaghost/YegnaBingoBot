"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    stake: '',
    max_players: '',
    description: '',
    color: 'from-blue-500 to-blue-700',
    default_level: 'medium'
  })

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

  const toggleRoomStatus = async (roomId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      const { error } = await supabase
        .from('rooms')
        .update({ status: newStatus })
        .eq('id', roomId)

      if (error) throw error
      
      alert(`Room ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`)
      fetchRooms()
    } catch (error) {
      console.error('Error updating room:', error)
      alert('Failed to update room status')
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
          .insert(roomData)
        
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

  const handleDeleteRoom = async (roomId: string) => {
    // Simple confirmation
    if (!confirm(`Are you sure you want to delete room "${roomId}"?\n\nThis will permanently delete the room and all associated games, players, and data.\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      // Direct deletion - CASCADE constraints will handle associated data
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)

      if (error) {
        console.error('Error deleting room:', error)
        
        // Check if it's still a foreign key constraint error
        if (error.code === '23503') {
          alert(`Cannot delete room: Foreign key constraint error.\n\nPlease run the database fix first:\n1. Go to Supabase SQL Editor\n2. Run: supabase/fix_foreign_key_constraints.sql\n\nThis will enable automatic deletion of associated data.`)
        } else {
          alert(`Failed to delete room: ${error.message}`)
        }
        return
      }

      alert('Room deleted successfully!')
      fetchRooms()
    } catch (error: any) {
      console.error('Error deleting room:', error)
      alert(`Failed to delete room: ${error?.message || 'Unknown error'}`)
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
              <h1 className="text-2xl font-bold text-white">Room Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Create Room Button */}
        <div className="mb-6">
          <button
            onClick={handleCreateRoom}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Create New Room
          </button>
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              Loading rooms...
            </div>
          ) : rooms.length === 0 ? (
            <div className="col-span-full bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center text-gray-400">
              No rooms found
            </div>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{room.name}</h3>
                    <p className="text-gray-400 text-sm">{room.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    room.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {room.status}
                  </span>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Entry Fee:</span>
                    <span className="font-bold text-white">{formatCurrency(room.stake)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Max Players:</span>
                    <span className="font-bold text-white">{room.max_players}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Current Players:</span>
                    <span className="font-bold text-blue-400">{room.current_players || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Game Level:</span>
                    <span className="font-bold text-white">
                      {(room.game_level || room.default_level) === 'easy' ? '🟢 Easy' : 
                       (room.game_level || room.default_level) === 'hard' ? '🔴 Hard' : '🟡 Medium'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Prize Pool:</span>
                    <span className="font-bold text-blue-400">Dynamic</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEditRoom(room)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleRoomStatus(room.id, room.status)}
                    className={`py-2 rounded-lg font-semibold transition-colors text-sm ${
                      room.status === 'active'
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {room.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Rooms</div>
            <div className="text-3xl font-bold text-white">{rooms.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Active Rooms</div>
            <div className="text-3xl font-bold text-green-400">
              {rooms.filter(r => r.status === 'active').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Players</div>
            <div className="text-3xl font-bold text-blue-400">
              {rooms.reduce((sum, r) => sum + (r.current_players || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingRoom ? 'Edit Room' : 'Create New Room'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Room ID</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({...formData, id: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="speed-bingo"
                  disabled={!!editingRoom}
                  required={!editingRoom}
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Room Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="Speed Bingo"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Entry Fee (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stake}
                  onChange={(e) => setFormData({...formData, stake: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="5.00"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Max Players</label>
                <input
                  type="number"
                  value={formData.max_players}
                  onChange={(e) => setFormData({...formData, max_players: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="200"
                  required
                />
              </div>
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-400">💡</span>
                  <label className="text-blue-300 font-medium">Prize Pool</label>
                </div>
                <p className="text-blue-200 text-sm">
                  Prize pools are now <strong>calculated dynamically</strong> based on waiting players:
                </p>
                <p className="text-blue-100 text-xs mt-1">
                  Prize = (Entry Fee × Waiting Players × 90%)
                </p>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="Fast-paced action! Numbers called every 2 seconds."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Color Gradient</label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="from-blue-500 to-blue-700">Blue</option>
                  <option value="from-green-500 to-green-700">Green</option>
                  <option value="from-purple-500 to-purple-700">Purple</option>
                  <option value="from-red-500 to-red-700">Red</option>
                  <option value="from-yellow-500 to-yellow-700">Yellow</option>
                  <option value="from-pink-500 to-pink-700">Pink</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Default Difficulty Level</label>
                <select
                  value={formData.default_level}
                  onChange={(e) => setFormData({...formData, default_level: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="easy">🟢 Easy (1s intervals, 3 matches, 10 XP)</option>
                  <option value="medium">🟡 Medium (2s intervals, 5 matches, 25 XP)</option>
                  <option value="hard">🔴 Hard (3s intervals, 7 matches, 50 XP)</option>
                </select>
                <p className="text-gray-400 text-sm mt-1">
                  Players can still choose their preferred difficulty when joining
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  {editingRoom ? 'Update Room' : 'Create Room'}
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
