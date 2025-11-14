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
  waiting_players: number
  status: 'active' | 'waiting'
  description: string
  color: string
  prize_pool: number
  base_prize_pool: number
  game_level: string
}

export default function LobbyPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false)
  const [insufficientBalanceMessage, setInsufficientBalanceMessage] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchRooms()
    
    // Subscribe to real-time updates
    const roomsChannel = supabase
      .channel('lobby-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rooms' 
      }, (payload) => {
        console.log('🏠 Room update:', payload)
        handleRoomUpdate(payload)
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games' 
      }, (payload) => {
        console.log('🎮 Game update:', payload)
        handleGameUpdate(payload)
      })
      .subscribe()

    // Refresh room data every 30 seconds as fallback
    const intervalId = setInterval(() => {
      fetchRooms()
    }, 30000)

    return () => {
      roomsChannel.unsubscribe()
      clearInterval(intervalId)
    }
  }, [])

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'active')
        .order('stake', { ascending: true })

      if (error) throw error
      
      // Remove duplicates by ID and enhance with waiting players info
      const uniqueRooms = (data || []).filter((room, index, self) => 
        index === self.findIndex(r => r.id === room.id)
      )

      // Get waiting players for each room
      const enhancedRooms = await Promise.all(
        uniqueRooms.map(async (room) => {
          try {
            // Get active games for this room to count waiting players
            const { data: activeGames } = await supabase
              .from('games')
              .select('players, status')
              .eq('room_id', room.id)
              .in('status', ['waiting', 'countdown'])
              .order('created_at', { ascending: false })
              .limit(1)

            const waitingPlayers = activeGames?.[0]?.players?.length || 0
            
            // Calculate dynamic prize pool based on waiting players (gross, before commission)
            const basePrizePool = room.stake * room.max_players
            const dynamicPrizePool = waitingPlayers > 0 
              ? room.stake * waitingPlayers
              : 0 // Show 0 when no players waiting

            return {
              ...room,
              waiting_players: waitingPlayers,
              base_prize_pool: basePrizePool,
              prize_pool: Math.round(dynamicPrizePool * 100) / 100, // Round to 2 decimals
              game_level: room.game_level || room.default_level || 'medium'
            }
          } catch (err) {
            console.error(`Error fetching data for room ${room.id}:`, err)
            return {
              ...room,
              waiting_players: 0,
              base_prize_pool: room.prize_pool || room.stake * room.max_players,
              game_level: room.game_level || room.default_level || 'medium'
            }
          }
        })
      )
      
      setRooms(enhancedRooms)
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle real-time room updates
  const handleRoomUpdate = async (payload: any) => {
    const { eventType, new: newRoom, old: oldRoom } = payload
    
    setIsUpdating(true)
    
    if (eventType === 'UPDATE' && newRoom) {
      // Update specific room in state
      setRooms(prevRooms => 
        prevRooms.map(room => 
          room.id === newRoom.id 
            ? { ...room, ...newRoom, game_level: newRoom.game_level || newRoom.default_level || 'medium' }
            : room
        )
      )
    } else if (eventType === 'INSERT' && newRoom && newRoom.status === 'active') {
      // Add new room
      const enhancedRoom = {
        ...newRoom,
        waiting_players: 0,
        base_prize_pool: newRoom.stake * newRoom.max_players * 0.9,
        prize_pool: 0,
        game_level: newRoom.game_level || newRoom.default_level || 'medium'
      }
      setRooms(prevRooms => [...prevRooms, enhancedRoom].sort((a, b) => a.stake - b.stake))
    } else if (eventType === 'DELETE' && oldRoom) {
      // Remove room
      setRooms(prevRooms => prevRooms.filter(room => room.id !== oldRoom.id))
    }
    
    setTimeout(() => setIsUpdating(false), 1000)
  }

  // Handle real-time game updates (affects waiting players)
  const handleGameUpdate = async (payload: any) => {
    const { eventType, new: newGame, old: oldGame } = payload
    
    // Only update if it's a game status change that affects waiting players
    if (newGame?.room_id && ['waiting', 'countdown', 'active', 'finished'].includes(newGame.status)) {
      await updateRoomWaitingPlayers(newGame.room_id)
    } else if (oldGame?.room_id && eventType === 'DELETE') {
      await updateRoomWaitingPlayers(oldGame.room_id)
    }
  }

  // Update waiting players for a specific room
  const updateRoomWaitingPlayers = async (roomId: string) => {
    try {
      const { data: activeGames } = await supabase
        .from('games')
        .select('players, status')
        .eq('room_id', roomId)
        .in('status', ['waiting', 'countdown'])
        .order('created_at', { ascending: false })
        .limit(1)

      const waitingPlayers = activeGames?.[0]?.players?.length || 0

      // Update the specific room in state
      setRooms(prevRooms => 
        prevRooms.map(room => {
          if (room.id === roomId) {
            const dynamicPrizePool = waitingPlayers > 0 
              ? room.stake * waitingPlayers
              : 0
            
            return {
              ...room,
              waiting_players: waitingPlayers,
              prize_pool: Math.round(dynamicPrizePool * 100) / 100
            }
          }
          return room
        })
      )
    } catch (error) {
      console.error('Error updating waiting players:', error)
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

      {/* Sticky Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuZap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">BingoX</h1>
            {isUpdating && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline">Live</span>
              </div>
            )}
          </div>
          {user && (
            <div className="text-xs sm:text-sm font-bold text-slate-900 bg-slate-100 px-2 sm:px-3 py-1 rounded-lg">
              Balance {formatCurrency(user.balance + (user.bonus_balance || 0))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 sm:mb-6">
          Game Rooms
        </h2>

        {!isAuthenticated && (
          <div className="mb-4 sm:mb-6 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <LuLock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-slate-900">
              Login Required
            </h3>
            <p className="text-slate-600 mb-3 sm:mb-4 text-sm">
              Connect with Telegram to start playing
            </p>
            <Link href="/login">
              <button className="bg-blue-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm w-full">
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
          <div className="space-y-3 sm:space-y-4">
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
                <div key={room.id} className={`bg-white rounded-xl p-4 sm:p-5 border border-slate-200 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md ${isUpdating ? 'ring-2 ring-blue-200 ring-opacity-50' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        index % 4 === 0 ? 'bg-emerald-100' :
                        index % 4 === 1 ? 'bg-blue-100' :
                        index % 4 === 2 ? 'bg-purple-100' :
                        'bg-orange-100'
                      }`}>
                        <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${
                          index % 4 === 0 ? 'text-emerald-600' :
                          index % 4 === 1 ? 'text-blue-600' :
                          index % 4 === 2 ? 'text-purple-600' :
                          'text-orange-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{room.name}</h3>
                        <p className="text-xs sm:text-sm text-slate-500 truncate mt-0.5">{room.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center sm:text-left">
                      <div className="text-slate-500 text-xs mb-1">Entry Fee</div>
                      <div className="font-bold text-slate-900 text-sm sm:text-base">{formatCurrency(room.stake)}</div>
                    </div>
                    <div className="text-center sm:text-right">
                      <div className="text-slate-500 text-xs mb-1">Prize Pool</div>
                      <div className="font-bold text-emerald-600 text-sm sm:text-base">{formatCurrency(room.prize_pool)}</div>
                    </div>
                  </div>

                  {/* Waiting Players Info */}
                  <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 rounded-lg">
                    <LuUsers className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600">
                      {room.waiting_players > 0 
                        ? `${room.waiting_players} waiting` 
                        : 'No players waiting'
                      }
                    </span>
                  </div>

                  {authLoading ? (
                    <button 
                      disabled
                      className="w-full bg-slate-200 text-slate-400 py-3 sm:py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-not-allowed text-sm sm:text-base"
                    >
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </button>
                  ) : isAuthenticated ? (
                    hasInsufficientBalance ? (
                      <button 
                        onClick={() => handleInsufficientBalance(room.stake)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 sm:py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg hover:shadow-xl"
                      >
                        <LuCoins className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Insufficient Balance</span>
                      </button>
                    ) : (
                      <Link href={`/game/${room.id}`}>
                        <button 
                          className={`w-full ${roomStyle.bg} hover:opacity-90 text-white py-3 sm:py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base shadow-lg hover:shadow-xl`}
                        >
                          <LuPlay className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>
                            {room.waiting_players > 0 
                              ? `Join ${room.waiting_players} Player${room.waiting_players > 1 ? 's' : ''}` 
                              : 'Join Game'
                            }
                          </span>
                        </button>
                      </Link>
                    )
                  ) : (
                    <Link href="/login">
                      <button className="w-full bg-slate-100 text-slate-600 py-3 sm:py-3.5 rounded-xl font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 border border-slate-200 text-sm sm:text-base">
                        <LuLock className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Connect to Play</span>
                      </button>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {rooms.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-12 sm:py-16">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LuTrophy className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
            </div>
            <p className="text-lg sm:text-xl font-medium text-slate-600 mb-2">No rooms available</p>
            <p className="text-sm text-slate-500">Please check back later for new games!</p>
          </div>
        )}
      </div>
      
      <BottomNav />
    </div>
  )
}
