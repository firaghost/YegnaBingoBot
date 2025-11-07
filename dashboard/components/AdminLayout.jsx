import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [adminUsername, setAdminUsername] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [expandedMenu, setExpandedMenu] = useState('Games');

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
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">YB</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Yegna Bingo Admin
                </h1>
                <p className="text-xs text-gray-500">
                  Admin Dashboard
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
            {navItems.map((item) => {
              if (item.submenu) {
                const isExpanded = expandedMenu === item.name;
                const hasActiveChild = item.submenu.some(sub => isActive(sub.path));
                return (
                  <div key={item.name}>
                    <button
                      onClick={() => setExpandedMenu(isExpanded ? null : item.name)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                        hasActiveChild
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.icon}</span>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className={`text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.submenu.map((subItem) => {
                          const active = isActive(subItem.path);
                          return (
                            <Link
                              key={subItem.path}
                              href={subItem.path}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                                active
                                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span>{subItem.icon}</span>
                              <span>{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              
              const active = isActive(item.path);
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
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
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {adminUsername}
                </p>
                <p className="text-xs text-gray-500">Administrator</p>
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
