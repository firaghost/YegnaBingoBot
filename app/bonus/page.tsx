"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/app/components/BottomNav'
import { Gift, Play, Check, Calendar } from 'lucide-react'

export default function BonusPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, refreshUser } = useAuth()
  const [claiming, setClaiming] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')
  const [registrationBonus, setRegistrationBonus] = useState(3.00)
  const [streakDaysRequired, setStreakDaysRequired] = useState(5)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [loading, isAuthenticated, router])

  // Fetch admin settings
  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['welcome_bonus', 'daily_streak_days'])

      if (settings) {
        settings.forEach(setting => {
          if (setting.setting_key === 'welcome_bonus') {
            setRegistrationBonus(parseFloat(setting.setting_value))
          } else if (setting.setting_key === 'daily_streak_days') {
            setStreakDaysRequired(parseInt(setting.setting_value))
          }
        })
      }
    }
    fetchSettings()
  }, [])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const bonusBalance = user.bonus_balance || 0
  const dailyStreak = user.daily_streak || 0

  const handleClaimStreak = async () => {
    if (dailyStreak < streakDaysRequired) {
      setClaimMessage(`You need ${streakDaysRequired - dailyStreak} more days to claim the bonus!`)
      setTimeout(() => setClaimMessage(''), 3000)
      return
    }

    setClaiming(true)
    try {
      const response = await fetch('/api/bonus/claim-streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })

      const data = await response.json()

      if (response.ok) {
        setClaimMessage(`🎉 Congratulations! You earned ${formatCurrency(data.bonusAmount)}!`)
        await refreshUser()
        setTimeout(() => setClaimMessage(''), 5000)
      } else {
        setClaimMessage(data.error || 'Failed to claim bonus')
        setTimeout(() => setClaimMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error claiming bonus:', error)
      setClaimMessage('Failed to claim bonus. Please try again.')
      setTimeout(() => setClaimMessage(''), 3000)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        
        {/* Total Bonus Card */}
        <div className="border-2 border-yellow-500 rounded-3xl p-8 mb-4 bg-purple-800 bg-opacity-30">
          <div className="text-center">
            <Gift className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-4">Your Total Bonus</h2>
            <div className="text-green-400 text-5xl font-bold mb-4">
              {formatCurrency(bonusBalance)}
            </div>
            <p className="text-purple-200 text-sm mb-4">Use this bonus to play more games!</p>
            <button 
              onClick={() => router.push('/lobby')}
              className="bg-yellow-500 text-purple-900 px-8 py-3 rounded-lg font-bold hover:bg-yellow-400 transition-colors inline-flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              <span>Play</span>
            </button>
          </div>
        </div>

        {/* Registration Bonus Info */}
        <div className="border-2 border-green-500 rounded-3xl p-6 mb-4 bg-purple-800 bg-opacity-30">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🏅</span>
            </div>
            <h2 className="text-yellow-400 text-xl font-bold mb-3">Registration Bonus</h2>
            <div className="text-yellow-400 text-4xl font-bold mb-3">{formatCurrency(registrationBonus)}</div>
            <p className="text-purple-200 text-sm mb-4">Your welcome gift for joining Bingo Royale!</p>
            <div className="flex items-center justify-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              <span className="font-semibold">Already Received</span>
            </div>
          </div>
        </div>

        {/* First Deposit Bonus */}
        <div className="border-2 border-purple-500 rounded-3xl p-6 mb-4 bg-purple-800 bg-opacity-30">
          <div className="text-center">
            <Gift className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h2 className="text-purple-200 text-xl font-semibold mb-3">First Deposit Bonus</h2>
            <p className="text-purple-300 text-sm mb-4">
              Deposit for the first time and we will match your deposit up to <span className="text-purple-200 font-bold">100 ETB!</span>
            </p>
            <button 
              onClick={() => router.push('/deposit')}
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-500 transition-colors"
            >
              Deposit Now
            </button>
          </div>
        </div>

        {/* Daily Streak Bonus */}
        <div className="border-2 border-yellow-500 rounded-3xl p-6 bg-purple-800 bg-opacity-30">
          <div className="text-center mb-6">
            <Calendar className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-3">Daily Streak Bonus</h2>
            <p className="text-purple-300 text-sm mb-4">Play Bingo daily and claim bonus rewards!</p>
          </div>

          {/* Streak Days */}
          <div className="flex justify-center gap-4 mb-4">
            {Array.from({ length: streakDaysRequired }, (_, i) => i + 1).map((day) => (
              <div key={day} className="text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  dailyStreak >= day 
                    ? 'bg-green-500' 
                    : 'bg-purple-700'
                }`}>
                  {dailyStreak >= day ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <span className="text-purple-400 text-sm font-semibold">{day}</span>
                  )}
                </div>
                <p className="text-purple-400 text-xs">Day {day}</p>
              </div>
            ))}
          </div>

          <div className="text-center mb-4">
            <p className="text-yellow-400 font-bold text-lg">
              Current Streak: <span className="text-2xl">{dailyStreak}/{streakDaysRequired} days</span>
            </p>
          </div>

          {claimMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-center font-semibold ${
              claimMessage.includes('Congratulations') 
                ? 'bg-green-600 text-white' 
                : 'bg-yellow-600 text-purple-900'
            }`}>
              {claimMessage}
            </div>
          )}

          {dailyStreak < streakDaysRequired ? (
            <div className="bg-yellow-600 text-purple-900 py-3 rounded-xl font-bold text-center">
              {streakDaysRequired - dailyStreak} more days to bonus
            </div>
          ) : (
            <button 
              onClick={handleClaimStreak}
              disabled={claiming}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claiming ? 'Claiming...' : 'Claim Streak Bonus'}
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
