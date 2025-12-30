'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useMemo, useState } from 'react'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'

import {
  LayoutGrid,
  Users,
  Ban,
  Gamepad2,
  Trophy,
  Megaphone,
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Building2,
  Tag,
  Settings,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  PlayCircle,
} from 'lucide-react'

type AdminShellProps = {
  title?: string
  children: ReactNode
}

export function AdminShell({ title = 'Dashboard Overview', children }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { admin, logout } = useAdminAuth()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = useMemo(
    () =>
      [
        { href: '/mgmt-portal-x7k9p2', label: 'Dashboard', icon: LayoutGrid },
        { href: '/mgmt-portal-x7k9p2/users', label: 'Users', icon: Users },
        { href: '/mgmt-portal-x7k9p2/suspended-users', label: 'Suspended', icon: Ban },
        { href: '/mgmt-portal-x7k9p2/live-monitor', label: 'Live Monitor', icon: PlayCircle },
        { href: '/mgmt-portal-x7k9p2/games', label: 'Games', icon: Gamepad2 },
        { href: '/mgmt-portal-x7k9p2/tournaments', label: 'Tournaments', icon: Trophy },
        { href: '/mgmt-portal-x7k9p2/broadcast', label: 'Broadcast', icon: Megaphone },
        { href: '/mgmt-portal-x7k9p2/rooms', label: 'Rooms', icon: Home },
        { href: '/mgmt-portal-x7k9p2/deposits', label: 'Deposits', icon: ArrowDownToLine },
        { href: '/mgmt-portal-x7k9p2/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
        { href: '/mgmt-portal-x7k9p2/transactions', label: 'Transactions', icon: Receipt },
        { href: '/mgmt-portal-x7k9p2/banks', label: 'Banks', icon: Building2 },
        { href: '/mgmt-portal-x7k9p2/promos', label: 'Promos', icon: Tag },
        { href: '/mgmt-portal-x7k9p2/settings', label: 'Settings', icon: Settings },
      ] as const,
    []
  )

  const groupedNav = useMemo(() => {
    const visible = navItems
    return {
      main: visible.filter((i) => ['Dashboard', 'Users', 'Suspended'].includes(i.label)),
      operations: visible.filter((i) => ['Live Monitor', 'Games', 'Tournaments', 'Broadcast', 'Rooms'].includes(i.label)),
      finance: visible.filter((i) => ['Deposits', 'Withdrawals', 'Transactions', 'Banks'].includes(i.label)),
      system: visible.filter((i) => ['Promos', 'Settings'].includes(i.label)),
    }
  }, [navItems])

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon

    const isActive =
      item.href === '/mgmt-portal-x7k9p2'
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + '/')

    return (
      <Link
        key={item.href}
        href={item.href}
        className={
          isActive
            ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#d4af35]/10 text-[#d4af35] transition-colors'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#b6b1a0] hover:bg-white/5 hover:text-white transition-colors'
        }
      >
        <Icon className="w-5 h-5" />
        {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
      </Link>
    )
  }

  const notificationCount = 0

  return (
    <div className="fixed inset-0 bg-[#1C1C1C] text-white font-sans overflow-hidden flex">
      <aside
        className={
          (sidebarCollapsed ? 'w-20' : 'w-64') +
          ' sidebar-transition h-full flex flex-col bg-[#252525] border-r border-[#333333] flex-shrink-0 z-20'
        }
      >
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#333333]">
          <div className="w-8 h-8 rounded-full bg-[#1C1C1C] border border-[#d4af35]/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#d4af35]" />
          </div>
          {!sidebarCollapsed && <h1 className="text-white text-lg font-bold tracking-tight truncate">GamingAdmin</h1>}
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupedNav.main.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">Main</p>
                </div>
              )}
              {groupedNav.main.map(renderNavItem)}
            </>
          )}

          {groupedNav.operations.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 mt-4">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">Operations</p>
                </div>
              )}
              {groupedNav.operations.map(renderNavItem)}
            </>
          )}

          {groupedNav.finance.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 mt-4">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">Finance</p>
                </div>
              )}
              {groupedNav.finance.map(renderNavItem)}
            </>
          )}

          {groupedNav.system.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2 mt-4">
                  <p className="text-xs font-semibold text-[#b6b1a0] uppercase tracking-wider">System</p>
                </div>
              )}
              {groupedNav.system.map(renderNavItem)}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#333333] space-y-2">
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-[#b6b1a0] hover:text-white transition-all text-sm font-medium"
            type="button"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>
          <button
            onClick={() => {
              void (async () => {
                try {
                  setLoggingOut(true)
                  await logout()
                } finally {
                  router.replace('/mgmt-portal-x7k9p2/login')
                  setLoggingOut(false)
                }
              })()
            }}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-[#b6b1a0] hover:text-white transition-all text-sm font-medium"
            type="button"
            disabled={loggingOut}
          >
            <Shield className="w-4 h-4" />
            {!sidebarCollapsed && <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="h-16 bg-[#252525] border-b border-[#333333] z-10 flex-shrink-0">
          <div className="h-full max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <h2 className="text-white text-lg font-bold tracking-tight">{title}</h2>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-400">System Online</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center relative">
                <Search className="w-4 h-4 absolute left-3 text-[#b6b1a0]" />
                <input
                  className="h-10 pl-10 pr-4 w-72 bg-[#1C1C1C] border border-[#333333] rounded-lg text-sm text-white placeholder-[#b6b1a0] focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] transition-all outline-none"
                  placeholder="Search users, games..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="h-6 w-px bg-[#333333] mx-1" />

              <button
                className="relative p-2 text-[#b6b1a0] hover:text-white transition-colors rounded-lg hover:bg-white/5"
                type="button"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-[#252525]" />
                )}
              </button>

              <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white group-hover:text-[#d4af35] transition-colors">{admin?.username || 'Admin'}</p>
                  <p className="text-xs text-[#b6b1a0]">{admin?.role === 'super_admin' ? 'Super Admin' : (admin?.role || 'Admin')}</p>
                </div>
                <div className="w-10 h-10 rounded-full ring-2 ring-[#333333] group-hover:ring-[#d4af35] transition-all flex items-center justify-center bg-[#1C1C1C] text-[#d4af35] font-bold">
                  {String(admin?.username || '?').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#1C1C1C] p-6 lg:p-10 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
