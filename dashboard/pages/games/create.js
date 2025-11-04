import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';

const ENTRY_FEES = [5, 7, 10, 20, 50, 100];

export default function CreateGame() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    entry_fee: 5,
    max_players: 100
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('games')
        .insert({
          entry_fee: formData.entry_fee,
          status: 'waiting',
          prize_pool: 0,
          called_numbers: []
        })
        .select()
        .single();

      if (error) throw error;

      alert('Game created successfully!');
      router.push('/games');
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create Game - Bingo Vault</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 mb-4"
            >
              ← Back to Games
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Create New Game</h1>
            <p className="text-gray-600 mt-1">Set up a new Bingo game for players</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8">
            {/* Entry Fee */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Entry Fee (Birr)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {ENTRY_FEES.map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => setFormData({ ...formData, entry_fee: fee })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.entry_fee === fee
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl font-bold">{fee}</div>
                    <div className="text-sm text-gray-600">Birr</div>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Players will pay this amount to join the game
              </p>
            </div>

            {/* Max Players */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Maximum Players
              </label>
              <input
                type="number"
                value={formData.max_players}
                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                min="2"
                max="1000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-2">
                Maximum number of players allowed in this game
              </p>
            </div>

            {/* Prize Pool Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Prize Pool Calculation</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <div>Entry Fee: {formData.entry_fee} Birr</div>
                <div>Max Players: {formData.max_players}</div>
                <div className="font-bold pt-2 border-t border-blue-200">
                  Maximum Prize Pool: {formData.entry_fee * formData.max_players} Birr
                </div>
              </div>
            </div>

            {/* Game Rules */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Game Rules</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 75-ball Bingo (numbers 1-75)</li>
                <li>• 5x5 card with FREE center space</li>
                <li>• First player to complete a line wins</li>
                <li>• Winner takes entire prize pool</li>
                <li>• Numbers called randomly, no repeats</li>
              </ul>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
