import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutReason, setLogoutReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already authenticated
    const isAuth = localStorage.getItem('adminAuth');
    if (isAuth) {
      router.push('/games');
    }

    // Check for logout reason
    const reason = router.query.reason;
    if (reason) {
      setLogoutReason(decodeURIComponent(reason));
    }
  }, [router.query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call admin auth API (using simple version for testing)
      const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'https://yegna-bingo-bot.vercel.app';
      const response = await fetch(`${botUrl}/api/admin-auth-simple`, {
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
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }

      if (!data.success) {
        setError('Login failed');
        setLoading(false);
        return;
      }

      const admin = data.admin;
      const sessionToken = data.sessionToken;
      
      // Store auth data
      localStorage.setItem('adminAuth', 'true');
      localStorage.setItem('sessionToken', sessionToken);
      localStorage.setItem('adminId', admin.id);
      localStorage.setItem('adminUsername', admin.username);
      localStorage.setItem('loginTime', Date.now().toString());
      localStorage.setItem('lastActivity', Date.now().toString());

      // Redirect to dashboard
      router.push('/games');
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const generateSessionToken = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  return (
    <>
      <Head>
        <title>Admin Login - Bingo Vault</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
        <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              🎮 Bingo Vault
            </h1>
            <p className="text-gray-600">Admin Dashboard</p>
          </div>

          {logoutReason && (
            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg text-sm">
              ⚠️ {logoutReason}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username or Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username or email"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">🔒 Protected Admin Area</p>
            <p className="text-xs text-gray-400 mt-2">
              Default: <code className="bg-gray-100 px-1 rounded">admin</code> / <code className="bg-gray-100 px-1 rounded">YegnaBingo2025!</code>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
