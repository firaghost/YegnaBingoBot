"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const router = useRouter()
  const { loginWithTelegram, isAuthenticated } = useAdminAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginMethod, setLoginMethod] = useState<'telegram' | 'password'>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/mgmt-portal-x7k9p2')
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

        router.push('/mgmt-portal-x7k9p2')
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)

      // Query admin_users table with username and password
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', password)
        .maybeSingle()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      if (!admin) {
        setError('Invalid username or password')
        setLoading(false)
        return
      }

      // Store admin ID in localStorage
      localStorage.setItem('admin_id', admin.id)
      router.push('/mgmt-portal-x7k9p2')
    } catch (err: any) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
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
            <p className="text-gray-300">BingoX Dashboard</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Login Method Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setLoginMethod('password')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                loginMethod === 'password'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setLoginMethod('telegram')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                loginMethod === 'telegram'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Telegram
            </button>
          </div>

          <div className="space-y-4">
            {loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Default: admin / admin123
                </p>
              </form>
            ) : (
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
            )}
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
