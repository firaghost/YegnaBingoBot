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

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  return (
    <>
      <Head>
        <title>Create Game - YegnaBingo Admin</title>
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
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">➕</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">CREATE NEW GAME</h1>
                  <p className="text-sm text-purple-300">Setup Bingo Game</p>
                </div>
              </div>
              <button onClick={handleLogout} className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 transition-all font-bold">🚪 Logout</button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit} className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-2xl"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
              <div className="mb-8">
                <label className="block text-lg font-black text-white mb-4">💰 ENTRY FEE</label>
                <div className="grid grid-cols-3 gap-4">
                  {ENTRY_FEES.map((fee) => (
                    <button
                      key={fee}
                      type="button"
                      onClick={() => setFormData({ ...formData, entry_fee: fee })}
                      className={`relative p-6 rounded-xl border-2 transition-all transform hover:scale-105 ${
                        formData.entry_fee === fee
                          ? 'border-purple-400 bg-purple-500/30 shadow-lg shadow-purple-500/50'
                          : 'border-white/20 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <div className="text-4xl font-black text-white">{fee}</div>
                      <div className="text-sm text-gray-300 font-medium">ETB</div>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  💳 Players will pay this amount to join the game
                </p>
              </div>

              <div className="mb-8">
                <label className="block text-lg font-black text-white mb-4">👥 MAXIMUM PLAYERS</label>
                <input
                  type="number"
                  value={formData.max_players}
                  onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                  min="2"
                  max="1000"
                  className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white text-2xl font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-400 backdrop-blur-sm"
                />
                <p className="text-sm text-gray-400 mt-3">
                  🎯 Maximum number of players allowed in this game
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400/30 rounded-xl p-6 mb-8 backdrop-blur-sm">
                <h3 className="font-black text-green-200 mb-4 text-lg">💎 PRIZE POOL CALCULATION</h3>
                <div className="space-y-3 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Entry Fee:</span>
                    <span className="text-2xl font-black">{formData.entry_fee} ETB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Max Players:</span>
                    <span className="text-2xl font-black">{formData.max_players}</span>
                  </div>
                  <div className="h-px bg-green-400/30 my-3"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-200 font-bold">Maximum Prize Pool:</span>
                    <span className="text-3xl font-black text-green-300">{formData.entry_fee * formData.max_players} ETB</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/20 border-2 border-blue-400/30 rounded-xl p-6 mb-8 backdrop-blur-sm">
                <h3 className="font-black text-blue-200 mb-4 text-lg">📋 GAME RULES</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">🎯</span>
                    <span>75-ball Bingo (numbers 1-75)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">🎴</span>
                    <span>5x5 card with FREE center space</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">🏆</span>
                    <span>First player to complete a line wins</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">💰</span>
                    <span>Winner takes 90% (10% commission)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">🔀</span>
                    <span>Numbers called randomly, no repeats</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 px-6 py-4 bg-white/10 border-2 border-white/20 text-white rounded-xl hover:bg-white/20 transition-all font-bold text-lg"
                >
                  ❌ CANCEL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-bold text-lg shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                >
                  {loading ? '⏳ CREATING...' : '✨ CREATE GAME'}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </>
  );
}
