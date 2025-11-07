import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function SuperLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call super admin auth API (local)
      const response = await fetch('/api/super-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 423) {
          setError('Account locked due to too many failed attempts. Try again in 30 minutes.');
        } else {
          setError(data.error || 'Invalid credentials. Access denied.');
        }
        return;
      }

      if (data.success) {
        // Set super admin session
        localStorage.setItem('superAdminAuth', 'true');
        localStorage.setItem('superAdminToken', data.sessionToken);
        localStorage.setItem('superAdminUsername', data.admin.username);
        localStorage.setItem('superAdminEmail', data.admin.email);
        localStorage.setItem('superAdminId', data.admin.id);
        localStorage.setItem('superLoginTime', Date.now().toString());
        localStorage.setItem('superLastActivity', Date.now().toString());

        // Redirect to super admin dashboard
        router.push('/super-admin');
      } else {
        setError('Invalid credentials. Access denied.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Super Admin Login - Yegna Bingo</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-2xl shadow-2xl mb-4">
              <span className="text-5xl">👑</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Super Admin</h1>
            <p className="text-gray-400">System Owner Access Only</p>
          </div>

          {/* Login Card */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  placeholder="Enter super admin username"
                  required
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  placeholder="Enter super admin password"
                  required
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                {loading ? 'Authenticating...' : '🔐 Access Super Admin'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-center text-gray-500 text-xs">
                ⚠️ Unauthorized access is prohibited
              </p>
              <p className="text-center text-gray-600 text-xs mt-1">
                This area is restricted to system owners only
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-xs">
              🔒 Secure connection • All access logged
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
