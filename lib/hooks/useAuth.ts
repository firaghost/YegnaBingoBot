"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface AuthUser {
  id: string
  telegram_id: string
  username: string
  balance: number
  games_played: number
  games_won: number
  total_winnings: number
  created_at: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const userId = localStorage.getItem('user_id')
      if (!userId) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUser(data)
    } catch (error) {
      console.error('Error checking user:', error)
      localStorage.removeItem('user_id')
    } finally {
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
        // Create new user
        const { data: newUser, error } = await supabase
          .from('users')
          .insert({
            telegram_id: telegramId,
            username: telegramData.username || `Player_${telegramId}`,
            balance: 1000, // Starting balance
            games_played: 0,
            games_won: 0,
            total_winnings: 0
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
