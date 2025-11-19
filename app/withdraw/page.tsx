"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { LuArrowLeft, LuBanknote, LuCheck, LuX, LuInfo, LuChevronDown } from 'react-icons/lu'
import { getDeviceHash } from '@/lib/fingerprint'

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
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  // OTP state
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpTokenId, setOtpTokenId] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpHint, setOtpHint] = useState('')
  
  const quickAmounts = [50, 100, 500, 1000]
  
  const banks = [
    'Commercial Bank of Ethiopia',
    'Bank of Abyssinia',
    'Awash Bank',
    'Dashen Bank',
    'United Bank',
    'Wegagen Bank',
    'Nib Bank',
    'Cooperative Bank of Oromia'
  ]

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Register device fingerprint (best-effort)
  useEffect(() => {
    const register = async () => {
      try {
        if (!user?.id) return
        const hash = await getDeviceHash()
        await fetch('/api/security/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, deviceHash: hash })
        })
      } catch (e) {
        // soft fail
      }
    }
    register()
  }, [user?.id])

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

    if (withdrawAmount < 50) {
      setError('Minimum withdrawal is 50 ETB')
      return
    }
    
    setLoading(true)
    setError('')
    setOtpError('')

    try {
      const payload: any = {
        userId: user?.id,
        amount: withdrawAmount,
        bankName,
        accountNumber,
        accountHolder
      }
      if (otpTokenId && otpCode) {
        payload.otpTokenId = otpTokenId
        payload.otpCode = otpCode
      }

      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403 && data?.error === 'BONUS_ONLY_BLOCKED') {
          setOtpRequired(false)
          setOtpTokenId(null)
          setOtpCode('')
          setError(data?.message || 'Bonus winnings require a real deposit before withdrawal. Your balance has been moved to your Bonus Wallet.')
          setLoading(false)
          return
        }
        if (response.status === 401 && data?.error === 'OTP_REQUIRED') {
          setOtpRequired(true)
          // Request OTP now
          await requestOtp()
          setLoading(false)
          return
        }
        if (response.status === 401 && data?.error === 'OTP_INVALID') {
          setOtpError('Invalid OTP code. Please try again.')
          setLoading(false)
          return
        }
        throw new Error(data.error || 'Withdrawal failed')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal')
    } finally {
      setLoading(false)
    }
  }

  const requestOtp = async () => {
    if (!user?.id) return
    try {
      setOtpSending(true)
      setOtpError('')
      setOtpHint('')
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, purpose: 'withdraw' })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP')
      }
      setOtpTokenId(data.tokenId)
      setOtpHint('We sent a 6-digit code to your Telegram DM. Enter it below.')
    } catch (e: any) {
      setOtpError(e.message || 'Failed to send OTP')
    } finally {
      setOtpSending(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/account" className="text-slate-600 hover:text-slate-900">
            <LuArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-2">
            <LuBanknote className="w-6 h-6 text-slate-700" />
            <h1 className="text-xl font-bold text-slate-900">Withdraw</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {success ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LuCheck className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-slate-900">Request Submitted!</h2>
            <p className="text-slate-600 mb-4 text-sm">
              Your withdrawal request for {formatCurrency(parseFloat(amount))} has been submitted.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-xs text-slate-700">
                Processing time: 24-48 hours. You'll be notified once complete.
              </p>
            </div>
            <Link href="/account">
              <button className="bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Back to Account
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <LuX className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Available Balance */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(userBalance)}</p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <label className="block text-sm font-medium text-slate-900 mb-3">
                Quick Select Amount
              </label>
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    disabled={amt > userBalance}
                    className={`py-2.5 px-4 rounded-lg font-medium transition-all text-sm ${
                      amount === amt.toString()
                        ? 'bg-slate-700 text-white'
                        : amt > userBalance
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawal Amount */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <label className="block text-sm font-medium text-slate-900 mb-3">
                Or Enter Custom Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-100"
                  min="50"
                  max={userBalance}
                  step="10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                  ETB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Min: 50 ETB • Max: {formatCurrency(userBalance)}
              </p>
            </div>

            {/* Bank Details */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-4">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Bank Details</h3>
              
              <div className="relative">
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Bank Name
                </label>
                <button
                  type="button"
                  onClick={() => setShowBankDropdown(!showBankDropdown)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-100 flex items-center justify-between text-left"
                >
                  <span className={bankName ? 'text-slate-900' : 'text-slate-400'}>
                    {bankName || 'Select your bank'}
                  </span>
                  <LuChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showBankDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showBankDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {banks.map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => {
                          setBankName(bank)
                          setShowBankDropdown(false)
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                          bankName === bank ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-900'
                        }`}
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Enter account holder name"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <LuInfo className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-2">Important</h3>
                  <ul className="space-y-1 text-xs text-slate-700">
                    <li>• Processing time: 24-48 hours</li>
                    <li>• Minimum withdrawal: 50 ETB</li>
                    <li>• Verify bank details carefully</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* OTP Gate */}
            {otpRequired && (
              <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3">
                <div className="text-sm font-medium text-slate-900">OTP Verification</div>
                {otpHint && <div className="text-xs text-slate-600">{otpHint}</div>}
                {otpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{otpError}</div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={otpSending}
                    className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  >
                    {otpSending ? 'Sending...' : 'Resend'}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleWithdraw}
              disabled={
                !amount || 
                !bankName || 
                !accountNumber || 
                !accountHolder || 
                parseFloat(amount) > userBalance ||
                parseFloat(amount) < 50 ||
                loading ||
                (otpRequired && (!otpTokenId || otpCode.length !== 6))
              }
              className="w-full bg-slate-700 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <span>Submit Withdrawal Request</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
