"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import BottomNav from '@/app/components/BottomNav'
import { LuZap, LuUsers, LuTrophy, LuLock, LuCoins, LuPlay, LuStar, LuX } from 'react-icons/lu'

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
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false)
  const [insufficientBalanceMessage, setInsufficientBalanceMessage] = useState('')

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

  const handleInsufficientBalance = (stake: number) => {
    const currentBalance = user ? user.balance + (user.bonus_balance || 0) : 0
    setInsufficientBalanceMessage(
      `You need at least ${formatCurrency(stake)} to join this room. Your current balance is ${formatCurrency(currentBalance)}. Please deposit first.`
    )
    setShowInsufficientBalance(true)
    setTimeout(() => setShowInsufficientBalance(false), 5000)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Insufficient Balance Popup */}
      {showInsufficientBalance && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top">
          <div className="max-w-md mx-auto bg-red-500 text-white rounded-xl p-4 shadow-lg flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Insufficient Balance</h3>
              <p className="text-sm text-red-50">{insufficientBalanceMessage}</p>
            </div>
            <button onClick={() => setShowInsufficientBalance(false)} className="text-white hover:text-red-100">
              <LuX className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Simple Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuZap className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-900">BingoX</h1>
          </div>
          {user && (
            <div className="text-sm font-bold text-slate-900">
              Balance {formatCurrency(user.balance + (user.bonus_balance || 0))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Game Rooms
        </h2>

        {!isAuthenticated && (
          <div className="mb-6 bg-white rounded-2xl p-6 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LuLock className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-slate-900">
              Login Required
            </h3>
            <p className="text-slate-600 mb-4 text-sm">
              Connect with Telegram to start playing
            </p>
            <Link href="/login">
              <button className="bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm w-full">
                Connect Telegram
              </button>
            </Link>
          </div>
        )}

        {(loading || authLoading) ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room, index) => {
              const hasInsufficientBalance = user && (user.balance + (user.bonus_balance || 0)) < room.stake
              const roomColors = [
                { bg: 'bg-emerald-500', icon: LuZap },
                { bg: 'bg-blue-500', icon: LuUsers },
                { bg: 'bg-purple-500', icon: LuTrophy },
                { bg: 'bg-orange-500', icon: LuStar },
              ]
              const roomStyle = roomColors[index % roomColors.length]
              const IconComponent = roomStyle.icon
              
              return (
                <div key={room.id} className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <IconComponent className={`w-8 h-8 flex-shrink-0 ${
                        index % 4 === 0 ? 'text-emerald-500' :
                        index % 4 === 1 ? 'text-blue-500' :
                        index % 4 === 2 ? 'text-purple-500' :
                        'text-orange-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 truncate">{room.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{room.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs mb-0.5">Entry</div>
                      <div className="font-semibold text-slate-900">{formatCurrency(room.stake)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500 text-xs mb-0.5">Prize</div>
                      <div className="font-semibold text-emerald-600">{formatCurrency(room.prize_pool)}</div>
                    </div>
                  </div>

                  {authLoading ? (
                    <button 
                      disabled
                      className="w-full bg-slate-200 text-slate-400 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </button>
                  ) : isAuthenticated ? (
                    hasInsufficientBalance ? (
                      <button 
                        onClick={() => handleInsufficientBalance(room.stake)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <LuPlay className="w-4 h-4" />
                        <span>Join Game</span>
                      </button>
                    ) : (
                      <Link href={`/game/${room.id}`}>
                        <button 
                          className={`w-full ${roomStyle.bg} hover:opacity-90 text-white py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2`}
                        >
                          <LuPlay className="w-4 h-4" />
                          <span>Join Game</span>
                        </button>
                      </Link>
                    )
                  ) : (
                    <Link href="/login">
                      <button className="w-full bg-slate-100 text-slate-600 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 border border-slate-200">
                        <LuLock className="w-4 h-4" />
                        <span>Login</span>
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
