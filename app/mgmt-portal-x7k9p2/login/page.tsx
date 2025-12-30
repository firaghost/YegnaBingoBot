"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { Eye, EyeOff, LogIn, Shield, User } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const { loginWithTelegram, isAuthenticated, setAdminFromApi } = useAdminAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
      // Call secure login API (verifies hashed password)
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Invalid username or password')
        setLoading(false)
        return
      }
      const admin = json.data
      // Let useAdminAuth manage session storage and state
      setAdminFromApi(admin)
      router.push('/mgmt-portal-x7k9p2')
    } catch (err: any) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#1C1C1C] font-sans overflow-x-hidden antialiased selection:bg-[#d4af35]/30 selection:text-[#d4af35]">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[520px] bg-[radial-gradient(circle_at_center,rgba(212,175,53,0.10),transparent_55%)] opacity-70" />
      </div>

      <div className="relative z-10 flex h-full grow flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[440px] flex flex-col bg-[#252525] rounded-xl shadow-2xl border border-[#333333] overflow-hidden">
          <div className="h-1.5 w-full bg-[#d4af35] shadow-[0_0_10px_rgba(212,175,53,0.40)]" />

          <div className="p-8 md:p-10 flex flex-col w-full">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#333333] flex items-center justify-center shadow-lg mb-4 transition-transform duration-500 hover:scale-105">
                <Shield className="w-8 h-8 text-[#d4af35]" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Console</h1>
              <p className="text-sm text-[#a3a3a3] mt-1 font-medium">Restricted Access Environment</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <form className="flex flex-col gap-5" onSubmit={handlePasswordLogin}>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider ml-1">Admin ID</label>
                <div className="relative group">
                  <input
                    className="w-full h-12 bg-[#181818] border border-[#333333] rounded-lg pl-4 pr-12 text-base text-white placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] transition-all duration-200"
                    placeholder="Username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <div className="absolute right-0 top-0 h-full w-12 flex items-center justify-center pointer-events-none text-[#a3a3a3] group-focus-within:text-[#d4af35] transition-colors duration-200">
                    <User className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <input
                    className="w-full h-12 bg-[#181818] border border-[#333333] rounded-lg pl-4 pr-12 text-base text-white placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] transition-all duration-200"
                    placeholder="••••••••••••"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors duration-200 disabled:opacity-50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                className="mt-4 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-[#d4af35] hover:bg-[#c29f2e] text-[#171612] text-base font-bold leading-normal tracking-wide transition-all duration-200 shadow-[0_4px_14px_0_rgba(212,175,53,0.39)] hover:shadow-[0_6px_20px_rgba(212,175,53,0.23)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <span>Logging in...</span>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    <span>Secure Login</span>
                  </>
                )}
              </button>
            </form>

            <button
              onClick={handleTelegramLogin}
              disabled={loading}
              className="mt-3 w-full h-12 rounded-lg border border-[#333333] bg-[#1b1b1b] hover:bg-[#202020] text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              type="button"
            >
              {loading ? 'Authenticating...' : 'Login with Telegram'}
            </button>

            <div className="mt-8 pt-6 border-t border-[#333333]">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1b1b1b] border border-[#333333] flex items-center justify-center text-[#d4af35]">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold text-[#d4d4d4] uppercase tracking-wide">Notice</p>
                  <p className="text-[11px] leading-relaxed text-[#8a8a8a]">
                    This system is for authorized administrators only. All activities are monitored.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 opacity-60">
          <div className="flex items-center gap-2 text-xs text-[#666666]">
            <Shield className="w-4 h-4" />
            <span>Encrypted Connection</span>
          </div>
          <a href="/" className="text-[10px] text-[#444444] hover:text-[#666666] transition-colors">
            Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
