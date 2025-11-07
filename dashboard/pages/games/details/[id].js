import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../../components/AdminLayout';
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!game) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Game Not Found</h3>
          <p className="text-gray-600 mb-6">This game doesn't exist or has been deleted</p>
          <button onClick={() => router.push('/games')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Back to Games
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head>
        <title>Game Details - YegnaBingo Admin</title>
      </Head>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Game Details</h1>
            <p className="text-gray-600 mt-1">{game.entry_fee} Birr Game</p>
          </div>
          <button onClick={() => router.back()} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
            Back
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{game.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Players</p>
              <p className="text-lg font-semibold text-gray-900">{game.game_players?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Prize Pool</p>
              <p className="text-lg font-semibold text-green-600">{game.prize_pool} Birr</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Numbers Called</p>
              <p className="text-lg font-semibold text-gray-900">{game.called_numbers?.length || 0}/75</p>
            </div>
          </div>
        </div>

        {game.game_players && game.game_players.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Players</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {game.game_players.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{player.users?.username || 'Unknown'}</span>
                  {player.user_id === game.winner_id && <span className="text-yellow-600 font-semibold">🏆 Winner</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {game.called_numbers && game.called_numbers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Called Numbers</h3>
            <div className="flex flex-wrap gap-2">
              {game.called_numbers.map((num, idx) => (
                <span key={idx} className="w-10 h-10 flex items-center justify-center bg-indigo-100 text-indigo-700 font-semibold rounded-lg">
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
 