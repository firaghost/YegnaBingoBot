import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';
import { formatLocalTime, getRelativeTime } from '../../lib/utils';

export default function ActiveGames() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('active-games-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games'
      }, () => {
        loadGames();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function loadGames() {
    try {
      const response = await fetch('/api/get-games?status=active');
      const { games, error } = await response.json();

      if (error) throw new Error(error);
      setGames(games || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  }

  const activeGames = games.filter(g => g.status === 'active');

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  return (
    <>
      <Head>
        <title>Active Games - YegnaBingo Admin</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Background Pattern */}
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
                <button
                  onClick={() => router.push('/')}
                  className="text-white hover:text-purple-300 transition-colors"
                >
                  ← Back
                </button>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center animate-pulse">
                  <span className="text-2xl">🎮</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">ACTIVE GAMES</h1>
                  <p className="text-sm text-green-300">Live Now</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all font-bold"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <button
              onClick={() => router.push('/games/waiting')}
              className="relative group transform hover:scale-105 transition-transform"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-yellow-400 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-200 font-bold text-sm">WAITING</p>
                    <p className="text-5xl font-black text-white mt-2">
                      {games.filter(g => g.status === 'waiting').length}
                    </p>
                  </div>
                  <span className="text-5xl">⏰</span>
                </div>
                <p className="text-yellow-300 text-sm mt-3">Click to view →</p>
              </div>
            </button>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur-xl opacity-75"></div>
              <div className="relative bg-gradient-to-br from-green-500/30 to-emerald-500/30 backdrop-blur-xl rounded-2xl p-6 border-2 border-green-400">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-200 font-bold text-sm">ACTIVE</p>
                    <p className="text-5xl font-black text-white mt-2">{activeGames.length}</p>
                  </div>
                  <span className="text-5xl animate-pulse">🎮</span>
                </div>
                <div className="mt-4 h-1 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse"></div>
              </div>
            </div>

            <button
              onClick={() => router.push('/games/completed')}
              className="relative group transform hover:scale-105 transition-transform"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-blue-400 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 font-bold text-sm">COMPLETED</p>
                    <p className="text-5xl font-black text-white mt-2">
                      {games.filter(g => g.status === 'completed').length}
                    </p>
                  </div>
                  <span className="text-5xl">✅</span>
                </div>
                <p className="text-blue-300 text-sm mt-3">Click to view →</p>
              </div>
            </button>
          </div>

          {/* Games List */}
          {loading ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-2xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-12 border border-white/20 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-500 mx-auto mb-4"></div>
                <p className="text-white font-bold text-lg">Loading active games...</p>
              </div>
            </div>
          ) : activeGames.length === 0 ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-600/20 to-slate-600/20 rounded-2xl blur-2xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-12 border border-white/20 text-center">
                <div className="text-8xl mb-4 opacity-50">🎮</div>
                <h3 className="text-2xl font-black text-white mb-2">NO ACTIVE GAMES</h3>
                <p className="text-gray-300">No games are currently being played</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeGames.map((game) => (
                <div key={game.id} className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:border-green-400/50 transition-all">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-3xl font-black text-white mb-2">{game.entry_fee} ETB GAME</h3>
                        <div className="flex items-center gap-3">
                          <span className="px-4 py-2 rounded-xl text-sm font-bold bg-green-500 text-black animate-pulse">
                            🎮 LIVE NOW
                          </span>
                          <span className="text-gray-400 text-sm">{getRelativeTime(game.started_at || game.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Started</p>
                        <p className="font-bold text-white">{formatLocalTime(game.started_at || game.created_at, false)}</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl p-4 border border-blue-400/30">
                        <p className="text-sm text-blue-200 font-medium">PLAYERS</p>
                        <p className="text-4xl font-black text-white mt-1">{game.game_players?.length || 0}</p>
                      </div>
                      <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-4 border border-green-400/30">
                        <p className="text-sm text-green-200 font-medium">PRIZE POOL</p>
                        <p className="text-4xl font-black text-white mt-1">{game.prize_pool || 0}</p>
                        <p className="text-xs text-green-300">ETB</p>
                      </div>
                      <div className="bg-purple-500/20 backdrop-blur-sm rounded-xl p-4 border border-purple-400/30">
                        <p className="text-sm text-purple-200 font-medium">CALLED</p>
                        <p className="text-4xl font-black text-white mt-1">{game.called_numbers?.length || 0}</p>
                        <p className="text-xs text-purple-300">/ 75</p>
                      </div>
                      <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-4 border border-orange-400/30">
                        <p className="text-sm text-orange-200 font-medium">ENTRY FEE</p>
                        <p className="text-4xl font-black text-white mt-1">{game.entry_fee}</p>
                        <p className="text-xs text-orange-300">ETB</p>
                      </div>
                    </div>

                    {/* Players List */}
                    {game.game_players && game.game_players.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm text-gray-400 font-bold mb-3">ACTIVE PLAYERS:</p>
                        <div className="flex flex-wrap gap-2">
                          {game.game_players.map((player) => (
                            <span key={player.id} className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg text-sm font-medium border border-white/20">
                              👤 {player.users?.username || 'Unknown'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={() => router.push(`/games/live/${game.id}`)}
                      className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold text-lg shadow-lg hover:shadow-green-500/50 transform hover:scale-105"
                    >
                      🎮 CONTROL LIVE GAME
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
