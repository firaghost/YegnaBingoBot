"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminUser {
  id: string
  telegram_id: string
  username: string
  role: 'super_admin' | 'admin' | 'moderator'
  permissions: any
}

export function useAdminAuth() {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const adminId = localStorage.getItem('admin_id')
      if (!adminId) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', adminId)
        .single()

      if (error) throw error
      setAdmin(data)
    } catch (error) {
      console.error('Error checking admin:', error)
      localStorage.removeItem('admin_id')
    } finally {
      setLoading(false)
    }
  }

  const loginWithTelegram = async (telegramId: string, username: string) => {
    try {
      setLoading(true)

      // Check if admin exists
      const { data: existingAdmin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single()

      if (error || !existingAdmin) {
        throw new Error('Unauthorized: You are not an admin')
      }

      // Store admin ID in localStorage
      localStorage.setItem('admin_id', existingAdmin.id)
      setAdmin(existingAdmin)
      return existingAdmin
    } catch (error) {
      console.error('Error logging in as admin:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('admin_id')
    setAdmin(null)
  }

  return {
    admin,
    loading,
    loginWithTelegram,
    logout,
    isAuthenticated: !!admin,
    isSuperAdmin: admin?.role === 'super_admin'
  }
}
