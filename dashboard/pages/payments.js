import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabaseClient';

export default function Payments() {
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all

  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth) {
      router.push('/login');
      return;
    }
    fetchPayments();
  }, [filter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payments')
        .select(`
          *,
          users (
            id,
            username,
            telegram_id,
            balance
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  async function handleApproveDeposit(payment) {
    if (!confirm(`Approve deposit of ${payment.amount} Birr for ${payment.users?.username}?`)) return;

    try {
      const adminId = localStorage.getItem('adminId');
      
      // Update payment status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: adminId
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // Update user balance
      const newBalance = (payment.users.balance || 0) + payment.amount;
      const { error: userError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', payment.user_id);

      if (userError) throw userError;

      // Log transaction
      await supabase.from('transaction_history').insert({
        user_id: payment.user_id,
        type: 'deposit',
        amount: payment.amount,
        balance_before: payment.users.balance || 0,
        balance_after: newBalance,
        description: `Deposit approved via ${payment.payment_method}`
      });

      alert('Deposit approved!');
      fetchPayments();
    } catch (error) {
      console.error('Error approving deposit:', error);
      alert('Failed to approve deposit');
    }
  }

  async function handleApproveWithdrawal(payment) {
    if (!confirm(`Approve withdrawal of ${payment.amount} Birr for ${payment.users?.username}?`)) return;

    try {
      const adminId = localStorage.getItem('adminId');
      
      // Check balance
      if (payment.users.balance < payment.amount) {
        alert('Insufficient balance!');
        return;
      }

      // Update payment status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: adminId
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // Update user balance
      const newBalance = payment.users.balance - payment.amount;
      const { error: userError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', payment.user_id);

      if (userError) throw userError;

      // Log transaction
      await supabase.from('transaction_history').insert({
        user_id: payment.user_id,
        type: 'withdrawal',
        amount: -payment.amount,
        balance_before: payment.users.balance,
        balance_after: newBalance,
        description: `Withdrawal approved to ${payment.payment_method}: ${payment.account_number}`
      });

      alert('Withdrawal approved! Please transfer money to user.');
      fetchPayments();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      alert('Failed to approve withdrawal');
    }
  }

  async function handleReject(payment) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    try {
      const adminId = localStorage.getItem('adminId');
      
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          admin_note: reason,
          processed_at: new Date().toISOString(),
          processed_by: adminId
        })
        .eq('id', payment.id);

      if (error) throw error;

      alert('Payment rejected');
      fetchPayments();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Failed to reject payment');
    }
  }


  return (
    <AdminLayout>
      <Head>
        <title>Payments - Yegna Bingo Admin</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
            <p className="text-gray-600 mt-1">Approve deposits and withdrawals</p>
          </div>
          <button
            onClick={fetchPayments}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex space-x-2">
          {['pending', 'approved', 'rejected', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold capitalize ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Payments List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl text-gray-600">Loading...</div>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-xl text-gray-600">No payments found</div>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        payment.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {payment.type === 'deposit' ? '📥 Deposit' : '📤 Withdrawal'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        payment.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-600">User</div>
                        <div className="font-semibold text-gray-900">{payment.users?.username || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Amount</div>
                        <div className="font-bold text-xl text-gray-900">{payment.amount} Birr</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Method</div>
                        <div className="font-semibold uppercase text-gray-900">{payment.payment_method}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Current Balance</div>
                        <div className="font-semibold text-gray-900">{payment.users?.balance || 0} Birr</div>
                      </div>
                    </div>

                    {payment.account_number && (
                      <div className="mb-2">
                        <div className="text-sm text-gray-600">Account Number</div>
                        <div className="font-mono text-gray-900">{payment.account_number}</div>
                      </div>
                    )}

                    {payment.transaction_proof && (
                      <div className="mb-2">
                        <div className="text-sm text-gray-600">Transaction Proof</div>
                        <div className="bg-gray-100 p-3 rounded text-sm font-mono text-gray-900">
                          {payment.transaction_proof}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      {new Date(payment.created_at).toLocaleString()}
                    </div>
                  </div>

                  {payment.status === 'pending' && (
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => payment.type === 'deposit' ? handleApproveDeposit(payment) : handleApproveWithdrawal(payment)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReject(payment)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
