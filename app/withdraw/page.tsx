"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'

export default function WithdrawPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  const userBalance = user?.balance || 0

  const handleWithdraw = async () => {
    if (!amount || !bankName || !accountNumber || !accountHolder) {
      setError('Please fill in all fields')
      return
    }
    
    const withdrawAmount = parseFloat(amount)
    if (withdrawAmount > userBalance) {
      setError('Insufficient balance')
      return
    }

    if (withdrawAmount < 100) {
      setError('Minimum withdrawal is 100 ETB')
      return
    }
    
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: withdrawAmount,
          bankName,
          accountNumber,
          accountHolder
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Withdrawal failed')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/account" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Account
        </Link>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800">
            💸 Withdraw Funds
          </h1>

          {success ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-8xl mb-6">✅</div>
              <h2 className="text-3xl font-bold mb-4 text-gray-800">Withdrawal Request Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Your withdrawal request for {formatCurrency(parseFloat(amount))} has been submitted.
              </p>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Your request will be reviewed by our team within 24-48 hours. 
                  You will be notified once the funds are transferred to your account.
                </p>
              </div>
              <Link href="/account">
                <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  Back to Account
                </button>
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {/* Available Balance */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 mb-8">
                <p className="text-sm text-gray-600 mb-1">Available Balance</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(userBalance)}</p>
              </div>

              {/* Withdrawal Amount */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Withdrawal Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                    min="100"
                    max={userBalance}
                    step="10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                    ETB
                  </span>
                </div>
                {parseFloat(amount) > userBalance && (
                  <p className="text-red-500 text-sm mt-2">Insufficient balance</p>
                )}
                <p className="text-gray-500 text-sm mt-2">
                  Min: 100 ETB • Max: {formatCurrency(userBalance)}
                </p>
              </div>

              {/* Bank Details */}
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Bank Name
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select your bank</option>
                    <option value="Commercial Bank of Ethiopia">Commercial Bank of Ethiopia</option>
                    <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                    <option value="Awash Bank">Awash Bank</option>
                    <option value="Dashen Bank">Dashen Bank</option>
                    <option value="United Bank">United Bank</option>
                    <option value="Wegagen Bank">Wegagen Bank</option>
                    <option value="Nib Bank">Nib Bank</option>
                    <option value="Cooperative Bank of Oromia">Cooperative Bank of Oromia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter your account number"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Enter account holder name"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-700 font-medium">❌ {error}</p>
                </div>
              )}

              {/* Important Notice */}
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 mb-8">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Important Notice</span>
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>• Withdrawals are processed within 24-48 hours</li>
                  <li>• Ensure your bank details are correct</li>
                  <li>• Minimum withdrawal amount is 100 ETB</li>
                  <li>• You will be notified once the transfer is complete</li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={
                  !amount || 
                  !bankName || 
                  !accountNumber || 
                  !accountHolder || 
                  parseFloat(amount) > userBalance ||
                  parseFloat(amount) < 100 ||
                  loading
                }
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Withdrawal Request</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
