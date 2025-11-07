import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import { supabase } from '../../lib/supabaseClient';

export default function CommissionReports() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month
  const [commissionData, setCommissionData] = useState({
    totalRevenue: 0,
    totalCommission: 0,
    totalPrizesPaid: 0,
    gameCount: 0,
    commissionRate: 10, // 10%
    games: []
  });

  useEffect(() => {
    const isSuperAuth = localStorage.getItem('superAdminAuth');
    if (!isSuperAuth) {
      router.push('/super-login');
      return;
    }
    loadCommissionData();
  }, [dateRange]);

  async function loadCommissionData() {
    try {
      setLoading(true);
      
      // Get completed games with their details
      let query = supabase
        .from('games')
        .select('*, game_players(count)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      // Apply date filter
      if (dateRange !== 'all') {
        const now = new Date();
        let startDate;
        
        if (dateRange === 'today') {
          startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (dateRange === 'week') {
          startDate = new Date(now.setDate(now.getDate() - 7));
        } else if (dateRange === 'month') {
          startDate = new Date(now.setMonth(now.getMonth() - 1));
        }
        
        query = query.gte('completed_at', startDate.toISOString());
      }

      const { data: games, error } = await query;

      if (error) throw error;

      // Calculate commission data
      const totalRevenue = games?.reduce((sum, g) => sum + (g.prize_pool || 0), 0) || 0;
      const totalCommission = totalRevenue * 0.10; // 10% commission
      const totalPrizesPaid = totalRevenue * 0.90; // 90% to winners

      setCommissionData({
        totalRevenue,
        totalCommission,
        totalPrizesPaid,
        gameCount: games?.length || 0,
        commissionRate: 10,
        games: games || []
      });
    } catch (error) {
      console.error('Error loading commission data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SuperAdminLayout>
      <Head>
        <title>Commission Reports - Super Admin</title>
      </Head>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Commission Reports</h1>
            <p className="text-base text-gray-600 mt-2">Track your earnings and commissions</p>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex gap-2">
            {['all', 'today', 'week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  dateRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Commission Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium opacity-90 mb-1">Total Commission</h3>
                <p className="text-3xl font-bold mb-1">{commissionData.totalCommission.toFixed(2)} Birr</p>
                <p className="text-xs opacity-75">{commissionData.commissionRate}% of revenue</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium opacity-90 mb-1">Total Revenue</h3>
                <p className="text-3xl font-bold mb-1">{commissionData.totalRevenue.toFixed(2)} Birr</p>
                <p className="text-xs opacity-75">From {commissionData.gameCount} games</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <span className="text-2xl">🏆</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium opacity-90 mb-1">Prizes Paid</h3>
                <p className="text-3xl font-bold mb-1">{commissionData.totalPrizesPaid.toFixed(2)} Birr</p>
                <p className="text-xs opacity-75">90% to winners</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                    <span className="text-2xl">🎮</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium opacity-90 mb-1">Completed Games</h3>
                <p className="text-3xl font-bold mb-1">{commissionData.gameCount}</p>
                <p className="text-xs opacity-75">In selected period</p>
              </div>
            </div>

            {/* Commission Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Breakdown</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Commission Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{commissionData.commissionRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Per Game</p>
                    <p className="text-lg font-semibold text-green-600">
                      {commissionData.gameCount > 0 
                        ? (commissionData.totalCommission / commissionData.gameCount).toFixed(2)
                        : '0.00'} Birr
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600 mb-1">Your Share</p>
                    <p className="text-xl font-bold text-green-600">
                      {commissionData.totalCommission.toFixed(2)} Birr
                    </p>
                    <p className="text-xs text-gray-500 mt-1">10% commission</p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">Players' Share</p>
                    <p className="text-xl font-bold text-blue-600">
                      {commissionData.totalPrizesPaid.toFixed(2)} Birr
                    </p>
                    <p className="text-xs text-gray-500 mt-1">90% to winners</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Games */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Completed Games</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Game ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entry Fee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Players
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prize Pool
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commission
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {commissionData.games.slice(0, 20).map((game) => {
                      const commission = (game.prize_pool || 0) * 0.10;
                      return (
                        <tr key={game.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {game.id.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {game.entry_fee} Birr
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {game.game_players?.[0]?.count || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {game.prize_pool} Birr
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                            {commission.toFixed(2)} Birr
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {game.completed_at 
                              ? new Date(game.completed_at).toLocaleDateString()
                              : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
