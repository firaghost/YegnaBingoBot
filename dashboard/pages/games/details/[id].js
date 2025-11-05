import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../../lib/supabaseClient';
import ProtectedRoute from '../../../components/ProtectedRoute';
import AdminLayout from '../../../components/AdminLayout';

function GameDetailsContent() {
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading game details...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!game) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Game Not Found</h2>
          <button
            onClick={() => router.push('/games')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Games
          </button>
        </div>
      </AdminLayout>
    );
  }

  const winner = game.game_players?.find(p => p.user_id === game.winner_id);
  const winnerPrize = (game.prize_pool || 0) * 0.9;
  const commission = (game.prize_pool || 0) * 0.1;

  return (
    <AdminLayout>
      <Head>
        <title>Game Details - {game.entry_fee} Birr Game</title>
      </Head>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{game.entry_fee} Birr Game Details</h1>
            <p className="text-gray-600 mt-1">Game ID: {game.id.substring(0, 8)}...</p>
          </div>
          <button
            onClick={() => router.back()}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
          >
            ← Back
          </button>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${
            game.status === 'completed' ? 'bg-gray-100 text-gray-800' :
            game.status === 'active' ? 'bg-green-100 text-green-800' :
            game.status === 'countdown' ? 'bg-orange-100 text-orange-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {game.status === 'completed' ? '✅ Completed' :
             game.status === 'active' ? '🎮 Active' :
             game.status === 'countdown' ? '⏰ Countdown' :
             '⏳ Waiting'}
          </span>
          {winner && (
            <span className="ml-3 px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              🏆 Winner: {winner.users?.username || 'Unknown'}
            </span>
          )}
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Players</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{game.game_players?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Prize Pool</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{game.prize_pool || 0} Birr</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Winner Prize</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{winnerPrize.toFixed(2)} Birr</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Commission</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">{commission.toFixed(2)} Birr</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Timeline</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-medium">Created</p>
                <p className="text-sm text-gray-600">{new Date(game.created_at).toLocaleString()}</p>
              </div>
            </div>
            {game.started_at && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                <div>
                  <p className="font-medium">Started</p>
                  <p className="text-sm text-gray-600">{new Date(game.started_at).toLocaleString()}</p>
                </div>
              </div>
            )}
            {game.ended_at && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏁</span>
                <div>
                  <p className="font-medium">Ended</p>
                  <p className="text-sm text-gray-600">{new Date(game.ended_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Players List */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Players ({game.game_players?.length || 0})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {game.game_players?.map((player) => (
              <div
                key={player.id}
                className={`p-4 rounded-lg border-2 ${
                  player.user_id === game.winner_id
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">
                      {player.users?.username || 'Unknown'}
                      {player.user_id === game.winner_id && ' 🏆'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Telegram ID: {player.users?.telegram_id || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${player.paid ? 'text-green-600' : 'text-red-600'}`}>
                      {player.paid ? '✅ Paid' : '❌ Not Paid'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Called Numbers */}
        {game.called_numbers && game.called_numbers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Called Numbers ({game.called_numbers.length}/75)
            </h2>
            <div className="flex flex-wrap gap-2">
              {game.called_numbers.map((num) => (
                <span
                  key={num}
                  className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-full font-bold"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function GameDetails() {
  return (
    <ProtectedRoute>
      <GameDetailsContent />
    </ProtectedRoute>
  );
}

// Prevent static generation - this page needs dynamic routing
export async function getServerSideProps() {
  return {
    props: {}
  };
}
