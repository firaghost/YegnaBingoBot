"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { getConfig } from '@/lib/admin-config'
import BottomNav from '@/app/components/BottomNav'
import { LuLogOut, LuRefreshCw, LuPlus, LuMinus, LuGift, LuUser, LuCoins, LuHistory, LuChevronRight, LuGlobe, LuFileText, LuMail, LuCircleHelp, LuX, LuCheck } from 'react-icons/lu'

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
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showFaqModal, setShowFaqModal] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const [supportInfo, setSupportInfo] = useState({
    email: 'support@bingox.com',
    telegram: '@bingox_support',
    phone: '+251 911 234 567'
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Fetch support information from database
  useEffect(() => {
    const fetchSupportInfo = async () => {
      try {
        const [email, telegram, phone] = await Promise.all([
          getConfig('support_email'),
          getConfig('telegram_support'),
          getConfig('support_phone')
        ])

        setSupportInfo({
          email: email || 'support@bingox.com',
          telegram: telegram || '@bingox_support',
          phone: phone || '+251 911 234 567'
        })
      } catch (error) {
        console.error('Error fetching support info:', error)
        // Keep default values if fetch fails
      }
    }

    fetchSupportInfo()
  }, [])


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

  const handleUsernameUpdate = async () => {
    if (!user || !newUsername.trim() || newUsername.length < 3) {
      alert('Username must be at least 3 characters long')
      return
    }

    setUpdatingUsername(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ username: newUsername.trim() })
        .eq('id', user.id)

      if (error) throw error

      await refreshUser()
      setShowUsernameModal(false)
      setNewUsername('')
      alert('Username updated successfully!')
    } catch (error: any) {
      console.error('Error updating username:', error)
      alert(error.message || 'Failed to update username')
    } finally {
      setUpdatingUsername(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const bonusBalance = user.bonus_balance || 0
  const totalBalance = user.balance + bonusBalance

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Language Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowLanguageModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Select Language</h3>
              <button onClick={() => setShowLanguageModal(false)} className="text-slate-400 hover:text-slate-600">
                <LuX className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-2">
              {['English', 'Amharic', 'Oromo'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang)
                    setShowLanguageModal(false)
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                    language === lang 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-900">{lang}</span>
                  {language === lang && <LuCheck className="w-5 h-5 text-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Username Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowUsernameModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Edit Username</h3>
              <button onClick={() => setShowUsernameModal(false)} className="text-slate-400 hover:text-slate-600">
                <LuX className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  maxLength={20}
                />
                <p className="text-xs text-slate-500 mt-1">Minimum 3 characters, maximum 20 characters</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUsernameModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUsernameUpdate}
                  disabled={updatingUsername || !newUsername.trim() || newUsername.length < 3}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {updatingUsername ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Username'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Terms & Conditions</h3>
              <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600">
                <LuX className="w-6 h-6" />
              </button>
            </div>
            <div className="prose prose-sm text-slate-600">
              <p className="mb-4">Welcome to BingoX. By using our service, you agree to these terms and conditions.</p>
              <h4 className="font-semibold text-slate-900 mb-2">1. Account Usage</h4>
              <p className="mb-4">You must be 18 years or older to use this service. You are responsible for maintaining the security of your account.</p>
              <h4 className="font-semibold text-slate-900 mb-2">2. Game Rules</h4>
              <p className="mb-4">All games must be played fairly. Any form of cheating or manipulation will result in account suspension.</p>
              <h4 className="font-semibold text-slate-900 mb-2">3. Payments</h4>
              <p className="mb-4">All deposits and withdrawals are subject to verification. Processing times may vary.</p>
              <h4 className="font-semibold text-slate-900 mb-2">4. Responsible Gaming</h4>
              <p>Please play responsibly. If you feel you have a gambling problem, please seek help.</p>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowSupportModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Contact Support</h3>
              <button onClick={() => setShowSupportModal(false)} className="text-slate-400 hover:text-slate-600">
                <LuX className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <a href={`mailto:${supportInfo.email}`} className="text-blue-500 hover:text-blue-600">{supportInfo.email}</a>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Telegram</label>
                <a href={`https://t.me/${supportInfo.telegram.replace('@', '')}`} className="text-blue-500 hover:text-blue-600">{supportInfo.telegram}</a>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <a href={`tel:${supportInfo.phone.replace(/\s/g, '')}`} className="text-blue-500 hover:text-blue-600">{supportInfo.phone}</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFaqModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowFaqModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Frequently Asked Questions</h3>
              <button onClick={() => setShowFaqModal(false)} className="text-slate-400 hover:text-slate-600">
                <LuX className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">How do I deposit money?</h4>
                <p className="text-sm text-slate-600">Go to the Deposit page, enter the amount, and follow the payment instructions. Your balance will be updated after verification.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">How long do withdrawals take?</h4>
                <p className="text-sm text-slate-600">Withdrawals are typically processed within 24-48 hours after approval.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What is bonus balance?</h4>
                <p className="text-sm text-slate-600">Bonus balance is promotional credit that can be used to play games. It cannot be withdrawn directly.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">How do I claim the daily streak bonus?</h4>
                <p className="text-sm text-slate-600">Play games daily for 5 consecutive days, then go to the Bonus page to claim your reward.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuUser className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-900">Account</h1>
          </div>
          <button 
            onClick={handleLogout}
            className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
          >
            <LuLogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        
        {/* User Info */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <LuUser className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{user.username || 'User'}</h2>
                  <button
                    onClick={() => {
                      setNewUsername(user.username || '')
                      setShowUsernameModal(true)
                    }}
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-slate-500">Telegram ID: {user.telegram_id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Overview */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Total Balance</h3>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              <LuRefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="text-3xl font-bold text-slate-900 mb-4">
            {formatCurrency(totalBalance)}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Main Balance</div>
              <div className="text-lg font-semibold text-slate-900">{formatCurrency(user.balance)}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <div className="text-xs text-emerald-600 mb-1">Bonus Balance</div>
              <div className="text-lg font-semibold text-emerald-600">{formatCurrency(bonusBalance)}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button 
            onClick={() => router.push('/deposit')}
            className="bg-emerald-500 text-white py-3 rounded-lg font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <LuPlus className="w-5 h-5" />
            <span>Deposit</span>
          </button>
          <button 
            onClick={() => router.push('/withdraw')}
            className="bg-slate-700 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <LuMinus className="w-5 h-5" />
            <span>Withdraw</span>
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LuHistory className="w-5 h-5 text-slate-600" />
              <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 5).map((tx) => {
                const getTransactionLabel = () => {
                  switch (tx.type) {
                    case 'stake': return 'Game Entry'
                    case 'win': return 'Game Win'
                    case 'deposit': return 'Deposit'
                    case 'withdrawal': return 'Withdrawal'
                    case 'bonus': return 'Bonus'
                    default: return tx.type
                  }
                }

                const isPositive = tx.type === 'win' || tx.type === 'deposit' || tx.type === 'bonus'

                return (
                  <div key={tx.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {tx.description || getTransactionLabel()}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        isPositive ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {isPositive ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        tx.status === 'pending' ? 'bg-orange-50 text-orange-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Settings & Support */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Settings & Support</h3>
          
          <div className="space-y-2">
            {/* Language */}
            <button 
              onClick={() => setShowLanguageModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuGlobe className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-900">Language</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{language}</span>
                <LuChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>

            {/* Terms and Conditions */}
            <button 
              onClick={() => setShowTermsModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuFileText className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-900">Terms & Conditions</span>
              </div>
              <LuChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Contact Support */}
            <button 
              onClick={() => setShowSupportModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuMail className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-900">Contact Support</span>
              </div>
              <LuChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* FAQ */}
            <button 
              onClick={() => setShowFaqModal(true)}
              className="w-full flex items-center justify-between py-3 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuCircleHelp className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-900">FAQ</span>
              </div>
              <LuChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  )
}
