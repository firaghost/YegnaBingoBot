"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuGrid3X3, LuGift, LuUser } from 'react-icons/lu'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    {
      name: 'Games',
      href: '/lobby',
      icon: LuGrid3X3,
      active: pathname === '/lobby' || pathname.startsWith('/game')
    },
    {
      name: 'Bonus',
      href: '/bonus',
      icon: LuGift,
      active: pathname === '/bonus'
    },
    {
      name: 'Account',
      href: '/account',
      icon: LuUser,
      active: pathname === '/account'
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors ${
                  item.active
                    ? 'text-blue-500'
                    : 'text-slate-400'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
