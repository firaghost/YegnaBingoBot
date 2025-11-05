import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserId, setBackButton } from '../lib/telegram';
import { supabase } from '../lib/supabase';

export default function History() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('games'); // games, transactions
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    totalWinnings: 0,
    totalLosses: 0,
    netProfit: 0
  });

  useEffect(() => {
    loadUserData();
    setBackButton(() => router.push('/'));
  }, []);

  async function loadUserData() {
    try {
      const telegramId = getUserId();
      console.log('Loading history for telegram ID:', telegramId);
      
      if (!telegramId) {
        console.error('No telegram ID found');
        router.push('/');
        return;
      }

      // Get user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (userError) {
        console.error('Error fetching user:', userError);
      }

      if (!userData) {
        console.error('User not found');
        router.push('/');
        return;
      }

      console.log('User found:', userData.id);
      setUser(userData);

      // Get user's games
      const { data: gamesData, error: gamesError } = await supabase
        .from('game_players')
        .select(`
          *,
          games (
            id,
            entry_fee,
            prize_pool,
            status,
            winner_id,
            created_at,
            started_at,
            ended_at
          )
        `)
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (gamesError) {
        console.error('Error fetching games:', gamesError);
      }

      console.log('Games found:', gamesData?.length || 0);

      // Get user's transactions
      const { data: transactionsData, error: transError } = await supabase
        .from('transaction_history')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (transError) {
        console.error('Error fetching transactions:', transError);
      }

      console.log('Transactions found:', transactionsData?.length || 0);

      setGames(gamesData || []);
      setTransactions(transactionsData || []);

      // Calculate stats
      const completedGames = gamesData?.filter(g => g.games?.status === 'completed') || [];
      const wins = completedGames.filter(g => g.games?.winner_id === userData.id);
      const losses = completedGames.filter(g => g.games?.winner_id !== userData.id);
      
      const totalWinnings = wins.reduce((sum, g) => {
        const prize = (g.games?.prize_pool || 0) * 0.9;
        return sum + prize;
      }, 0);
      
      const totalLosses = losses.reduce((sum, g) => {
        return sum + (g.games?.entry_fee || 0);
      }, 0);

      setStats({
        totalGames: completedGames.length,
        wins: wins.length,
        losses: losses.length,
        totalWinnings,
        totalLosses,
        netProfit: totalWinnings - totalLosses
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading history:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Game History - Yegna Bingo</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/90 to-indigo-900/90 backdrop-blur-sm px-4 py-4 shadow-lg">
          <h1 className="text-2xl font-bold text-white">የጨዋታ ታሪክ</h1>
          <p className="text-purple-200 text-sm">Game History</p>
        </div>

        {/* Stats Cards */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-white/70 text-xs mb-1">Total Games</div>
              <div className="text-2xl font-bold text-white">{stats.totalGames}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-white/70 text-xs mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-white">
                {stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-500/20 backdrop-blur-sm rounded-2xl p-4 border border-green-400/30">
              <div className="text-green-200 text-xs mb-1">Wins</div>
              <div className="text-xl font-bold text-green-100">{stats.wins}</div>
            </div>
            <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl p-4 border border-red-400/30">
              <div className="text-red-200 text-xs mb-1">Losses</div>
              <div className="text-xl font-bold text-red-100">{stats.losses}</div>
            </div>
            <div className={`backdrop-blur-sm rounded-2xl p-4 border ${
              stats.netProfit >= 0 
                ? 'bg-yellow-500/20 border-yellow-400/30' 
                : 'bg-red-500/20 border-red-400/30'
            }`}>
              <div className={`text-xs mb-1 ${stats.netProfit >= 0 ? 'text-yellow-200' : 'text-red-200'}`}>
                Net
              </div>
              <div className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-yellow-100' : 'text-red-100'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-1 flex gap-1">
            <button
              onClick={() => setActiveTab('games')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                activeTab === 'games'
                  ? 'bg-white text-purple-600'
                  : 'text-white/70'
              }`}
            >
              Games
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                activeTab === 'transactions'
                  ? 'bg-white text-purple-600'
                  : 'text-white/70'
              }`}
            >
              Transactions
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4">
          {activeTab === 'games' ? (
            <div className="space-y-3">
              {games.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-3">🎮</div>
                  <p className="text-white/70">No games played yet</p>
                </div>
              ) : (
                games.map((gamePlayer) => {
                  const game = gamePlayer.games;
                  if (!game) return null;
                  
                  const isWinner = game.winner_id === user?.id;
                  const isCompleted = game.status === 'completed';
                  const prize = isWinner ? (game.prize_pool * 0.9) : 0;

                  return (
                    <div
                      key={gamePlayer.id}
                      className={`backdrop-blur-sm rounded-2xl p-4 border ${
                        isCompleted
                          ? isWinner
                            ? 'bg-green-500/10 border-green-400/30'
                            : 'bg-red-500/10 border-red-400/30'
                          : game.status === 'active'
                          ? 'bg-blue-500/10 border-blue-400/30'
                          : 'bg-yellow-500/10 border-yellow-400/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-white font-bold text-lg">
                            {game.entry_fee} Birr Game
                          </div>
                          <div className="text-white/60 text-xs">
                            {new Date(game.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div>
                          {isCompleted ? (
                            isWinner ? (
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                🏆 WON
                              </span>
                            ) : (
                              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                ❌ LOST
                              </span>
                            )
                          ) : game.status === 'active' ? (
                            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                              🎮 ACTIVE
                            </span>
                          ) : (
                            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                              ⏳ WAITING
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white/10 rounded-lg p-2">
                          <div className="text-white/60 text-xs">Entry</div>
                          <div className="text-white font-bold">{game.entry_fee} ብር</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-2">
                          <div className="text-white/60 text-xs">Pool</div>
                          <div className="text-white font-bold">{game.prize_pool || 0} ብር</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-2">
                          <div className="text-white/60 text-xs">Result</div>
                          <div className={`font-bold ${isWinner ? 'text-green-300' : 'text-red-300'}`}>
                            {isCompleted ? (isWinner ? `+${prize.toFixed(0)}` : `-${game.entry_fee}`) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-3">💰</div>
                  <p className="text-white/70">No transactions yet</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-white/10 backdrop-blur-sm rounded-2xl p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-medium">
                          {tx.type === 'game_win' ? '🏆 Game Win' :
                           tx.type === 'game_entry' ? '🎮 Game Entry' :
                           tx.type === 'deposit' ? '💰 Deposit' :
                           tx.type === 'withdrawal' ? '💸 Withdrawal' :
                           tx.type}
                        </div>
                        <div className="text-white/60 text-xs mt-1">
                          {new Date(tx.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${
                        tx.amount >= 0 ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount} ብር
                      </div>
                    </div>
                    {tx.description && (
                      <div className="text-white/50 text-xs mt-2">
                        {tx.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
