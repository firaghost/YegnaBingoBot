"use client"
import { SpeedInsights } from "@vercel/speed-insights/next"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [sparkles, setSparkles] = useState<Array<{id: number, style: React.CSSProperties}>>([])

  // Redirect to lobby if already logged in (including auto-login from Telegram)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      console.log('✅ User authenticated, redirecting to lobby')
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
            Welcome to BingoX!
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4">
            Experience the thrill of competitive bingo! Join players worldwide, win amazing prizes, and compete in exciting tournaments for incredible rewards.
          </p>

          {/* CTA Buttons - Mobile Responsive */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 px-4">
            <Link
              href="/lobby"
              className="bg-blue-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Join the Fun!</span>
            </Link>
            <Link
              href="/login"
              className="border-2 border-blue-600 text-blue-600 px-6 sm:px-10 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-blue-50 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
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
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 mb-2">BingoX</div>
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
              Why Choose BingoX?
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">Real-Time Multiplayer</h4>
                <p className="text-gray-600 leading-relaxed">
                  Challenge players from around the globe in exciting, live bingo matches. Feel the rush of competing for the win!
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="w-16 h-16 bg-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">Amazing Prizes</h4>
                <p className="text-gray-600 leading-relaxed">
                  Win real money and exciting bonuses! The more you play, the more rewards you can earn in our competitive games.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className="w-16 h-16 bg-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-3 text-gray-800">Fair & Secure</h4>
                <p className="text-gray-600 leading-relaxed">
                  Play with confidence! Our platform ensures fair gameplay, secure transactions, and transparent prize distribution.
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
