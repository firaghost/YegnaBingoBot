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
  games?: {
    rooms: {
      name: string
    }
  }
}

export default function AccountPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, refreshUser } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!user) return

    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
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
          .limit(20)

        if (error) throw error
        setTransactions(data || [])
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
    refreshUser()
  }, [user, refreshUser])

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const winRate = user.games_played > 0 ? ((user.games_won / user.games_played) * 100).toFixed(1) : '0.0'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/lobby" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Lobby
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12 text-gray-800">
          My Account
        </h1>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold mb-4">
                  {user.username.charAt(0)}
                </div>
                <h2 className="text-2xl font-bold text-gray-800">{user.username}</h2>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(user.balance)}</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Games Played:</span>
                  <span className="font-bold text-lg">{user.games_played}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Games Won:</span>
                  <span className="font-bold text-lg text-green-600">{user.games_won}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Win Rate:</span>
                  <span className="font-bold text-lg text-blue-600">{winRate}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Total Winnings:</span>
                  <span className="font-bold text-lg text-purple-600">{formatCurrency(user.total_winnings)}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center mb-4">
                  Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/deposit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold text-center transition-all">
                    💰 Deposit
                  </Link>
                  <Link href="/withdraw" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold text-center transition-all">
                    💸 Withdraw
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-gray-800">Transaction History</h3>
              
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                        tx.type === 'win' ? 'bg-green-500' :
                        tx.type === 'stake' ? 'bg-red-500' :
                        'bg-blue-500'
                      }`}>
                        {tx.type === 'win' ? '🎉' :
                         tx.type === 'stake' ? '🎮' :
                         '💰'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {tx.type === 'deposit' || tx.type === 'withdrawal' 
                            ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
                            : tx.games?.rooms?.name || 'Game'
                          }
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(tx.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
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

              {transactions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-xl">No transactions yet</p>
                  <p className="text-sm mt-2">Start playing to see your history!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
