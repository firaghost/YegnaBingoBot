"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Grid3x3, Gift, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    {
      name: 'Bingo Rooms',
      href: '/lobby',
      icon: Grid3x3,
      active: pathname === '/lobby' || pathname.startsWith('/game')
    },
    {
      name: 'Bonus',
      href: '/bonus',
      icon: Gift,
      active: pathname === '/bonus'
    },
    {
      name: 'Account',
      href: '/account',
      icon: User,
      active: pathname === '/account'
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-900 to-purple-800 border-t-4 border-yellow-500 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around items-center h-20">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-lg transition-all ${
                  item.active
                    ? 'text-yellow-400'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-semibold">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
