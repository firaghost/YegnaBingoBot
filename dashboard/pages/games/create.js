import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
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
    <AdminLayout>
      <Head>
        <title>Create Game - YegnaBingo Admin</title>
      </Head>

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Create New Game</h1>
          <p className="text-base text-gray-600 mt-2">Setup a new Bingo game</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Entry Fee (Birr)</label>
            <div className="grid grid-cols-3 gap-3">
              {ENTRY_FEES.map((fee) => (
                <button
                  key={fee}
                  type="button"
                  onClick={() => setFormData({ ...formData, entry_fee: fee })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.entry_fee === fee
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl font-bold">{fee}</div>
                  <div className="text-xs text-gray-500">Birr</div>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Players will pay this amount to join</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Players</label>
            <input
              type="number"
              value={formData.max_players}
              onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
              min="2"
              max="1000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-2">Maximum number of players allowed</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">Prize Pool Calculation</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Entry Fee:</span>
                <span className="font-semibold">{formData.entry_fee} Birr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Players:</span>
                <span className="font-semibold">{formData.max_players}</span>
              </div>
              <div className="border-t border-green-200 my-2"></div>
              <div className="flex justify-between">
                <span className="text-green-700 font-medium">Maximum Prize Pool:</span>
                <span className="text-lg font-bold text-green-700">{formData.entry_fee * formData.max_players} Birr</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Game Rules</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>75-ball Bingo (numbers 1-75)</span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>5x5 card with FREE center space</span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>First player to complete a line wins</span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>Winner takes 90% (10% commission)</span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>Numbers called randomly, no repeats</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
