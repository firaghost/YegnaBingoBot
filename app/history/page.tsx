"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Transaction {
  id: string
  type: 'stake' | 'win' | 'deposit' | 'withdrawal'
  amount: number
  game_id: string | null
  created_at: string
  status: string
  games?: {
    rooms: {
      name: string
    }
  }
}

interface GameHistory {
  id: string
  room_id: string
  status: string
  stake: number
  prize_pool: number
  winner_id: string | null
  started_at: string
  ended_at: string | null
  rooms: {
    name: string
    color: string
  }
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'transactions' | 'games'>('transactions')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!user) return

    const fetchHistory = async () => {
      try {
        // Fetch transactions
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select(`
            *,
            games (
              rooms (
                name
              )
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (txError) throw txError
        setTransactions(txData || [])

        // Fetch game history
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select(`
            *,
            rooms (
              name,
              color
            )
          `)
          .contains('players', [user.id])
          .order('started_at', { ascending: false })
          .limit(50)

        if (gamesError) throw gamesError
        setGameHistory(gamesData || [])
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [user])

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/lobby" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Lobby
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4 text-gray-800">
          📜 Game History
        </h1>
        <p className="text-center text-gray-600 mb-8">
          View your complete transaction and game history
        </p>

        {/* User Stats Summary */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total Games</p>
                <p className="text-2xl font-bold text-blue-600">{user.games_played}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Games Won</p>
                <p className="text-2xl font-bold text-green-600">{user.games_won}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total Winnings</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(user.total_winnings)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'transactions'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              💰 Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('games')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'games'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎮 Games ({gameHistory.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          {activeTab === 'transactions' ? (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-bold mb-6 text-gray-800">Transaction History</h3>
              
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">💳</div>
                  <p className="text-xl">No transactions yet</p>
                  <p className="text-sm mt-2">Start playing to see your history!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          tx.type === 'win' ? 'bg-green-500' :
                          tx.type === 'stake' ? 'bg-red-500' :
                          tx.type === 'deposit' ? 'bg-blue-500' :
                          'bg-orange-500'
                        }`}>
                          {tx.type === 'win' ? '🎉' :
                           tx.type === 'stake' ? '🎮' :
                           tx.type === 'deposit' ? '💰' :
                           '💸'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {tx.type === 'deposit' || tx.type === 'withdrawal' 
                              ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
                              : tx.games?.rooms?.name || 'Game'
                            }
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500">
                              {new Date(tx.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                              tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-bold mb-6 text-gray-800">Game History</h3>
              
              {gameHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">🎰</div>
                  <p className="text-xl">No games played yet</p>
                  <p className="text-sm mt-2">Join a room to start playing!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {gameHistory.map(game => {
                    const isWinner = game.winner_id === user.id
                    const isFinished = game.status === 'finished'
                    
                    return (
                      <div key={game.id} className={`p-5 rounded-lg border-2 transition-all ${
                        isWinner ? 'bg-green-50 border-green-300' :
                        isFinished ? 'bg-red-50 border-red-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              game.status === 'finished' ? 'bg-gray-400' :
                              game.status === 'active' ? 'bg-green-500 animate-pulse' :
                              'bg-yellow-500'
                            }`}></div>
                            <h4 className="font-bold text-lg text-gray-800">{game.rooms.name}</h4>
                          </div>
                          {isFinished && (
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              isWinner ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                              {isWinner ? '🏆 Won' : '😢 Lost'}
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Stake</p>
                            <p className="font-semibold text-gray-800">{formatCurrency(game.stake)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Prize Pool</p>
                            <p className="font-semibold text-green-600">{formatCurrency(game.prize_pool)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Status</p>
                            <p className="font-semibold capitalize text-gray-800">{game.status}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Date</p>
                            <p className="font-semibold text-gray-800">
                              {new Date(game.started_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>

                        {isFinished && game.ended_at && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Game ended: {new Date(game.ended_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
