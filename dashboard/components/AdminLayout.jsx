import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [adminUsername, setAdminUsername] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    const username = localStorage.getItem('adminUsername') || 'Admin';
    setAdminUsername(username);

    // Update session info
    const updateSession = () => {
      const loginTime = localStorage.getItem('loginTime');
      const lastActivity = localStorage.getItem('lastActivity');
      
      if (loginTime && lastActivity) {
        const now = Date.now();
        const sessionDuration = now - parseInt(loginTime);
        const timeSinceActivity = now - parseInt(lastActivity);
        const SESSION_TIMEOUT = 30 * 60 * 1000;
        const timeUntilExpiry = SESSION_TIMEOUT - timeSinceActivity;

        setSessionInfo({
          sessionDuration,
          timeUntilExpiry,
          isActive: timeUntilExpiry > 0
        });
      }
    };

    updateSession();
    const interval = setInterval(updateSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminUsername');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('lastActivity');
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { 
      name: 'Games', 
      icon: '🎮',
      submenu: [
        { name: 'Waiting Games', path: '/games/waiting', icon: '⏳' },
        { name: 'Active Games', path: '/games/active', icon: '🎮' },
        { name: 'Completed Games', path: '/games/completed', icon: '✅' },
      ]
    },
    { name: 'Payments', path: '/payments', icon: '💰' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  const isActive = (path) => {
    if (path === '/') return router.pathname === '/';
    return router.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-2xl">🎮</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Yegna Bingo</h1>
                <p className="text-xs text-indigo-200">Admin Dashboard</p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-2">
              {navItems.map((item) => (
                item.submenu ? (
                  <div key={item.name} className="relative group">
                    <button className="px-4 py-2 rounded-lg transition-all hover:bg-white/10 flex items-center">
                      <span className="mr-2">{item.icon}</span>
                      {item.name}
                      <span className="ml-1">▼</span>
                    </button>
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl py-2 min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      {item.submenu.map((subItem) => (
                        <Link
                          key={subItem.path}
                          href={subItem.path}
                          className={`block px-4 py-2 hover:bg-indigo-50 transition-colors ${
                            isActive(subItem.path) ? 'bg-indigo-100 text-indigo-600 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          <span className="mr-2">{subItem.icon}</span>
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      isActive(item.path)
                        ? 'bg-white text-indigo-600 font-semibold shadow-lg'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                )
              ))}
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-semibold">{adminUsername}</p>
                {sessionInfo && (
                  <p className="text-xs text-indigo-200">
                    {Math.floor(sessionInfo.timeUntilExpiry / 60000)} min left
                  </p>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden pb-3">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                item.submenu ? (
                  <div key={item.name}>
                    <div className="px-3 py-1 text-sm font-semibold text-indigo-200">
                      {item.icon} {item.name}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 pl-4">
                      {item.submenu.map((subItem) => (
                        <Link
                          key={subItem.path}
                          href={subItem.path}
                          className={`px-3 py-1 rounded-lg whitespace-nowrap text-sm ${
                            isActive(subItem.path)
                              ? 'bg-white text-indigo-600 font-semibold'
                              : 'bg-white/10'
                          }`}
                        >
                          {subItem.icon} {subItem.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-3 py-1 rounded-lg whitespace-nowrap text-sm ${
                      isActive(item.path)
                        ? 'bg-white text-indigo-600 font-semibold'
                        : 'bg-white/10'
                    }`}
                  >
                    {item.icon} {item.name}
                  </Link>
                )
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          <p>© 2025 Yegna Bingo. All rights reserved.</p>
          <p className="text-xs text-gray-400 mt-1">
            Admin Dashboard v1.0 • Secure Session Active
          </p>
        </div>
      </footer>
    </div>
  );
}
