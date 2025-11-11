"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [sparkles, setSparkles] = useState<Array<{id: number, style: React.CSSProperties}>>([])

  // Redirect to lobby if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/lobby')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    const sparkleArray = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      style: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        width: `${Math.random() * 4 + 2}px`,
        height: `${Math.random() * 4 + 2}px`,
        animationDelay: `${Math.random() * 4}s`,
        animationDuration: `${Math.random() * 3 + 2}s`,
      }
    }))
    setSparkles(sparkleArray)
  }, [])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't show home page if logged in (will redirect)
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Sparkle Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {sparkles.map(sparkle => (
          <div
            key={sparkle.id}
            className="absolute rounded-full bg-yellow-400 opacity-60 animate-sparkle-fall"
            style={sparkle.style}
          />
        ))}
      </div>

      {/* Main Content - Mobile Responsive */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section - Mobile Responsive */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600 mb-3 sm:mb-4">
            Your Lucky Card!
          </h2>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight px-2">
            Enter the Palace of Prizes!
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4">
            Experience the thrill of royal bingo! Join players worldwide, claim magnificent bonuses, and compete in daily tournaments for glorious rewards.
          </p>

          {/* CTA Buttons - Mobile Responsive */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 px-4">
            <Link
              href="/lobby"
              className="bg-blue-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <span>🎮</span>
              <span>Join the Fun!</span>
            </Link>
            <Link
              href="/login"
              className="border-2 border-blue-600 text-blue-600 px-6 sm:px-10 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-blue-50 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>✈️</span>
              <span>Login with Telegram</span>
            </Link>
          </div>

          {/* Stats Banner - Mobile Responsive */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-3xl mx-auto mb-12 sm:mb-16 px-4">
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">10K+</div>
              <div className="text-xs sm:text-sm text-gray-600">Active Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold text-purple-600 mb-1 sm:mb-2">50M+</div>
              <div className="text-xs sm:text-sm text-gray-600">ETB Won Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-4xl font-bold text-pink-600 mb-1 sm:mb-2">24/7</div>
              <div className="text-xs sm:text-sm text-gray-600">Games Running</div>
            </div>
          </div>

          {/* Phone Mockup - Mobile Responsive */}
          <div className="max-w-xs mx-auto hidden sm:block">
            <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-2xl transform transition-transform duration-300 hover:scale-105">
              <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
              <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
              <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
              <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
              <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white">
                <div className="h-full bg-gradient-to-b from-blue-100 to-purple-100 flex items-center justify-center p-4">
                  <div className="text-center">
                    <div className="text-7xl mb-4">🎰</div>
                    <div className="text-2xl font-bold text-blue-600 mb-2">Bingo Royale</div>
                    <div className="text-sm text-gray-600">Play & Win!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section - Mobile Responsive */}
        <section className="py-8 sm:py-16 bg-white/70 backdrop-blur rounded-3xl shadow-xl mb-8 sm:mb-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h3 className="text-2xl sm:text-4xl font-bold text-center mb-8 sm:mb-12 text-blue-600">
              Why Bingo Royale?
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="text-6xl mb-4">🌍</div>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">Real-Time Multiplayer</h4>
                <p className="text-gray-600 leading-relaxed">
                  Challenge players from around the globe in exciting, live bingo matches. Feel the rush of competing for the win!
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="text-6xl mb-4">👑</div>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">Royal Bonuses</h4>
                <p className="text-gray-600 leading-relaxed">
                  Unlock majestic bonuses and daily rewards. The more you play, the more treasures you'll uncover in the palace!
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="text-6xl mb-4">🏆</div>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">Daily Tournaments</h4>
                <p className="text-gray-600 leading-relaxed">
                  Prove your bingo prowess in daily tournaments. Climb the leaderboards and claim your champion's crown and prizes!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-300 pt-8 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              Play responsibly. For amusement only.
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Facebook
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Twitter
              </a>
              <a href="#" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Instagram
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
