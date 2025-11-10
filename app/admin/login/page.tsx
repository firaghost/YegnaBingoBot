"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

export default function AdminLoginPage() {
  const router = useRouter()
  const { loginWithTelegram, isAuthenticated } = useAdminAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/admin')
    }

    // Initialize Telegram Web App
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [isAuthenticated, router])

  const handleTelegramLogin = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if running in Telegram Web App
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const telegramUser = window.Telegram.WebApp.initDataUnsafe.user
        
        await loginWithTelegram(
          telegramUser.id.toString(),
          telegramUser.username || telegramUser.first_name
        )

        router.push('/admin')
      } else {
        setError('Please open this page through Telegram')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Access denied. You are not authorized as an admin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-10 border border-white/20">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🔐</div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-gray-300">Bingo Royale Dashboard</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleTelegramLogin}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                  </svg>
                  <span>Login with Telegram</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-center text-sm text-gray-400">
              Only authorized administrators can access this area
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-white/80 hover:text-white hover:underline font-medium">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
