"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

interface Room {
  id: string
  name: string
  stake: number
  max_players: number
  current_players: number
  status: 'active' | 'waiting'
  description: string
  color: string
  prize_pool: number
}

export default function LobbyPage() {
  const { user, isAuthenticated } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRooms()
    
    // Subscribe to room updates
    const subscription = supabase
      .channel('rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800">
          Select Your Bingo Room
        </h1>

        {!isAuthenticated && (
          <div className="max-w-2xl mx-auto mb-12 bg-blue-50 border-2 border-blue-300 rounded-xl p-8 text-center shadow-lg">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold mb-3 text-gray-800">
              Log in with Telegram to join the royal bingo experience!
            </h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Welcome! Please log in to join games and win amazing prizes.
            </p>
            <Link href="/login">
              <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md">
                Login with Telegram
              </button>
            </Link>
            <p className="text-sm text-gray-500 mt-6">
              You can browse rooms below
            </p>
          </div>
        )}

        {isAuthenticated && user && (
          <div className="max-w-2xl mx-auto mb-12 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Welcome back,</p>
                <p className="text-2xl font-bold text-gray-800">{user.username}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Your Balance</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(user.balance)}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all overflow-hidden transform hover:-translate-y-1">
                <div className={`bg-gradient-to-r ${room.color} p-6 text-white`}>
                  <h3 className="text-2xl font-bold mb-2">{room.name}</h3>
                  <div className="text-sm opacity-90">Entry: {formatCurrency(room.stake)}</div>
                </div>
                
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-600 mb-4">{room.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Players:</span>
                    <span className="font-bold text-lg">{room.current_players}/{room.max_players}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Prize Pool:</span>
                    <span className="font-bold text-lg text-green-600">{formatCurrency(room.prize_pool)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Status:</span>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${room.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                      <span className="text-sm font-medium capitalize">{room.status}</span>
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`bg-gradient-to-r ${room.color} h-3 rounded-full transition-all duration-500`}
                      style={{ width: `${(room.current_players / room.max_players) * 100}%` }}
                    />
                  </div>

                  {isAuthenticated ? (
                    <Link href={`/game/${room.id}`}>
                      <button 
                        disabled={!user || user.balance < room.stake}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{user && user.balance < room.stake ? 'Insufficient Balance' : 'Join Room'}</span>
                        <span>→</span>
                      </button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <button className="w-full bg-gray-400 text-white py-3 rounded-lg font-semibold hover:bg-gray-500 transition-colors shadow-md mt-4 flex items-center justify-center gap-2">
                        <span>Login to Play</span>
                        <span>🔒</span>
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {rooms.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <div className="text-6xl mb-4">🎰</div>
            <p className="text-xl">No rooms available at the moment. Please check back later!</p>
          </div>
        )}
      </div>
    </div>
  )
}
