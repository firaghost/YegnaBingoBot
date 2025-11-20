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

  // Simple client-side session tracking keys
  const ADMIN_ID_KEY = 'admin_id'
  const ADMIN_LAST_ACTIVE_KEY = 'admin_last_active'
  const ADMIN_SESSION_CREATED_KEY = 'admin_session_created'
  // 30 minutes idle timeout, 12 hours max session length
  const MAX_IDLE_MS = 30 * 60 * 1000
  const MAX_SESSION_MS = 12 * 60 * 60 * 1000

  const startSession = (adminId: string) => {
    try {
      const now = Date.now().toString()
      localStorage.setItem(ADMIN_ID_KEY, adminId)
      localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, now)
      localStorage.setItem(ADMIN_SESSION_CREATED_KEY, now)
    } catch {
      // ignore
    }
  }

  const touchLastActive = () => {
    try {
      localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, Date.now().toString())
    } catch {
      // ignore
    }
  }

  const clearSession = () => {
    try {
      localStorage.removeItem(ADMIN_ID_KEY)
      localStorage.removeItem(ADMIN_LAST_ACTIVE_KEY)
      localStorage.removeItem(ADMIN_SESSION_CREATED_KEY)
    } catch {
      // ignore
    }
    setAdmin(null)
  }

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const adminId = localStorage.getItem(ADMIN_ID_KEY)
      if (!adminId) {
        setLoading(false)
        return
      }

      // Enforce basic idle and absolute session timeouts
      const now = Date.now()
      const lastActive = Number(localStorage.getItem(ADMIN_LAST_ACTIVE_KEY) || '0')
      const createdAt = Number(localStorage.getItem(ADMIN_SESSION_CREATED_KEY) || '0')
      const idleTooLong = lastActive && now - lastActive > MAX_IDLE_MS
      const sessionTooOld = createdAt && now - createdAt > MAX_SESSION_MS
      if (!lastActive || !createdAt || idleTooLong || sessionTooOld) {
        clearSession()
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
      touchLastActive()
    } catch (error) {
      console.error('Error checking admin:', error)
      clearSession()
    } finally {
      setLoading(false)
    }
  }

  const loginWithTelegram = async (telegramId: string, username: string) => {
    try {
      setLoading(true)

      const res = await fetch('/api/admin/login-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, username }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Unauthorized: You are not an admin')
      }

      const adminFromApi = json.data as AdminUser
      setAdminFromApi(adminFromApi)
      return adminFromApi
    } catch (error) {
      console.error('Error logging in as admin:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // ignore network/logout API errors
    } finally {
      clearSession()
    }
  }

  // Helper for password-based login flows to reuse the same session logic
  const setAdminFromApi = (adminFromApi: AdminUser) => {
    startSession(adminFromApi.id)
    setAdmin(adminFromApi)
  }

  // Update last active on basic user interactions while an admin is logged in
  useEffect(() => {
    if (!admin) return

    const handler = () => touchLastActive()
    window.addEventListener('mousemove', handler)
    window.addEventListener('keydown', handler)
    window.addEventListener('click', handler)
    window.addEventListener('focus', handler)

    return () => {
      window.removeEventListener('mousemove', handler)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('click', handler)
      window.removeEventListener('focus', handler)
    }
  }, [admin])

  return {
    admin,
    loading,
    loginWithTelegram,
    logout,
    isAuthenticated: !!admin,
    isSuperAdmin: admin?.role === 'super_admin',
    setAdminFromApi,
  }
}
