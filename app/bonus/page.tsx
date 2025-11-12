"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'
import BottomNav from '@/app/components/BottomNav'
import { LuGift, LuPlay, LuCheck, LuCalendar, LuZap, LuCoins } from 'react-icons/lu'

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
      try {
        const welcomeBonus = await getConfig('welcome_bonus') || 3.00
        const streakDays = await getConfig('daily_streak_days') || 5
        
        setRegistrationBonus(Number(welcomeBonus))
        setStreakDaysRequired(Number(streakDays))
      } catch (error) {
        console.error('Error fetching bonus settings:', error)
        // Use default values if fetch fails
        setRegistrationBonus(3.00)
        setStreakDaysRequired(5)
      }
    }

    fetchSettings()
  }, [])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Simple Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuGift className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-900">Bonuses</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        
        {/* Total Bonus Card */}
        <div className="bg-white rounded-xl p-6 mb-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <LuCoins className="w-8 h-8 text-blue-500" />
              <div>
                <h2 className="text-sm text-slate-500 mb-1">Your Bonus Balance</h2>
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(bonusBalance)}
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">Use this bonus to play more games!</p>
          <button 
            onClick={() => router.push('/lobby')}
            className="w-full bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors inline-flex items-center justify-center gap-2"
          >
            <LuPlay className="w-4 h-4" />
            <span>Play Now</span>
          </button>
        </div>

        {/* Registration Bonus Info */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-slate-200">
          <div className="flex items-start gap-4">
            <LuZap className="w-8 h-8 text-emerald-500 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Registration Bonus</h2>
              <div className="text-2xl font-bold text-emerald-600 mb-2">{formatCurrency(registrationBonus)}</div>
              <p className="text-sm text-slate-600 mb-3">Your welcome gift for joining BingoX!</p>
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 py-2 px-3 rounded-lg">
                <LuCheck className="w-4 h-4" />
                <span className="font-medium text-sm">Already Received</span>
              </div>
            </div>
          </div>
        </div>

        {/* First Deposit Bonus */}
        <div className="bg-white rounded-xl p-5 mb-4 border border-slate-200">
          <div className="flex items-start gap-4">
            <LuGift className="w-8 h-8 text-purple-500 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-900 mb-2">First Deposit Bonus</h2>
              <p className="text-sm text-slate-600 mb-4">
                Deposit for the first time and we will match your deposit up to <span className="font-semibold text-slate-900">100 ETB!</span>
              </p>
              <button 
                onClick={() => router.push('/deposit')}
                className="w-full bg-purple-500 text-white py-2.5 rounded-lg font-medium hover:bg-purple-600 transition-colors"
              >
                Deposit Now
              </button>
            </div>
          </div>
        </div>
        {/* Daily Streak Bonus */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-start gap-4 mb-5">
            <LuCalendar className="w-8 h-8 text-orange-500 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Daily Streak Bonus</h2>
              <p className="text-sm text-slate-600">Play BingoX daily and claim bonus rewards!</p>
            </div>
          </div>

          {/* Streak Days */}
          <div className="flex justify-center gap-2 mb-5">
            {Array.from({ length: streakDaysRequired }, (_, i) => i + 1).map((day) => (
              <div key={day} className="text-center">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-1 ${
                  dailyStreak >= day 
                    ? 'bg-emerald-500' 
                    : 'bg-slate-100'
                }`}>
                  {dailyStreak >= day ? (
                    <LuCheck className="w-6 h-6 text-white" />
                  ) : (
                    <span className="text-slate-400 text-sm font-semibold">{day}</span>
                  )}
                </div>
                <p className="text-slate-500 text-[10px]">Day {day}</p>
              </div>
            ))}
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-slate-600">
              Current Streak: <span className="font-bold text-slate-900 text-lg">{dailyStreak}/{streakDaysRequired}</span>
            </p>
          </div>

          {claimMessage && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-center font-medium text-sm ${
              claimMessage.includes('Congratulations') 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-orange-50 text-orange-700 border border-orange-200'
            }`}>
              {claimMessage}
            </div>
          )}

          {dailyStreak < streakDaysRequired ? (
            <div className="bg-orange-50 text-orange-700 py-2.5 rounded-lg font-medium text-center text-sm border border-orange-200">
              {streakDaysRequired - dailyStreak} more days to bonus
            </div>
          ) : (
            <button 
              onClick={handleClaimStreak}
              disabled={claiming}
              className="w-full bg-emerald-500 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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