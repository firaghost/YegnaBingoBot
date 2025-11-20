"use client"

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { getConfig } from '../admin-config'

export interface AuthUser {
  id: string
  telegram_id: string
  username: string
  first_name?: string
  display_name?: string
  balance: number
  bonus_balance: number
  games_played: number
  games_won: number
  total_winnings: number
  daily_streak: number
  last_daily_claim: string | null
  xp: number
  level_progress?: string
  total_wins?: number
  created_at: string
  updated_at: string
  phone?: string // Add phone number field
  status?: string
  suspension_reason?: string | null
  suspended_at?: string | null
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session or auto-login from Telegram
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      // First, check if user is already logged in via localStorage
      const userId = localStorage.getItem('user_id')
      if (userId) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (!error && data) {
          setUser(data)
          setLoading(false)
          return
        }
        // If error, clear invalid session
        localStorage.removeItem('user_id')
      }

      // If not logged in, check if user came from Telegram and auto-login
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const telegramUser = window.Telegram.WebApp.initDataUnsafe.user
        const telegramId = String(telegramUser.id)

        // Check if this Telegram user is already registered
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_id', telegramId)
          .maybeSingle()

        if (existingUser) {
          // User is registered, auto-login
          console.log('✅ Auto-login from Telegram:', existingUser.username)
          localStorage.setItem('user_id', existingUser.id)
          setUser(existingUser)
          setLoading(false)
          return
        }
      }

      // No session and not from Telegram or not registered
      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      localStorage.removeItem('user_id')
      setLoading(false)
    }
  }

  const loginWithTelegram = async (telegramData: any) => {
    try {
      setLoading(true)

      const telegramId = String(telegramData.id)

      // Check if user exists
      let { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle()

      if (!existingUser) {
        // Get registration bonus from admin config
        const registrationBonus = (await getConfig('welcome_bonus')) || 3.00

        // Create new user
        const { data: newUser, error } = await supabase
          .from('users')
          .insert({
            telegram_id: telegramId,
            username: telegramData.username || `Player_${telegramId}`,
            balance: 0, // No main balance initially
            bonus_balance: registrationBonus, // Registration bonus from admin settings
            games_played: 0,
            games_won: 0,
            total_winnings: 0,
            referral_code: telegramId,
            daily_streak: 0,
            // Add phone number if available in Telegram WebApp data
            phone: telegramData.phone_number
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating user:', error)
          throw error
        }
        existingUser = newUser
      }

      // Store user ID in localStorage
      localStorage.setItem('user_id', existingUser.id)
      setUser(existingUser)
      return existingUser
    } catch (error) {
      console.error('Error logging in:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('user_id')
    setUser(null)
  }

  const refreshUser = async () => {
    if (!user) return
    await checkUser()
  }

  return {
    user,
    loading,
    loginWithTelegram,
    logout,
    refreshUser,
    isAuthenticated: !!user
  }
}
