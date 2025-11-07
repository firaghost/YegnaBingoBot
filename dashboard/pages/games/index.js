import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';
import ProtectedRoute from '../../components/ProtectedRoute';
import AdminLayout from '../../components/AdminLayout';

function GamesPageContent() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('games-changes')
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
      const response = await fetch('/api/get-games');
      const { games, error } = await response.json();

      if (error) throw new Error(error);
      setGames(games || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  }

  async function startGame(gameId) {
    try {
      // Call the local API route
      const response = await fetch('/api/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start game');
      }

      alert(`Game started! ${data.playersCharged} players charged.`);
      router.push(`/games/live/${gameId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game: ' + error.message);
    }
  }

  async function deleteGame(gameId) {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      const response = await fetch('/api/delete-game', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete game');
      }

      alert('Game deleted successfully!');
      loadGames(); // Reload the games list
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game: ' + error.message);
    }
  }

  return (
    <AdminLayout>
      <Head>
        <title>Games Management - Yegna Bingo</title>
      </Head>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Games Management</h1>
            <p className="text-base text-gray-600 mt-2">Create and manage Bingo games</p>
          </div>
          <button
            onClick={() => router.push('/games/create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <span>➕</span>
            Create New Game
          </button>
        </div>

        {/* Stats - Clickable Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/games/waiting')}
            className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-6 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">⏰</span>
              <span className="text-xs text-gray-500">View →</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Waiting Games</div>
            <div className="text-3xl font-bold text-yellow-600 mt-1">
              {games.filter(g => g.status === 'waiting').length}
            </div>
          </button>
          <button
            onClick={() => router.push('/games/active')}
            className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-6 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🎮</span>
              <span className="text-xs text-gray-500">View →</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Active Games</div>
            <div className="text-3xl font-bold text-green-600 mt-1">
              {games.filter(g => g.status === 'active').length}
            </div>
          </button>
          <button
            onClick={() => router.push('/games/completed')}
            className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-6 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">✅</span>
              <span className="text-xs text-gray-500">View →</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Completed Games</div>
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
        ) : games.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Games Yet</h3>
            <p className="text-gray-600 mb-6">Create your first game to get started</p>
            <button
              onClick={() => router.push('/games/create')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Create Game
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <div key={game.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {game.entry_fee} Birr Game
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            game.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : game.status === 'waiting'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {game.status === 'active' ? '🔴 Live' : game.status === 'waiting' ? '⏳ Waiting' : '✅ Completed'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <div className="text-gray-600 text-sm">Players</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {game.game_players?.length || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 text-sm">Prize Pool</div>
                            <div className="text-lg font-semibold text-green-600">
                              {game.prize_pool} Birr
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 text-sm">Numbers Called</div>
                            <div className="text-lg font-semibold text-blue-600">
                              {game.called_numbers?.length || 0}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 text-sm">Created</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {new Date(game.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>

                        {/* Players List */}
                        {game.game_players && game.game_players.length > 0 && (
                          <div className="mt-4">
                            <div className="text-sm text-gray-600 mb-2">Players:</div>
                            <div className="flex flex-wrap gap-2">
                              {game.game_players.slice(0, 5).map((player, index) => (
                                <span key={index} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                                  {player.users?.username || 'Player ' + (index + 1)}
                                </span>
                              ))}
                              {game.game_players.length > 5 && (
                                <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                                  +{game.game_players.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 ml-6">
                        {game.status === 'waiting' && (
                          <>
                            <button
                              onClick={() => startGame(game.id)}
                              disabled={!game.game_players || game.game_players.length === 0}
                              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                            >
                              Start Game
                            </button>
                            <button
                              onClick={() => deleteGame(game.id)}
                              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {game.status === 'active' && (
                          <button
                            onClick={() => router.push(`/games/live/${game.id}`)}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                          >
                            Control Game
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/games/${game.id}`)}
                          className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </AdminLayout>
  );
}

export default function GamesPage() {
  return (
    <ProtectedRoute>
      <GamesPageContent />
    </ProtectedRoute>
  );
}
