import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../../lib/supabaseClient';
import { formatLocalTime, getRelativeTime } from '../../../lib/utils';

export default function GameDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadGameDetails();
    }
  }, [id]);

  async function loadGameDetails() {
    try {
      const response = await fetch(`/api/get-game-details?id=${id}`);
      const { game, error } = await response.json();

      if (error) throw new Error(error);
      setGame(game);
    } catch (error) {
      console.error('Error loading game:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white font-bold text-lg">Loading game details...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white mb-4">GAME NOT FOUND</h2>
          <button onClick={() => router.push('/games')} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-bold">← BACK TO GAMES</button>
        </div>
      </div>
    );
  }

  const winner = game.game_players?.find(p => p.user_id === game.winner_id);
  const winnerPrize = (game.prize_pool || 0) * 0.9;
  const commission = (game.prize_pool || 0) * 0.1;

  return (
    <>
      <Head>
        <title>Game Details - {game.entry_fee} ETB</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="fixed inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <header className="relative bg-black/40 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <button onClick={() => router.back()} className="text-white hover:text-purple-300 transition-colors">← Back</button>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">{game.entry_fee} ETB GAME DETAILS</h1>
                  <p className="text-sm text-gray-400">ID: {game.id.substring(0, 8)}...</p>
                </div>
              </div>
              <button onClick={handleLogout} className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all font-bold">🚪 Logout</button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <div className="flex gap-3 mb-8">
            <span className={`px-6 py-3 rounded-xl text-sm font-black shadow-lg ${
              game.status === 'completed' ? 'bg-blue-500 text-white' :
              game.status === 'active' ? 'bg-green-500 text-black animate-pulse' :
              'bg-yellow-500 text-black'
            }`}>
              {game.status === 'completed' ? '✅ COMPLETED' :
               game.status === 'active' ? '🎮 ACTIVE' :
               '⏳ WAITING'}
            </span>
            {winner && (
              <span className="px-6 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-lg">
                🏆 WINNER: {winner.users?.username || 'Unknown'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-blue-500/20 backdrop-blur-xl rounded-2xl p-6 border border-blue-400/30">
                <h3 className="text-blue-200 text-sm font-bold">PLAYERS</h3>
                <p className="text-5xl font-black text-white mt-2">{game.game_players?.length || 0}</p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-green-500/20 backdrop-blur-xl rounded-2xl p-6 border border-green-400/30">
                <h3 className="text-green-200 text-sm font-bold">PRIZE POOL</h3>
                <p className="text-5xl font-black text-white mt-2">{game.prize_pool || 0}</p>
                <p className="text-xs text-green-300">ETB</p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-yellow-500/20 backdrop-blur-xl rounded-2xl p-6 border border-yellow-400/30">
                <h3 className="text-yellow-200 text-sm font-bold">WINNER PRIZE</h3>
                <p className="text-5xl font-black text-white mt-2">{winnerPrize.toFixed(0)}</p>
                <p className="text-xs text-yellow-300">ETB (90%)</p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-purple-500/20 backdrop-blur-xl rounded-2xl p-6 border border-purple-400/30">
                <h3 className="text-purple-200 text-sm font-bold">COMMISSION</h3>
                <p className="text-5xl font-black text-white mt-2">{commission.toFixed(0)}</p>
                <p className="text-xs text-purple-300">ETB (10%)</p>
              </div>
            </div>
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-black text-white mb-6">⏱️ TIMELINE</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-3xl">📅</span>
                  <div>
                    <p className="font-bold text-white">Created</p>
                    <p className="text-sm text-gray-300">{formatLocalTime(game.created_at)}</p>
                    <p className="text-xs text-gray-400">{getRelativeTime(game.created_at)}</p>
                  </div>
                </div>
                {game.started_at && (
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-3xl">🚀</span>
                    <div>
                      <p className="font-bold text-white">Started</p>
                      <p className="text-sm text-gray-300">{formatLocalTime(game.started_at)}</p>
                      <p className="text-xs text-gray-400">{getRelativeTime(game.started_at)}</p>
                    </div>
                  </div>
                )}
                {game.ended_at && (
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-3xl">🏁</span>
                    <div>
                      <p className="font-bold text-white">Ended</p>
                      <p className="text-sm text-gray-300">{formatLocalTime(game.ended_at)}</p>
                      <p className="text-xs text-gray-400">{getRelativeTime(game.ended_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-black text-white mb-6">👥 PLAYERS ({game.game_players?.length || 0})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {game.game_players?.map((player) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      player.user_id === game.winner_id
                        ? 'border-yellow-400 bg-yellow-500/30 shadow-lg shadow-yellow-500/50'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-black text-white text-lg">
                          {player.user_id === game.winner_id && '🏆 '}
                          {player.users?.username || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-400">
                          ID: {player.users?.telegram_id || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold px-3 py-1 rounded-lg ${player.paid ? 'bg-green-500/30 text-green-200' : 'bg-red-500/30 text-red-200'}`}>
                          {player.paid ? '✅ PAID' : '❌ NOT PAID'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {game.called_numbers && game.called_numbers.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl"></div>
              <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-black text-white mb-6">
                  🎯 CALLED NUMBERS ({game.called_numbers.length}/75)
                </h2>
                <div className="flex flex-wrap gap-2">
                  {game.called_numbers.map((num, index) => (
                    <span
                      key={num}
                      className={`w-12 h-12 flex items-center justify-center rounded-xl font-black text-lg transition-all ${
                        index === game.called_numbers.length - 1
                          ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-4 ring-yellow-300 scale-110 shadow-lg'
                          : 'bg-gradient-to-br from-green-500 to-emerald-500 text-white'
                      }`}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// Prevent static generation - this page needs dynamic routing
export async function getServerSideProps() {
  return {
    props: {}
  };
}
