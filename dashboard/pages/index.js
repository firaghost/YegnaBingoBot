import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
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

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>YegnaBingo Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for YegnaBingo" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #8b5cf6, #ec4899);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #7c3aed, #db2777);
          }
        `}</style>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Animated Background Pattern */}
        <div className="fixed inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Header */}
        <header className="relative bg-black/40 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
                  <div className="relative w-14 h-14 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl">
                    <span className="text-white text-2xl font-black">🎮</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight">YegnaBingo</h1>
                  <p className="text-sm text-purple-300 font-medium">Admin Control Center</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all font-bold shadow-lg hover:shadow-red-500/50 transform hover:scale-105"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Total Users */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-3xl">👥</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-200 mb-1">TOTAL USERS</p>
                    <p className="text-4xl font-black text-white">{stats.totalUsers}</p>
                  </div>
                </div>
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
              </div>
            </div>

            {/* Pending Payments */}
            <div className="relative group cursor-pointer" onClick={() => router.push('/payments')}>
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                    <span className="text-3xl">⏳</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-yellow-200 mb-1">PENDING</p>
                    <p className="text-4xl font-black text-white">{stats.pendingPayments}</p>
                  </div>
                </div>
                {stats.pendingPayments > 0 && (
                  <div className="flex items-center space-x-2 text-yellow-300 font-bold text-sm animate-pulse">
                    <span>⚠️</span>
                    <span>REQUIRES ATTENTION</span>
                  </div>
                )}
                <div className="h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"></div>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-3xl">💰</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-200 mb-1">REVENUE</p>
                    <p className="text-4xl font-black text-white">{stats.totalRevenue}</p>
                    <p className="text-sm text-green-300 font-bold">ETB</p>
                  </div>
                </div>
                <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Games Overview */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-2xl"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🎯</span>
                </div>
                <h2 className="text-2xl font-black text-white">GAME STATUS</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Waiting Games */}
                <div className="relative group cursor-pointer transform hover:scale-105 transition-transform"
                     onClick={() => router.push('/games/waiting')}>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-yellow-500/30 to-orange-500/30 backdrop-blur-sm rounded-xl p-6 border-2 border-yellow-400/50 hover:border-yellow-400 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-5xl">⏰</span>
                      <div className="text-right">
                        <p className="text-6xl font-black text-white">{stats.waitingGames}</p>
                      </div>
                    </div>
                    <p className="text-yellow-200 font-bold text-lg uppercase tracking-wide">Waiting to Start</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"></div>
                  </div>
                </div>

                {/* Active Games */}
                <div className="relative group cursor-pointer transform hover:scale-105 transition-transform"
                     onClick={() => router.push('/games/active')}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-green-500/30 to-emerald-500/30 backdrop-blur-sm rounded-xl p-6 border-2 border-green-400/50 hover:border-green-400 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-5xl animate-pulse">🎮</span>
                      <div className="text-right">
                        <p className="text-6xl font-black text-white">{stats.activeGames}</p>
                      </div>
                    </div>
                    <p className="text-green-200 font-bold text-lg uppercase tracking-wide">Live Games</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* Completed Games */}
                <div className="relative group cursor-pointer transform hover:scale-105 transition-transform"
                     onClick={() => router.push('/games/completed')}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative bg-gradient-to-br from-blue-500/30 to-purple-500/30 backdrop-blur-sm rounded-xl p-6 border-2 border-blue-400/50 hover:border-blue-400 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-5xl">✅</span>
                      <div className="text-right">
                        <p className="text-6xl font-black text-white">{stats.completedGames}</p>
                      </div>
                    </div>
                    <p className="text-blue-200 font-bold text-lg uppercase tracking-wide">Completed</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Games */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Quick Actions */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600/20 to-purple-600/20 rounded-2xl blur-2xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <span className="text-xl">⚡</span>
                  </div>
                  <h2 className="text-xl font-black text-white">QUICK ACTIONS</h2>
                </div>
                
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/games/create')}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-bold text-lg shadow-lg hover:shadow-purple-500/50 transform hover:scale-105 flex items-center justify-center space-x-2"
                  >
                    <span className="text-2xl">➕</span>
                    <span>CREATE NEW GAME</span>
                  </button>
                  
                  <button
                    onClick={() => router.push('/games/waiting')}
                    className="w-full px-6 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-xl hover:from-yellow-700 hover:to-orange-700 transition-all font-bold shadow-lg hover:shadow-yellow-500/50 transform hover:scale-105 flex items-center justify-center space-x-2"
                  >
                    <span className="text-2xl">⏰</span>
                    <span>MANAGE WAITING</span>
                  </button>
                  
                  <button
                    onClick={() => router.push('/payments')}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all font-bold shadow-lg hover:shadow-blue-500/50 transform hover:scale-105 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">💳</span>
                      <span>REVIEW PAYMENTS</span>
                    </div>
                    {stats.pendingPayments > 0 && (
                      <span className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-black animate-pulse">
                        {stats.pendingPayments}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Games */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-2xl blur-2xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🎲</span>
                  </div>
                  <h2 className="text-xl font-black text-white">RECENT GAMES</h2>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {recentGames.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-6xl opacity-50">🎮</span>
                      <p className="text-gray-400 mt-3 font-medium">No games yet</p>
                    </div>
                  ) : (
                    recentGames.map((game) => (
                      <div
                        key={game.id}
                        className="relative group cursor-pointer"
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
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-bold text-white text-lg">{game.entry_fee} ETB Game</p>
                              <p className="text-sm text-gray-300">
                                {game.game_players?.[0]?.count || 0} players • {game.prize_pool} ETB pool
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                              game.status === 'waiting' ? 'bg-yellow-500 text-black' :
                              game.status === 'active' ? 'bg-green-500 text-black animate-pulse' :
                              'bg-blue-500 text-white'
                            }`}>
                              {game.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-2xl blur-2xl"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🟢</span>
                </div>
                <h2 className="text-xl font-black text-white">SYSTEM STATUS</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-4 border border-green-400/30">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                    <div>
                      <p className="text-sm text-green-200 font-medium">Database</p>
                      <p className="font-bold text-white text-lg">ONLINE</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-4 border border-green-400/30">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                    <div>
                      <p className="text-sm text-green-200 font-medium">Telegram Bot</p>
                      <p className="font-bold text-white text-lg">ACTIVE</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-4 border border-green-400/30">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                    <div>
                      <p className="text-sm text-green-200 font-medium">Mini App</p>
                      <p className="font-bold text-white text-lg">RUNNING</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
