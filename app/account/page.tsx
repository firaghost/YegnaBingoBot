"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import BottomNav from '@/app/components/BottomNav'
import { LogOut, RefreshCw, Plus, Minus, Gift, Globe, Volume2, FileText, Mail, HelpCircle, ChevronDown } from 'lucide-react'

interface Transaction {
  id: string
  type: 'stake' | 'win' | 'deposit' | 'withdrawal' | 'bonus'
  amount: number
  game_id: string | null
  status: string
  description: string
  created_at: string
  games?: {
    rooms: {
      name: string
    }
  }
}

export default function AccountPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, logout, refreshUser } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [language, setLanguage] = useState('English')

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
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error
        setTransactions(data || [])
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [user])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshUser()
    setTimeout(() => setRefreshing(false), 500)
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const bonusBalance = user.bonus_balance || 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        
        {/* Account Overview */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white text-center mb-2">Account Overview</h1>
          <p className="text-purple-200 text-center text-sm">View your balance and invite friends.</p>
        </div>

        {/* Balance Card */}
        <div className="bg-purple-800 bg-opacity-50 rounded-2xl p-6 mb-4 border border-purple-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-400 text-xl">💰</span>
            <h2 className="text-white font-semibold">Account Balance</h2>
          </div>
          <div className="text-yellow-400 text-4xl font-bold mb-2">
            {formatCurrency(user.balance)}
          </div>
          <div className="text-purple-300 text-sm">
            + {formatCurrency(bonusBalance)} bonus balance
          </div>
        </div>

        {/* Invite Button */}
        <button className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-4 rounded-xl font-semibold mb-6 flex items-center justify-center gap-2 hover:from-purple-500 hover:to-purple-400 transition-all shadow-lg">
          <Gift className="w-5 h-5" />
          <span>Invite and Earn Bonuses</span>
        </button>

        {/* Logged in via Telegram & Logout */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-2 text-purple-300 text-sm">
            <LogOut className="w-4 h-4" />
            <span>Logged in via Telegram</span>
          </div>
          <button 
            onClick={handleLogout}
            className="border border-purple-500 text-purple-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-800 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* Account Balance Details */}
        <div className="bg-purple-800 bg-opacity-50 rounded-2xl p-6 mb-4 border border-purple-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400 text-xl">💳</span>
            <h2 className="text-white font-semibold">Account Balance</h2>
          </div>
          <p className="text-purple-300 text-sm mb-4">Your current balance and bonus funds</p>
          
          {/* Main Balance */}
          <div className="bg-white rounded-xl p-4 mb-3">
            <p className="text-gray-600 text-sm mb-1">Main Balance</p>
            <p className="text-blue-600 text-3xl font-bold">{formatCurrency(user.balance)}</p>
          </div>

          {/* Bonus Balance */}
          <div className="bg-green-50 rounded-xl p-4 mb-4">
            <p className="text-gray-600 text-sm mb-1">Bonus Balance</p>
            <p className="text-green-600 text-3xl font-bold">{formatCurrency(bonusBalance)}</p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={() => router.push('/deposit')}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Deposit</span>
            </button>
            <button 
              onClick={() => router.push('/withdraw')}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <Minus className="w-5 h-5" />
              <span>Withdraw</span>
            </button>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-purple-800 bg-opacity-50 rounded-2xl p-6 mb-4 border border-purple-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400 text-xl">⏱️</span>
            <h2 className="text-white font-semibold">Recent Transactions</h2>
          </div>
          <p className="text-purple-300 text-sm mb-4">Your latest account activity</p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-purple-300">
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="bg-purple-900 bg-opacity-50 rounded-xl p-4 border border-purple-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{tx.description || tx.type}</p>
                      <p className="text-purple-400 text-xs mt-1">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tx.status === 'completed' ? 'bg-green-900 text-green-300' :
                        tx.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="bg-purple-800 bg-opacity-50 rounded-2xl p-6 mb-4 border border-purple-700">
          <h2 className="text-white font-semibold mb-2">Preferences</h2>
          <p className="text-purple-300 text-sm mb-4">Customize your app experience.</p>

          {/* Language */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">Language</span>
            </div>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-purple-900 text-white border border-purple-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-400"
            >
              <option>English</option>
              <option>Amharic</option>
              <option>Oromo</option>
            </select>
          </div>

          {/* Sound Settings */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">Sound Settings</span>
            </div>
            <div className="flex items-center justify-between bg-purple-900 rounded-lg px-4 py-3">
              <span className="text-white">Sound On</span>
              <button
                onClick={() => setSoundOn(!soundOn)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  soundOn ? 'bg-yellow-500' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    soundOn ? 'translate-x-7' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Important Information */}
        <div className="bg-purple-800 bg-opacity-50 rounded-2xl p-6 border border-purple-700">
          <h2 className="text-white font-semibold mb-4">Important Information</h2>
          
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between bg-purple-900 bg-opacity-50 rounded-lg px-4 py-3 hover:bg-purple-900 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-yellow-400" />
                <span className="text-white">Terms and Conditions</span>
              </div>
              <ChevronDown className="w-5 h-5 text-purple-400" />
            </button>

            <button className="w-full flex items-center justify-between bg-purple-900 bg-opacity-50 rounded-lg px-4 py-3 hover:bg-purple-900 transition-colors">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-yellow-400" />
                <span className="text-white">Contact Support</span>
              </div>
              <ChevronDown className="w-5 h-5 text-purple-400" />
            </button>

            <button className="w-full flex items-center justify-between bg-purple-900 bg-opacity-50 rounded-lg px-4 py-3 hover:bg-purple-900 transition-colors">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-yellow-400" />
                <span className="text-white">Frequently Asked Questions (FAQ)</span>
              </div>
              <ChevronDown className="w-5 h-5 text-purple-400" />
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
