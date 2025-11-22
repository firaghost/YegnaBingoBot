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

      const res = await fetch('/api/auth/telegram-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramData }),
      })

      const json = await res.json()
      if (!res.ok) {
        console.error('Telegram login failed:', json)
        throw new Error(json.error || 'Failed to login with Telegram')
      }

      const existingUser = json.data as AuthUser

      // Keep localStorage for backwards compatibility/UI convenience
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
