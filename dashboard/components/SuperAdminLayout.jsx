import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function SuperAdminLayout({ children }) {
  const router = useRouter();
  const [superAdminUsername, setSuperAdminUsername] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    const username = localStorage.getItem('superAdminUsername') || 'Super Admin';
    setSuperAdminUsername(username);

    // Update session info
    const updateSession = () => {
      const loginTime = localStorage.getItem('superLoginTime');
      const lastActivity = localStorage.getItem('superLastActivity');
      
      if (loginTime && lastActivity) {
        const now = Date.now();
        const sessionDuration = now - parseInt(loginTime);
        const timeSinceActivity = now - parseInt(lastActivity);
        const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes for super admin
        const timeUntilExpiry = SESSION_TIMEOUT - timeSinceActivity;

        setSessionInfo({
          sessionDuration,
          timeUntilExpiry,
          isActive: timeUntilExpiry > 0
        });

        // Auto-logout if session expired
        if (timeUntilExpiry <= 0) {
          handleLogout();
        }
      }
    };

    updateSession();
    const interval = setInterval(updateSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('superAdminAuth');
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminUsername');
    localStorage.removeItem('superLoginTime');
    localStorage.removeItem('superLastActivity');
    router.push('/super-login');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/super-admin',
      icon: '📊',
    },
    {
      name: 'Admin Management',
      href: '/super-admin/admins',
      icon: '👥',
    },
    {
      name: 'Commission Reports',
      href: '/super-admin/commissions',
      icon: '💰',
    },
    {
      name: 'System Logs',
      href: '/super-admin/logs',
      icon: '📋',
    },
    {
      name: 'Settings',
      href: '/super-settings',
      icon: '⚙️',
    },
  ];

  const isActive = (path) => {
    if (path === '/super-admin') return router.pathname === '/super-admin';
    return router.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SA</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Super Admin
                </h1>
                <p className="text-xs text-gray-500">
                  System Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {sessionInfo && (
                <div className="hidden md:block text-right">
                  <p className="text-xs text-gray-500">Session expires in</p>
                  <p className="text-sm font-medium text-gray-900">
                    {Math.floor(sessionInfo.timeUntilExpiry / 60000)} minutes
                  </p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span>🚪</span>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] sticky top-[73px]">
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* User Info in Sidebar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">👑</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {superAdminUsername}
                </p>
                <p className="text-xs text-gray-500">Super Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
