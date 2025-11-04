import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import PaymentCard from '../components/PaymentCard';
import { supabase } from '../lib/supabaseClient';

export default function Payments() {
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

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

  const handleApprove = async (paymentId, amount) => {
    try {
      // Get payment details
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) return;

      // Update payment status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'approved',
          amount: amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (paymentError) throw paymentError;

      // Update user balance
      const newBalance = (payment.users.balance || 0) + amount;
      const { error: userError } = await supabase
        .from('users')
        .update({
          balance: newBalance,
          status: 'active'
        })
        .eq('id', payment.user_id);

      if (userError) throw userError;

      alert(`Payment approved! User balance updated to ${newBalance} Birr`);
      fetchPayments();
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Error approving payment');
    }
  };

  const handleReject = async (paymentId) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;

      alert('Payment rejected');
      fetchPayments();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      alert('Error rejecting payment');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  return (
    <>
      <Head>
        <title>Payments - Bingo Vault Admin</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Navbar onLogout={handleLogout} />
        
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Payment Management</h1>
            <button
              onClick={fetchPayments}
              className="btn btn-secondary"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="mb-6">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('pending')}
                className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`btn ${filter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Rejected
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              >
                All
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">Loading payments...</div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">No payments found</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {payments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
