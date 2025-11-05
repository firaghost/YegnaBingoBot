import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import SuperAdminLayout from '../components/SuperAdminLayout';
import { supabase } from '../lib/supabaseClient';

export default function SuperAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGames: 0,
    activeGames: 0,
    completedGames: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    approvedDeposits: 0,
    approvedWithdrawals: 0,
    rejectedDeposits: 0,
    rejectedWithdrawals: 0,
    totalUsers: 0,
    totalRevenue: 0,
    totalPrizesPaid: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [topPlayers, setTopPlayers] = useState([]);
  const [adminActions, setAdminActions] = useState([]);

  useEffect(() => {
    // Check SUPER ADMIN authentication (separate from regular admin)
    const isSuperAuth = localStorage.getItem('superAdminAuth');
    if (!isSuperAuth) {
      router.push('/super-login');
      return;
    }
    
    // Update last activity
    localStorage.setItem('superLastActivity', Date.now().toString());
    
    loadAllData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadAllData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadRecentActivity(),
        loadTopPlayers(),
        loadAdminActions()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      // Games stats
      const { data: games } = await supabase
        .from('games')
        .select('status, prize_pool, entry_fee');

      const totalGames = games?.length || 0;
      const activeGames = games?.filter(g => g.status === 'active').length || 0;
      const completedGames = games?.filter(g => g.status === 'completed').length || 0;

      // Calculate total revenue (10% commission from completed games)
      const totalRevenue = games
        ?.filter(g => g.status === 'completed')
        .reduce((sum, g) => sum + (g.prize_pool * 0.10), 0) || 0;

      // Calculate total prizes paid (90% of completed games)
      const totalPrizesPaid = games
        ?.filter(g => g.status === 'completed')
        .reduce((sum, g) => sum + (g.prize_pool * 0.90), 0) || 0;

      // Payments stats
      const { data: payments } = await supabase
        .from('payments')
        .select('type, status, amount');

      const deposits = payments?.filter(p => p.type === 'deposit') || [];
      const withdrawals = payments?.filter(p => p.type === 'withdrawal') || [];

      const totalDeposits = deposits.reduce((sum, p) => sum + p.amount, 0);
      const totalWithdrawals = withdrawals.reduce((sum, p) => sum + p.amount, 0);
      
      const pendingDeposits = deposits.filter(p => p.status === 'pending').length;
      const pendingWithdrawals = withdrawals.filter(p => p.status === 'pending').length;
      
      const approvedDeposits = deposits.filter(p => p.status === 'approved').length;
      const approvedWithdrawals = withdrawals.filter(p => p.status === 'approved').length;
      
      const rejectedDeposits = deposits.filter(p => p.status === 'rejected').length;
      const rejectedWithdrawals = withdrawals.filter(p => p.status === 'rejected').length;

      // Users stats
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalGames,
        activeGames,
        completedGames,
        totalDeposits,
        totalWithdrawals,
        pendingDeposits,
        pendingWithdrawals,
        approvedDeposits,
        approvedWithdrawals,
        rejectedDeposits,
        rejectedWithdrawals,
        totalUsers: totalUsers || 0,
        totalRevenue,
        totalPrizesPaid
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function loadRecentActivity() {
    try {
      const { data: transactions } = await supabase
        .from('transaction_history')
        .select(`
          *,
          users (username, telegram_id)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      setRecentActivity(transactions || []);
    } catch (error) {
      console.error('Error loading activity:', error);
    }
  }

  async function loadTopPlayers() {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('username, balance, telegram_id')
        .order('balance', { ascending: false })
        .limit(10);

      setTopPlayers(users || []);
    } catch (error) {
      console.error('Error loading top players:', error);
    }
  }

  async function loadAdminActions() {
    try {
      const { data: payments } = await supabase
        .from('payments')
        .select(`
          *,
          users (username, telegram_id)
        `)
        .not('processed_at', 'is', null)
        .order('processed_at', { ascending: false })
        .limit(20);

      setAdminActions(payments || []);
    } catch (error) {
      console.error('Error loading admin actions:', error);
    }
  }

  if (loading && recentActivity.length === 0) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <Head>
        <title>Super Admin Dashboard - Yegna Bingo</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time system monitoring and analytics</p>
          </div>
          <button
            onClick={loadAllData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Total Revenue</h3>
              <span className="text-2xl">💰</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalRevenue.toFixed(2)} Birr</div>
            <div className="text-xs opacity-75 mt-1">10% commission from games</div>
          </div>

          {/* Total Deposits */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Total Deposits</h3>
              <span className="text-2xl">📥</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalDeposits.toFixed(2)} Birr</div>
            <div className="text-xs opacity-75 mt-1">
              {stats.approvedDeposits} approved • {stats.pendingDeposits} pending
            </div>
          </div>

          {/* Total Withdrawals */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Total Withdrawals</h3>
              <span className="text-2xl">📤</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalWithdrawals.toFixed(2)} Birr</div>
            <div className="text-xs opacity-75 mt-1">
              {stats.approvedWithdrawals} approved • {stats.pendingWithdrawals} pending
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Total Users</h3>
              <span className="text-2xl">👥</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            <div className="text-xs opacity-75 mt-1">Registered players</div>
          </div>
        </div>

        {/* Games Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm mb-1">Total Games</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalGames}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm mb-1">Active Games</div>
            <div className="text-3xl font-bold text-green-600">{stats.activeGames}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm mb-1">Completed Games</div>
            <div className="text-3xl font-bold text-blue-600">{stats.completedGames}</div>
          </div>
        </div>

        {/* Payment Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.approvedDeposits}</div>
              <div className="text-sm text-gray-600">Approved Deposits</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingDeposits}</div>
              <div className="text-sm text-gray-600">Pending Deposits</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.rejectedDeposits}</div>
              <div className="text-sm text-gray-600">Rejected Deposits</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.approvedWithdrawals}</div>
              <div className="text-sm text-gray-600">Approved Withdrawals</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingWithdrawals}</div>
              <div className="text-sm text-gray-600">Pending Withdrawals</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.rejectedWithdrawals}</div>
              <div className="text-sm text-gray-600">Rejected Withdrawals</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No recent activity</div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl">
                        {activity.type === 'deposit' ? '📥' : 
                         activity.type === 'withdrawal' ? '📤' : 
                         activity.type === 'game_win' ? '🏆' : 
                         activity.type === 'game_entry' ? '🎮' : '💰'}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {activity.users?.username || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-600">{activity.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(activity.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className={`font-bold ${activity.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {activity.amount >= 0 ? '+' : ''}{activity.amount} Birr
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Players */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Top Players by Balance</h2>
            </div>
            <div className="p-6">
              {topPlayers.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No players yet</div>
              ) : (
                <div className="space-y-3">
                  {topPlayers.map((player, index) => (
                    <div key={player.telegram_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{player.username}</div>
                        <div className="text-xs text-gray-500">@{player.telegram_id}</div>
                      </div>
                      <div className="font-bold text-green-600">{player.balance.toFixed(2)} Birr</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin Actions Log */}
        <div className="bg-white rounded-lg shadow mt-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Admin Actions Log</h2>
          </div>
          <div className="p-6">
            {adminActions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No admin actions yet</div>
            ) : (
              <div className="space-y-3">
                {adminActions.map((action) => (
                  <div key={action.id} className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="text-2xl">
                      {action.status === 'approved' ? '✅' : '❌'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          action.type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {action.type}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          action.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {action.status}
                        </span>
                      </div>
                      <div className="font-semibold text-gray-900 mt-1">
                        {action.users?.username || 'Unknown'} - {action.amount} Birr
                      </div>
                      <div className="text-sm text-gray-600">
                        Method: {action.payment_method} • Account: {action.account_number}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Processed: {new Date(action.processed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
