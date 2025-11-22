"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Player } from '@lottiefiles/react-lottie-player'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { getConfig } from '@/lib/admin-config'

// Helper function to get level info from XP (using database system)
function getLevelInfo(xp: number = 0, level_progress?: string) {
  // Use database level_progress if available, otherwise calculate from XP
  const levelName = level_progress || (() => {
    if (xp >= 1000) return 'Legend'
    if (xp >= 600) return 'Master'
    if (xp >= 300) return 'Expert'
    if (xp >= 100) return 'Skilled'
    return 'Beginner'
  })()

  // Calculate numeric level for display
  const numericLevel = Math.floor(xp / 100) + 1
  
  // Get color based on level name
  const getColorByName = (name: string) => {
    switch (name) {
      case 'Legend': return 'from-purple-500 to-purple-600'
      case 'Master': return 'from-red-500 to-red-600'
      case 'Expert': return 'from-orange-500 to-orange-600'
      case 'Skilled': return 'from-blue-500 to-blue-600'
      case 'Beginner': return 'from-green-500 to-green-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  return {
    name: levelName,
    numericLevel,
    color: getColorByName(levelName),
    xp,
    nextLevelXp: (() => {
      if (levelName === 'Legend') return null
      if (levelName === 'Master') return 1000
      if (levelName === 'Expert') return 600
      if (levelName === 'Skilled') return 300
      return 100
    })()
  }
}
import BottomNav from '@/app/components/BottomNav'
import DepositModal from '@/app/components/DepositModal'
import WithdrawModal from '@/app/components/WithdrawModal'
import AvatarPickerModal from '@/app/components/AvatarPickerModal'
import PromoClaimModal from '@/app/components/PromoClaimModal'
import { LuLogOut, LuRefreshCw, LuPlus, LuMinus, LuGift, LuUser, LuCoins, LuHistory, LuChevronRight, LuGlobe, LuFileText, LuMail, LuCircleHelp, LuX, LuCheck, LuVolume2, LuVolumeX, LuPhone } from 'react-icons/lu'

interface Transaction {
  id: string
  type: 'stake' | 'win' | 'deposit' | 'withdrawal' | 'bonus'
  amount: number
  game_id: string | null
  status: string
  created_at: string
  description?: string
  metadata?: {
    display_text?: string
    description?: string
    result?: 'WIN' | 'LOSS' | 'DEPOSIT' | 'WITHDRAWAL' | 'BONUS'
    amount_display?: string
    status_color?: string
    game_level?: string
  }
}

export default function AccountPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, logout, refreshUser } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [language, setLanguage] = useState('English')
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showFaqModal, setShowFaqModal] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [updatingPhone, setUpdatingPhone] = useState(false)
  const [supportInfo, setSupportInfo] = useState({
    email: 'support@bingox.com',
    telegram: '@bingox_support',
    phone: '+251 911 234 567'
  })
  const [commissionRate, setCommissionRate] = useState<number>(0.1)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Load and persist sound preference
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('bingo_sound_enabled') : null
      if (stored != null) setSoundOn(stored === 'true')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('bingo_sound_enabled', String(soundOn))
    } catch {}
  }, [soundOn])

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
    const loadCommission = async () => {
      try {
        const rate = await getConfig('game_commission_rate')
        const numeric = typeof rate === 'number' ? rate : parseFloat(rate)
        const normalized = isNaN(numeric as number)
          ? 0.1
          : ((numeric as number) > 1 ? (numeric as number) / 100 : (numeric as number))
        setCommissionRate(normalized)
      } catch (error) {
        console.warn('Failed to load commission rate for account terms, using default 10%')
      }
    }

    loadCommission()
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const cashBalance = user.balance || 0
  const bonusBalance = user.bonus_balance || 0
  const bonusWinBalance = (user as any).bonus_win_balance || 0
  const totalBonusBalance = bonusBalance + bonusWinBalance
  const totalBalance = cashBalance + totalBonusBalance
  const isSuspended = (user as any).status === 'inactive'

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-50">
      {/* Language Modal */}
      {showLanguageModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowLanguageModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900/75 backdrop-blur-xl border border-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.85)] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Select Language</h3>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
              >
                <LuX className="w-4 h-4" />
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
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-sm ${
                    language === lang
                      ? 'border-emerald-500 bg-emerald-500/10 text-slate-50'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <span className="font-medium truncate">{lang}</span>
                  {language === lang && <LuCheck className="w-5 h-5 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Username Modal */}
      {showUsernameModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowUsernameModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Edit Username</h3>
              <button
                onClick={() => setShowUsernameModal(false)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
              >
                <LuX className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-900 text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  maxLength={20}
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 3 characters, maximum 20 characters</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUsernameModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-700 text-slate-200 rounded-lg bg-slate-900 hover:bg-slate-800 hover:border-slate-500 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUsernameUpdate}
                  disabled={updatingUsername || !newUsername.trim() || newUsername.length < 3}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {updatingUsername ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
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
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900/75 backdrop-blur-xl border border-white/10 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.85)] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Terms & Conditions</h3>
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
              >
                <LuX className="w-4 h-4" />
              </button>
            </div>
            <div className="prose prose-sm prose-invert text-slate-200">
              <p className="mb-4">Welcome to BingoX. By using our service, you agree to these terms and conditions.</p>
              <h4 className="font-semibold text-slate-900 mb-2">1. Account Usage</h4>
              <p className="mb-4">You must be 18 years or older to use this service. You are responsible for maintaining the security of your account.</p>
              <h4 className="font-semibold text-slate-900 mb-2">2. Game Rules</h4>
              <p className="mb-4">All games must be played fairly. Any form of cheating or manipulation will result in account suspension.</p>
              <h4 className="font-semibold text-slate-900 mb-2">3. Payments</h4>
              <p className="mb-4">All deposits and withdrawals are subject to verification. Processing times may vary.</p>
              <h4 className="font-semibold text-slate-900 mb-2">4. Game Winnings &amp; Commission</h4>
              <p className="mb-4">
                Each game prize pool is calculated from the real-money stakes of participating players. A commission of {Math.round((commissionRate || 0.1) * 100)}%
                is deducted from the gross prize to cover operational costs, and the remaining net amount is awarded to the winner(s). When a player wins and their
                stake included bonus funds, the real-funded share of the win is credited to the withdrawable balance, while the bonus-funded share is credited to the
                dedicated <strong>Bonus Win</strong> balance and remains non-withdrawable. This structure keeps bonus rewards separate while ensuring real cash winnings stay withdrawable.
              </p>
              <h4 className="font-semibold text-slate-900 mb-2">5. Responsible Gaming</h4>
              <p>Please play responsibly. If you feel you have a gambling problem, please seek help.</p>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Contact Support</h3>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
              >
                <LuX className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <a href={`mailto:${supportInfo.email}`} className="text-emerald-400 hover:text-emerald-300">{supportInfo.email}</a>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Telegram</label>
                <a href={`https://t.me/${supportInfo.telegram.replace('@', '')}`} className="text-emerald-400 hover:text-emerald-300">{supportInfo.telegram}</a>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                <a href={`tel:${supportInfo.phone.replace(/\s/g, '')}`} className="text-emerald-400 hover:text-emerald-300">{supportInfo.phone}</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFaqModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowFaqModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Frequently Asked Questions</h3>
              <button
                onClick={() => setShowFaqModal(false)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
              >
                <LuX className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-50 mb-2">How do I deposit money?</h4>
                <p className="text-sm text-slate-200">Go to the Deposit page, enter the amount, and follow the payment instructions. Your balance will be updated after verification.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-50 mb-2">How long do withdrawals take?</h4>
                <p className="text-sm text-slate-200">Withdrawals are typically processed within 24-48 hours after approval.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-50 mb-2">What is bonus balance?</h4>
                <p className="text-sm text-slate-200">
                  Bonus balance is promotional credit that can be used to play games. It cannot be withdrawn directly. Any winnings generated from bonus play are
                  stored as <strong>Bonus Wins</strong> and are also non-withdrawable unless they are manually converted by an admin.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-50 mb-2">How do I claim the daily streak bonus?</h4>
                <p className="text-sm text-slate-200">Play games daily for 5 consecutive days, then go to the Bonus page to claim your reward.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Header */}
      <div
        className="bg-slate-950 border-b border-slate-800 safe-top"
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuUser className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-50">Account</h1>
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
        <div className="bg-slate-900 rounded-xl p-6 mb-4 border border-slate-800 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => setShowAvatarModal(true)}
            className="relative mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-full"
          >
            <div className="w-24 h-24 rounded-full bg-cyan-500 flex items-center justify-center overflow-hidden shadow-lg">
              <Image
                src={(user as any).avatar_url || (user as any).profile_image_url || '/images/6.svg'}
                alt="Profile avatar"
                width={96}
                height={96}
                className="w-20 h-20"
              />
            </div>
            <div className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 w-16 h-16">
              <Player
                src="/lottie/Crown.json"
                autoplay
                loop
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </button>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-slate-50">{user.username || 'User'}</h2>
            <button
              onClick={() => {
                setNewUsername(user.username || '')
                setShowUsernameModal(true)
              }}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
          {user.phone && (
            <div className="flex items-center justify-center gap-1 text-sm text-slate-300 mb-1">
              <LuPhone className="w-4 h-4" />
              <span>{user.phone}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-slate-300 mt-1">
            <span>Telegram ID: {user.telegram_id}</span>
            {(() => {
              const levelInfo = getLevelInfo(user.xp || 0, user.level_progress)
              return (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${levelInfo.color} text-white`}>
                    Level {levelInfo.numericLevel} • {levelInfo.name}
                  </span>
                  <span className="text-xs text-slate-500">{levelInfo.xp} XP</span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Account Suspended Info */}
        {isSuspended && (
          <div className="bg-red-50 rounded-xl p-4 mb-4 border border-red-200">
            <h3 className="text-sm font-semibold text-red-800 mb-1">Account Suspended</h3>
            <p className="text-xs text-red-700 mb-1">
              Your account is currently suspended. You cannot deposit, withdraw, or join games until this is resolved.
            </p>
            {(user as any).suspension_reason && (
              <p className="text-xs text-red-700"><span className="font-semibold">Reason:</span> {(user as any).suspension_reason}</p>
            )}
            <p className="text-[11px] text-red-600 mt-2">
              If you believe this is a mistake, please contact support using the details below.
            </p>
          </div>
        )}

        
        
        {/* History moved to dedicated page */}

        {/* Settings & Support */}
        <div className="bg-slate-900 rounded-xl p-5 mb-4 border border-slate-800">
          <h3 className="text-base font-semibold text-slate-50 mb-4">Settings & Support</h3>
          
          <div className="space-y-2">
            {/* Claim Promo */}
            <button 
              onClick={() => setShowPromoModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuGift className="w-5 h-5 text-amber-300" />
                <span className="text-sm font-medium text-slate-50">Claim Promo</span>
              </div>
              <div className="flex items-center gap-2">
                <LuChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </button>

            {/* Game Sound */}
            <button 
              onClick={() => setSoundOn(s => { const next = !s; try { window.dispatchEvent(new CustomEvent('bingo_sound_pref_changed', { detail: { enabled: next } })) } catch {}; return next })}
              className="w-full flex items-center justify-between py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                {soundOn ? <LuVolume2 className="w-5 h-5 text-slate-200" /> : <LuVolumeX className="w-5 h-5 text-slate-200" />}
                <span className="text-sm font-medium text-slate-50">Game Sound</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">{soundOn ? 'On' : 'Off'}</span>
                <LuChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </button>

            {/* Language */}
            <button 
              onClick={() => setShowLanguageModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuGlobe className="w-5 h-5 text-slate-200" />
                <span className="text-sm font-medium text-slate-50">Language</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">{language}</span>
                <LuChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </button>

            {/* Terms and Conditions */}
            <button 
              onClick={() => setShowTermsModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuFileText className="w-5 h-5 text-slate-200" />
                <span className="text-sm font-medium text-slate-50">Terms & Conditions</span>
              </div>
              <LuChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Contact Support */}
            <button 
              onClick={() => setShowSupportModal(true)}
              className="w-full flex items-center justify-between py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuMail className="w-5 h-5 text-slate-200" />
                <span className="text-sm font-medium text-slate-50">Contact Support</span>
              </div>
              <LuChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* FAQ */}
            <button 
              onClick={() => setShowFaqModal(true)}
              className="w-full flex items-center justify-between py-3 hover:bg-slate-800 transition-colors rounded-lg px-2"
            >
              <div className="flex items-center gap-3">
                <LuCircleHelp className="w-5 h-5 text-slate-200" />
                <span className="text-sm font-medium text-slate-50">FAQ</span>
              </div>
              <LuChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

      </div>

      <DepositModal 
        open={showDepositModal} 
        onClose={() => setShowDepositModal(false)}
      />
      <WithdrawModal 
        open={showWithdrawModal} 
        onClose={() => setShowWithdrawModal(false)}
      />
      <AvatarPickerModal open={showAvatarModal} onClose={() => setShowAvatarModal(false)} />
      <PromoClaimModal open={showPromoModal} onClose={() => setShowPromoModal(false)} />
      <BottomNav />
    </div>
  )
}
