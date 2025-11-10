"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleTelegramLogin = () => {
    setLoading(true)
    // Telegram Web App integration would go here
    setTimeout(() => {
      router.push('/lobby')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-10">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🎰</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Bingo Royale</h1>
            <p className="text-gray-600">Welcome back! Let's play!</p>
          </div>

          <div className="space-y-4">
            {/* Telegram Login */}
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

            {/* Guest Mode */}
            <Link href="/lobby">
              <button className="w-full bg-gray-100 text-gray-800 py-4 rounded-xl font-semibold hover:bg-gray-200 transition-all">
                Continue as Guest
              </button>
            </Link>
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
