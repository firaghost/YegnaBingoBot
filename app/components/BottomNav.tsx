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
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                  item.active
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${item.active ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-medium truncate ${item.active ? 'font-semibold' : ''}`}>
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
