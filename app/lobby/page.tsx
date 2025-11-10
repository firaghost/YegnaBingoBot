"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import BottomNav from '@/app/components/BottomNav'

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
  const { user, isAuthenticated, loading: authLoading } = useAuth()
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
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-yellow-400">
          Select Your Bingo Room
        </h1>

        {!isAuthenticated && (
          <div className="mb-8 bg-purple-800 bg-opacity-50 border-2 border-purple-600 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold mb-3 text-white">
              Log in with Telegram to play!
            </h3>
            <p className="text-purple-200 mb-6">
              Welcome! Please log in to join games and win amazing prizes.
            </p>
            <Link href="/login">
              <button className="bg-yellow-500 text-purple-900 px-8 py-3 rounded-lg font-bold hover:bg-yellow-400 transition-colors">
                Login with Telegram
              </button>
            </Link>
          </div>
        )}

        {(loading || authLoading) ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map(room => {
              const hasInsufficientBalance = user && (user.balance + (user.bonus_balance || 0)) < room.stake
              const roomIcon = room.stake <= 10 ? '🛡️' : room.stake <= 50 ? '🛡️' : room.stake <= 100 ? '💎' : '⭐'
              
              return (
                <div key={room.id} className="bg-purple-800 bg-opacity-50 rounded-2xl p-6 border-2 border-purple-700">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-2">{room.name}</h3>
                      <p className="text-purple-200 text-sm">{room.description}</p>
                    </div>
                    <div className="text-4xl">{roomIcon}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-300 text-sm">💰 Stake:</span>
                      <span className="text-white font-bold">{formatCurrency(room.stake)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-purple-300 text-sm">🏆 Estimated Win:</span>
                      <span className="text-white font-bold">{formatCurrency(room.prize_pool)}</span>
                    </div>
                  </div>

                  {hasInsufficientBalance && isAuthenticated && (
                    <div className="bg-red-600 text-white px-4 py-3 rounded-lg mb-4 text-sm">
                      <strong>Insufficient Balance</strong>
                      <br />
                      You need at least {formatCurrency(room.stake)} to join this room. Your current balance is {formatCurrency(user.balance + (user.bonus_balance || 0))}. Please deposit first.
                    </div>
                  )}

                  {authLoading ? (
                    <button 
                      disabled
                      className="w-full bg-gray-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                    >
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </button>
                  ) : isAuthenticated ? (
                    <Link href={hasInsufficientBalance ? '/deposit' : `/game/${room.id}`}>
                      <button 
                        className="w-full bg-yellow-500 text-purple-900 py-4 rounded-xl font-bold hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
                      >
                        <span>⭐</span>
                        <span>{hasInsufficientBalance ? 'Deposit' : 'Play'}</span>
                        <span>⭐</span>
                      </button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <button className="w-full bg-gray-600 text-white py-4 rounded-xl font-bold hover:bg-gray-500 transition-colors flex items-center justify-center gap-2">
                        <span>🔒 Login to Play</span>
                      </button>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {rooms.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <div className="text-6xl mb-4">🎰</div>
            <p className="text-xl">No rooms available at the moment. Please check back later!</p>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  )
}
