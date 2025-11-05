import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';
import ProtectedRoute from '../../components/ProtectedRoute';
import AdminLayout from '../../components/AdminLayout';

function WaitingGamesContent() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('waiting-games-changes')
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
      const response = await fetch('/api/get-games?status=waiting');
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
      const response = await fetch('/api/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start game');
      }

      alert(`Game started! ${data.playersCharged} players charged. Prize Pool: ${data.prizePool} Birr`);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete game');
      }

      alert('Game deleted successfully');
      loadGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game');
    }
  }

  const waitingGames = games.filter(g => g.status === 'waiting');

  return (
    <AdminLayout>
      <Head>
        <title>Waiting Games - Bingo Dashboard</title>
      </Head>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Waiting Games</h1>
            <p className="text-gray-600 mt-1">Games waiting to start</p>
          </div>
        </div>

        {/* Stats - Clickable Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => router.push('/games/waiting')}
            className="bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow p-6 hover:shadow-lg transition-all text-left"
          >
            <h3 className="text-gray-600 text-sm font-medium">Waiting Games</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{waitingGames.length}</p>
            <p className="text-xs text-yellow-600 mt-2 font-medium">● Current Page</p>
          </button>
          <button
            onClick={() => router.push('/games/active')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all text-left hover:scale-105 transform"
          >
            <h3 className="text-gray-600 text-sm font-medium">Active Games</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {games.filter(g => g.status === 'active').length}
            </p>
            <p className="text-xs text-gray-500 mt-2">Click to view →</p>
          </button>
          <button
            onClick={() => router.push('/games/completed')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all text-left hover:scale-105 transform"
          >
            <h3 className="text-gray-600 text-sm font-medium">Completed Games</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {games.filter(g => g.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500 mt-2">Click to view →</p>
          </button>
        </div>

        {/* Games List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading games...</p>
          </div>
        ) : waitingGames.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Waiting Games</h3>
            <p className="text-gray-600">All games have started or there are no games yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {waitingGames.map((game) => (
              <div key={game.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{game.entry_fee} Birr Game</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Waiting
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium">{new Date(game.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Players</p>
                    <p className="text-2xl font-bold text-blue-600">{game.game_players?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Potential Prize</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(game.entry_fee * (game.game_players?.length || 0))} Birr
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Entry Fee</p>
                    <p className="text-2xl font-bold text-gray-900">{game.entry_fee} Birr</p>
                  </div>
                </div>

                {game.game_players && game.game_players.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Players:</p>
                    <div className="flex flex-wrap gap-2">
                      {game.game_players.map((player) => (
                        <span key={player.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                          {player.users?.username || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => startGame(game.id)}
                    disabled={!game.game_players || game.game_players.length === 0}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Start Game
                  </button>
                  <button
                    onClick={() => deleteGame(game.id)}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function WaitingGames() {
  return (
    <ProtectedRoute>
      <WaitingGamesContent />
    </ProtectedRoute>
  );
}
