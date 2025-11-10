"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-2xl text-white hover:opacity-70">←</Link>
              <h1 className="text-2xl font-bold text-white">Room Management</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
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
                </div>

                <button
                  onClick={() => toggleRoomStatus(room.id, room.status)}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    room.status === 'active'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {room.status === 'active' ? 'Deactivate Room' : 'Activate Room'}
                </button>
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
    </div>
  )
}
