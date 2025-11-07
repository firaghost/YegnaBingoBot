import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import SuperAdminLayout from '../../components/SuperAdminLayout';
import { supabase } from '../../lib/supabaseClient';

export default function SystemLogs() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, payments, games, admin

  useEffect(() => {
    const isSuperAuth = localStorage.getItem('superAdminAuth');
    if (!isSuperAuth) {
      router.push('/super-login');
      return;
    }
    loadLogs();
  }, [filter]);

  async function loadLogs() {
    try {
      setLoading(true);
      const activities = [];

      // Load payment activities
      if (filter === 'all' || filter === 'payments') {
        const { data: payments } = await supabase
          .from('payments')
          .select('*, users(username)')
          .order('created_at', { ascending: false })
          .limit(50);

        payments?.forEach(p => {
          activities.push({
            id: p.id,
            type: 'payment',
            action: `${p.type} ${p.status}`,
            user: p.users?.username || 'Unknown',
            amount: p.amount,
            timestamp: p.created_at,
            details: `${p.type} of ${p.amount} Birr - ${p.status}`
          });
        });
      }

      // Load game activities
      if (filter === 'all' || filter === 'games') {
        const { data: games } = await supabase
          .from('games')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        games?.forEach(g => {
          activities.push({
            id: g.id,
            type: 'game',
            action: `Game ${g.status}`,
            user: 'System',
            amount: g.prize_pool,
            timestamp: g.created_at,
            details: `${g.entry_fee} Birr game - ${g.status}`
          });
        });
      }

      // Load admin activities (if table exists)
      if (filter === 'all' || filter === 'admin') {
        const { data: adminLogs } = await supabase
          .from('super_admin_activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        adminLogs?.forEach(log => {
          activities.push({
            id: log.id,
            type: 'admin',
            action: log.action,
            user: 'Admin',
            timestamp: log.created_at,
            details: JSON.stringify(log.details || {})
          });
        });
      }

      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(activities);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'payment': return '💳';
      case 'game': return '🎮';
      case 'admin': return '👤';
      default: return '📋';
    }
  };

  const getActivityColor = (action) => {
    if (action.includes('approved') || action.includes('completed')) return 'text-green-600 bg-green-50';
    if (action.includes('pending') || action.includes('waiting')) return 'text-yellow-600 bg-yellow-50';
    if (action.includes('rejected') || action.includes('failed')) return 'text-red-600 bg-red-50';
    return 'text-blue-600 bg-blue-50';
  };

  return (
    <SuperAdminLayout>
      <Head>
        <title>System Logs - Super Admin</title>
      </Head>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">System Logs</h1>
            <p className="text-base text-gray-600 mt-2">Monitor all system activities</p>
          </div>
          
          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'payments', 'games', 'admin'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📋</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Total Activities</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{logs.length}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">💳</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Payment Activities</div>
            <div className="text-3xl font-bold text-blue-600 mt-1">
              {logs.filter(l => l.type === 'payment').length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🎮</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Game Activities</div>
            <div className="text-3xl font-bold text-green-600 mt-1">
              {logs.filter(l => l.type === 'game').length}
            </div>
          </div>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Logs Found</h3>
            <p className="text-gray-600">No activities recorded yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-2xl">{getActivityIcon(log.type)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActivityColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.user}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                        {log.details}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
