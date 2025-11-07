import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingPayments: 0,
    waitingGames: 0,
    activeGames: 0,
    completedGames: 0,
    totalRevenue: 0,
  });
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth) {
      router.push('/login');
      return;
    }
    fetchData();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Get total users
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get pending payments
      const { count: pendingCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get games by status
      const { count: waitingCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting');

      const { count: activeCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: completedCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Get total revenue (sum of all approved payments)
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'approved');

      const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Get recent games
      const { data: games } = await supabase
        .from('games')
        .select('*, game_players(count)')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalUsers: usersCount || 0,
        pendingPayments: pendingCount || 0,
        waitingGames: waitingCount || 0,
        activeGames: activeCount || 0,
        completedGames: completedCount || 0,
        totalRevenue,
      });

      setRecentGames(games || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head>
        <title>YegnaBingo Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for YegnaBingo" />
      </Head>
      
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="text-base text-gray-600 mt-2">
              Welcome to YegnaBingo Admin Control Center
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Users */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <h3 className="text-sm font-medium opacity-90 mb-1">Total Users</h3>
            <p className="text-3xl font-bold mb-1">{stats.totalUsers}</p>
            <p className="text-xs opacity-75">Registered players</p>
          </div>

          {/* Pending Payments */}
          <div 
            className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => router.push('/payments')}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <span className="text-2xl">⏳</span>
              </div>
              {stats.pendingPayments > 0 && (
                <div className="flex items-center gap-1 text-sm font-medium bg-white/20 px-2 py-1 rounded-full animate-pulse">
                  <span>⚠️</span>
                  <span>{stats.pendingPayments}</span>
                </div>
              )}
            </div>
            <h3 className="text-sm font-medium opacity-90 mb-1">Pending Payments</h3>
            <p className="text-3xl font-bold mb-1">{stats.pendingPayments}</p>
            <p className="text-xs opacity-75">Requires attention</p>
          </div>

          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <span className="text-2xl">💰</span>
              </div>
            </div>
            <h3 className="text-sm font-medium opacity-90 mb-1">Total Revenue</h3>
            <p className="text-3xl font-bold mb-1">{stats.totalRevenue} ETB</p>
            <p className="text-xs opacity-75">Approved payments</p>
          </div>
        </div>

        {/* Games Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Game Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Waiting Games */}
            <div 
              className="bg-yellow-50 rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow border border-yellow-200"
              onClick={() => router.push('/games/waiting')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <span className="text-3xl">⏰</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Waiting to Start</h3>
              <p className="text-3xl font-bold text-yellow-600">{stats.waitingGames}</p>
            </div>

            {/* Active Games */}
            <div 
              className="bg-green-50 rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow border border-green-200"
              onClick={() => router.push('/games/active')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-3xl">🎮</span>
                </div>
                {stats.activeGames > 0 && (
                  <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Active Games</h3>
              <p className="text-3xl font-bold text-green-600">{stats.activeGames}</p>
            </div>

            {/* Completed Games */}
            <div 
              className="bg-blue-50 rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow border border-blue-200"
              onClick={() => router.push('/games/completed')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-3xl">✅</span>
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">Completed</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.completedGames}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Games */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/games/create')}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>➕</span>
                <span>Create New Game</span>
              </button>
              
              <button
                onClick={() => router.push('/games/waiting')}
                className="w-full px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>⏰</span>
                <span>Manage Waiting Games</span>
              </button>
              
              <button
                onClick={() => router.push('/payments')}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>💳</span>
                  <span>Review Payments</span>
                </div>
                {stats.pendingPayments > 0 && (
                  <span className="bg-white text-blue-600 px-2 py-1 rounded-full text-xs font-bold">
                    {stats.pendingPayments}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Recent Games */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Games</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {recentGames.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl opacity-50">🎮</span>
                  <p className="text-gray-500 mt-3 text-sm">No games yet</p>
                </div>
              ) : (
                recentGames.map((game) => (
                  <div
                    key={game.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border border-gray-200"
                    onClick={() => {
                      if (game.status === 'active') {
                        router.push(`/games/live/${game.id}`);
                      } else if (game.status === 'waiting') {
                        router.push(`/games/waiting`);
                      } else {
                        router.push(`/games/completed`);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{game.entry_fee} ETB Game</p>
                        <p className="text-sm text-gray-600">
                          {game.game_players?.[0]?.count || 0} players • {game.prize_pool} ETB pool
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        game.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                        game.status === 'active' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {game.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Database</span>
              </div>
              <span className="text-sm font-semibold text-green-600">ONLINE</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Telegram Bot</span>
              </div>
              <span className="text-sm font-semibold text-green-600">ACTIVE</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Mini App</span>
              </div>
              <span className="text-sm font-semibold text-green-600">RUNNING</span>
            </div>
          </div>
        </div>
        </div>
      </AdminLayout>
  );
}
