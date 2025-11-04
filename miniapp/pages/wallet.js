import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserId, hapticFeedback, setBackButton, showAlert } from '../lib/telegram';
import { getUserByTelegramId, supabase } from '../lib/supabase';

export default function WalletPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null); // null, 'withdraw', 'deposit', 'history'
  const [loading, setLoading] = useState(true);
  
  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState(''); // 'cbe' or 'telebirr'
  const [withdrawAccount, setWithdrawAccount] = useState('');
  
  // Deposit state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState(''); // 'cbe' or 'telebirr'
  const [depositProof, setDepositProof] = useState('');
  
  // History state
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadUserData();
    setBackButton(() => router.push('/'));
  }, []);

  async function loadUserData() {
    const telegramUserId = getUserId();
    const userData = await getUserByTelegramId(telegramUserId);
    setUser(userData);
    setLoading(false);
  }

  async function loadTransactionHistory() {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('transaction_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setTransactions(data);
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmount || parseFloat(withdrawAmount) < 50) {
      showAlert('Minimum withdrawal is 50 Birr');
      return;
    }

    if (!withdrawMethod) {
      showAlert('Please select withdrawal method');
      return;
    }

    if (!withdrawAccount) {
      showAlert('Please enter your account number');
      return;
    }

    if (parseFloat(withdrawAmount) > user.balance) {
      showAlert('Insufficient balance');
      return;
    }

    hapticFeedback('medium');
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount: parseFloat(withdrawAmount),
          payment_method: withdrawMethod,
          account_number: withdrawAccount,
          type: 'withdrawal',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      showAlert('Withdrawal request submitted! Waiting for approval.');
      setActiveMenu(null);
      setWithdrawAmount('');
      setWithdrawMethod('');
      setWithdrawAccount('');
    } catch (error) {
      console.error('Withdrawal error:', error);
      showAlert('Failed to submit withdrawal request');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeposit() {
    if (!depositAmount || parseFloat(depositAmount) < 50) {
      showAlert('Minimum deposit is 50 Birr');
      return;
    }

    if (!depositMethod) {
      showAlert('Please select deposit method');
      return;
    }

    if (!depositProof) {
      showAlert('Please enter transaction proof');
      return;
    }

    hapticFeedback('medium');
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount: parseFloat(depositAmount),
          payment_method: depositMethod,
          transaction_proof: depositProof,
          type: 'deposit',
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      showAlert('Deposit request submitted! Waiting for approval.');
      setActiveMenu(null);
      setDepositAmount('');
      setDepositMethod('');
      setDepositProof('');
    } catch (error) {
      console.error('Deposit error:', error);
      showAlert('Failed to submit deposit request');
    } finally {
      setLoading(false);
    }
  }

  const getAccountInfo = (method) => {
    if (method === 'cbe') {
      return {
        name: 'Commercial Bank of Ethiopia',
        account: '1000123456789',
        holder: 'Yegna Bingo'
      };
    } else if (method === 'telebirr') {
      return {
        name: 'Telebirr',
        account: '0912345678',
        holder: 'Yegna Bingo'
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary to-primary flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Main menu (no active submenu)
  if (!activeMenu) {
    return (
      <>
        <Head>
          <title>Wallet - Yegna Bingo</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-secondary to-primary">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-primary/90 backdrop-blur-sm px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white">ተመላሽ</h1>
              <div className="bg-yellow-500 px-4 py-2 rounded-lg">
                <span className="font-bold text-white">{user?.balance?.toFixed(2) || '0.00'} ETB</span>
              </div>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="px-4 py-8">
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Deposit */}
              <button
                onClick={() => {
                  hapticFeedback('light');
                  setActiveMenu('deposit');
                }}
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
                  <span className="text-4xl">💳</span>
                </div>
                <div className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold">
                  ገቢ
                </div>
              </button>

              {/* Withdrawal */}
              <button
                onClick={() => {
                  hapticFeedback('light');
                  setActiveMenu('withdraw');
                }}
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
                  <span className="text-4xl">📱</span>
                </div>
                <div className="bg-red-500 text-white px-6 py-2 rounded-lg font-bold">
                  ወጪ
                </div>
              </button>
            </div>

            {/* History */}
            <button
              onClick={() => {
                hapticFeedback('light');
                setActiveMenu('history');
                loadTransactionHistory();
              }}
              className="w-full flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
                <span className="text-4xl">📊</span>
              </div>
              <div className="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold">
                ታሪክ
              </div>
            </button>
          </div>
        </div>
      </>
    );
  }

  // Withdrawal Screen
  if (activeMenu === 'withdraw') {
    return (
      <>
        <Head>
          <title>Withdrawal - Yegna Bingo</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-secondary to-primary">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-primary/90 backdrop-blur-sm px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <button onClick={() => setActiveMenu(null)} className="text-white text-2xl">←</button>
              <h1 className="text-xl font-bold text-white">Withdrawal (ወጪ)</h1>
              <div className="w-8"></div>
            </div>
          </div>

          <div className="px-4 py-6 space-y-6">
            {/* Instructions */}
            <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-lg p-4">
              <h3 className="text-white font-bold mb-2">📋 Instructions:</h3>
              <ul className="text-white/90 text-sm space-y-1">
                <li>• Minimum withdrawal: 50 Birr</li>
                <li>• Processing time: 1-24 hours</li>
                <li>• Enter correct account details</li>
              </ul>
            </div>

            {/* Available Balance */}
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-white/70 text-sm">Available Balance</div>
              <div className="text-white text-3xl font-bold">{user?.balance?.toFixed(2)} ETB</div>
            </div>

            {/* Withdrawal Method */}
            <div>
              <label className="text-white font-semibold mb-2 block">Select Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setWithdrawMethod('cbe')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    withdrawMethod === 'cbe'
                      ? 'bg-blue-500 border-blue-300'
                      : 'bg-white/10 border-white/30'
                  }`}
                >
                  <div className="text-white font-bold">CBE</div>
                  <div className="text-white/70 text-xs">Bank Transfer</div>
                </button>
                <button
                  onClick={() => setWithdrawMethod('telebirr')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    withdrawMethod === 'telebirr'
                      ? 'bg-orange-500 border-orange-300'
                      : 'bg-white/10 border-white/30'
                  }`}
                >
                  <div className="text-white font-bold">Telebirr</div>
                  <div className="text-white/70 text-xs">Mobile Money</div>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-white font-semibold mb-2 block">Amount (Birr)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Minimum 50 Birr"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border-2 border-white/30 text-white placeholder-white/50"
                min="50"
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="text-white font-semibold mb-2 block">
                {withdrawMethod === 'cbe' ? 'Bank Account Number' : 'Phone Number'}
              </label>
              <input
                type="text"
                value={withdrawAccount}
                onChange={(e) => setWithdrawAccount(e.target.value)}
                placeholder={withdrawMethod === 'cbe' ? 'Enter account number' : 'Enter phone number'}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border-2 border-white/30 text-white placeholder-white/50"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleWithdraw}
              disabled={loading || !withdrawAmount || !withdrawMethod || !withdrawAccount}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Submit Withdrawal Request'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Deposit Screen
  if (activeMenu === 'deposit') {
    const accountInfo = getAccountInfo(depositMethod);

    return (
      <>
        <Head>
          <title>Deposit - Yegna Bingo</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-secondary to-primary">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-primary/90 backdrop-blur-sm px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <button onClick={() => setActiveMenu(null)} className="text-white text-2xl">←</button>
              <h1 className="text-xl font-bold text-white">Deposit (ገቢ)</h1>
              <div className="w-8"></div>
            </div>
          </div>

          <div className="px-4 py-6 space-y-6">
            {/* Instructions */}
            <div className="bg-blue-500/20 border-2 border-blue-500 rounded-lg p-4">
              <h3 className="text-white font-bold mb-2">📋 Instructions:</h3>
              <ul className="text-white/90 text-sm space-y-1">
                <li>• Minimum deposit: 50 Birr</li>
                <li>• Transfer to our account below</li>
                <li>• Submit transaction proof</li>
                <li>• Wait for admin approval</li>
              </ul>
            </div>

            {/* Deposit Method */}
            <div>
              <label className="text-white font-semibold mb-2 block">Select Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDepositMethod('cbe')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    depositMethod === 'cbe'
                      ? 'bg-blue-500 border-blue-300'
                      : 'bg-white/10 border-white/30'
                  }`}
                >
                  <div className="text-white font-bold">CBE</div>
                  <div className="text-white/70 text-xs">Bank Transfer</div>
                </button>
                <button
                  onClick={() => setDepositMethod('telebirr')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    depositMethod === 'telebirr'
                      ? 'bg-orange-500 border-orange-300'
                      : 'bg-white/10 border-white/30'
                  }`}
                >
                  <div className="text-white font-bold">Telebirr</div>
                  <div className="text-white/70 text-xs">Mobile Money</div>
                </button>
              </div>
            </div>

            {/* Account Info */}
            {accountInfo && (
              <div className="bg-white/10 rounded-lg p-4 border-2 border-white/30">
                <h3 className="text-white font-bold mb-3">Transfer to:</h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-white/70 text-sm">{accountInfo.name}</div>
                    <div className="text-white text-xl font-bold">{accountInfo.account}</div>
                  </div>
                  <div>
                    <div className="text-white/70 text-sm">Account Holder</div>
                    <div className="text-white font-semibold">{accountInfo.holder}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(accountInfo.account);
                    showAlert('Account number copied!');
                    hapticFeedback('light');
                  }}
                  className="mt-3 w-full bg-white/20 text-white py-2 rounded-lg text-sm"
                >
                  📋 Copy Account Number
                </button>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="text-white font-semibold mb-2 block">Amount (Birr)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Minimum 50 Birr"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border-2 border-white/30 text-white placeholder-white/50"
                min="50"
              />
            </div>

            {/* Transaction Proof */}
            <div>
              <label className="text-white font-semibold mb-2 block">Transaction Proof</label>
              <textarea
                value={depositProof}
                onChange={(e) => setDepositProof(e.target.value)}
                placeholder="Enter FTX/Transaction number OR paste the SMS message from bank"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border-2 border-white/30 text-white placeholder-white/50 h-32"
              />
              <div className="text-white/70 text-xs mt-1">
                Example: "FTX123456789" or paste full SMS text
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleDeposit}
              disabled={loading || !depositAmount || !depositMethod || !depositProof}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Submit Deposit Request'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // History Screen
  if (activeMenu === 'history') {
    return (
      <>
        <Head>
          <title>Transaction History - Yegna Bingo</title>
        </Head>

        <div className="min-h-screen bg-gradient-to-b from-secondary to-primary">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-primary/90 backdrop-blur-sm px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <button onClick={() => setActiveMenu(null)} className="text-white text-2xl">←</button>
              <h1 className="text-xl font-bold text-white">History (ታሪክ)</h1>
              <div className="w-8"></div>
            </div>
          </div>

          <div className="px-4 py-6">
            {transactions.length === 0 ? (
              <div className="text-center text-white/70 py-12">
                <div className="text-6xl mb-4">📋</div>
                <div>No transactions yet</div>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-semibold capitalize">
                        {tx.transaction_type}
                      </div>
                      <div className={`text-lg font-bold ${
                        tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount} ETB
                      </div>
                    </div>
                    <div className="text-white/70 text-sm">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                    {tx.description && (
                      <div className="text-white/60 text-xs mt-1">{tx.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return null;
}
