"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'

export default function LoginPage() {
  const router = useRouter()
  const { loginWithTelegram, isAuthenticated, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRedirected, setHasRedirected] = useState(false)
  const [isFromTelegram, setIsFromTelegram] = useState(false)

  useEffect(() => {
    // Check if user came from Telegram
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      setIsFromTelegram(true)
    }

    // Redirect if already authenticated (only once)
    if (isAuthenticated && !authLoading && !hasRedirected) {
      setHasRedirected(true)
      router.replace('/lobby')
      return
    }

    // Initialize Telegram Web App
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [isAuthenticated, authLoading, router, hasRedirected])

  const handleTelegramLogin = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if running in Telegram Web App
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const telegramUser = window.Telegram.WebApp.initDataUnsafe.user
        
        const user = await loginWithTelegram({
          id: telegramUser.id,
          username: telegramUser.username || `${telegramUser.first_name}${telegramUser.last_name || ''}`,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name
        })

        if (user) {
          // Wait a bit for state to update
          setTimeout(() => {
            router.replace('/lobby')
          }, 100)
        }
      } else {
        // For development/testing without Telegram
        // Create a test user
        const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
        
        if (isDev) {
          const user = await loginWithTelegram({
            id: Date.now(), // Random ID for testing
            username: `TestUser_${Math.floor(Math.random() * 1000)}`,
            first_name: 'Test',
            last_name: 'User'
          })
          
          if (user) {
            setTimeout(() => {
              router.replace('/lobby')
            }, 100)
          }
        } else {
          setError('Please open this app through Telegram')
          setLoading(false)
        }
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to login. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-10">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🎰</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Bingo Royale</h1>
            <p className="text-gray-600">
              {isFromTelegram 
                ? "Complete your registration to start playing!" 
                : "Welcome back! Let's play!"}
            </p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Show info message for Telegram users who need to register via bot */}
            {isFromTelegram && !authLoading && !isAuthenticated && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-2">📱 First time here?</p>
                <p>Please register through the Telegram bot first by using the <code className="bg-blue-100 px-1 rounded">/start</code> command, then come back here to play!</p>
              </div>
            )}

            {/* Telegram Login - Only show for non-Telegram users or as fallback */}
            {!isFromTelegram && (
              <button
                onClick={handleTelegramLogin}
                disabled={loading}
                className="w-full bg-blue-500 text-white py-4 rounded-xl font-semibold hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
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

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-4">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
            <div className="flex justify-center gap-4 text-sm text-gray-500">
              <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
              <span>•</span>
              <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
              <span>•</span>
              <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-white hover:underline font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
