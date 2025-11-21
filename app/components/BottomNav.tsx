"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuGrid3X3, LuLink2, LuUser, LuTrophy, LuHistory, LuPlus } from 'react-icons/lu'

export default function BottomNav() {
  const pathname = usePathname()

  const isLobby = pathname === '/lobby' || pathname === '/'

  const handleDepositClick = (e: any) => {
    e.preventDefault()
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('open_deposit_modal'))
      }
    } catch {}
  }

  const navItems = [
    {
      id: 'games',
      name: 'Games',
      href: '/lobby',
      icon: LuGrid3X3,
      active: pathname === '/lobby' || pathname.startsWith('/game')
    },
    {
      id: 'leaderboard',
      name: 'Leaderboard',
      href: '/leaderboard',
      icon: LuTrophy,
      active: pathname === '/leaderboard'
    },
    {
      id: 'history',
      name: 'History',
      href: '/history',
      icon: LuHistory,
      active: pathname === '/history'
    },
    {
      id: 'bonus',
      name: 'Invite',
      href: '/bonus',
      icon: LuLink2,
      active: pathname === '/bonus'
    },
    {
      id: 'account',
      name: 'Profile',
      href: '/account',
      icon: LuUser,
      active: pathname.startsWith('/account')
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 border-t border-slate-800 shadow-[0_-14px_16px_rgba(15,23,42,0.65)]">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isGames = item.id === 'games'
            const isActive = item.active

            if (isGames) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={isLobby ? handleDepositClick : undefined}
                  className="flex flex-col items-center justify-center min-w-0"
                >
                  {isLobby ? (
                    <>
                      <div className="relative -mt-2">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-400 to-sky-500 translate-x-[2px] translate-y-[2px]" />
                        <div className="relative px-7 py-2 rounded-full bg-gradient-to-b from-yellow-400 to-amber-400 shadow-[0_10px_25px_rgba(0,0,0,0.55)] flex items-center justify-center">
                          <LuPlus className="w-5 h-5 text-slate-900" />
                        </div>
                      </div>
                      <span className="mt-1 text-[11px] font-semibold text-yellow-500 tracking-wide">Deposit</span>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 flex items-center justify-center -mt-6">
                        <img
                          src="/lottie/icon-trophy.avif"
                          alt="Games"
                          className="w-16 h-16 drop-shadow-[0_10px_24px_rgba(0,0,0,0.7)] object-contain"
                        />
                      </div>
                      <span className="-mt-2 text-[11px] font-semibold text-yellow-500 tracking-wide">Games</span>
                    </>
                  )}
                </Link>
              )
            }

            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-0 ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-medium truncate ${isActive ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
