import { useRouter } from 'next/router';
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="bg-gradient-to-r from-purple-900 via-pink-900 to-purple-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-2xl">👑</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Yegna Bingo</h1>
                <p className="text-xs text-purple-200">Super Admin Dashboard</p>
              </div>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-yellow-400">👑</span>
                  {superAdminUsername}
                </p>
                {sessionInfo && (
                  <p className="text-xs text-purple-200">
                    {Math.floor(sessionInfo.timeUntilExpiry / 60000)} min left
                  </p>
                )}
              </div>
              <button
                onClick={() => window.location.href = '/super-settings'}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105"
              >
                🔒 Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Security Banner */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 py-2">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm font-semibold">
            🔐 Super Admin Access • System Owner Only • All Actions Logged
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-8rem)]">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>© 2025 Yegna Bingo. All rights reserved.</p>
          <p className="text-xs text-gray-400 mt-1">
            Super Admin Dashboard v1.0 • Secure Session Active • 50/50 Partnership
          </p>
        </div>
      </footer>
    </div>
  );
}
