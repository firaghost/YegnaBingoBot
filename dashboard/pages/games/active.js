import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
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

  return (
    <AdminLayout>
      <Head>
        <title>Active Games - YegnaBingo Admin</title>
      </Head>
      
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Active Games</h1>
          <p className="text-base text-gray-600 mt-2">Live games in progress</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/games/waiting')}
            className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-6 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">⏰</span>
              <span className="text-xs text-gray-500">View →</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Waiting</div>
            <div className="text-3xl font-bold text-yellow-600 mt-1">
              {games.filter(g => g.status === 'waiting').length}
            </div>
          </button>

          <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🎮</span>
              <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">LIVE</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Active</div>
            <div className="text-3xl font-bold text-green-600 mt-1">{activeGames.length}</div>
          </div>

          <button
            onClick={() => router.push('/games/completed')}
            className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-6 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">✅</span>
              <span className="text-xs text-gray-500">View →</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Completed</div>
            <div className="text-3xl font-bold text-blue-600 mt-1">
              {games.filter(g => g.status === 'completed').length}
            </div>
          </button>
        </div>

        {/* Games List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : activeGames.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Games</h3>
            <p className="text-gray-600">No games are currently being played</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeGames.map((game) => (
              <div key={game.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{game.entry_fee} Birr Game</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 animate-pulse">
                        🎮 Live
                      </span>
                      <span className="text-sm text-gray-500">{getRelativeTime(game.started_at || game.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Started</p>
                    <p className="text-sm font-medium text-gray-900">{formatLocalTime(game.started_at || game.created_at, false)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Players</p>
                    <p className="text-2xl font-bold text-gray-900">{game.game_players?.length || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Prize Pool</p>
                    <p className="text-2xl font-bold text-green-600">{game.prize_pool || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Numbers</p>
                    <p className="text-2xl font-bold text-gray-900">{game.called_numbers?.length || 0}/75</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Entry Fee</p>
                    <p className="text-2xl font-bold text-gray-900">{game.entry_fee}</p>
                  </div>
                </div>

                {game.game_players && game.game_players.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 font-medium mb-2">Players:</p>
                    <div className="flex flex-wrap gap-2">
                      {game.game_players.map((player) => (
                        <span key={player.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-900">
                          {player.users?.username || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => router.push(`/games/live/${game.id}`)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Control Live Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
