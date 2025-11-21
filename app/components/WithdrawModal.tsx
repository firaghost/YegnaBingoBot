"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { getDeviceHash } from '@/lib/fingerprint'
import { LuX, LuBanknote, LuChevronDown, LuCheck, LuInfo, LuChevronLeft } from 'react-icons/lu'

interface WithdrawModalProps {
  open: boolean
  onClose: () => void
  onBack?: () => void
  isSheet?: boolean
}

const QUICK_AMOUNTS = [50, 100, 500, 1000]

const BANKS = [
  'Commercial Bank of Ethiopia',
  'Bank of Abyssinia',
  'Awash Bank',
  'Dashen Bank',
  'United Bank',
  'Wegagen Bank',
  'Nib Bank',
  'Cooperative Bank of Oromia'
]

export default function WithdrawModal({ open, onClose, onBack, isSheet = false }: WithdrawModalProps) {
  const { user, loading } = useAuth()

  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // OTP state (reuse backend behaviour)
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpTokenId, setOtpTokenId] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpHint, setOtpHint] = useState('')

  useEffect(() => {
    if (!open) return
    // Reset state when opening
    setAmount('')
    setBankName('')
    setAccountNumber('')
    setAccountHolder('')
    setSubmitting(false)
    setSuccess(false)
    setError('')
    setOtpRequired(false)
    setOtpSending(false)
    setOtpTokenId(null)
    setOtpCode('')
    setOtpError('')
    setOtpHint('')
  }, [open])

  // Register device fingerprint (best-effort) similar to withdraw page
  useEffect(() => {
    if (!open || !user?.id) return
    const register = async () => {
      try {
        const hash = await getDeviceHash()
        await fetch('/api/security/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, deviceHash: hash })
        })
      } catch {
        // soft fail
      }
    }
    register()
  }, [open, user?.id])

  if (!open || loading || !user) return null

  const userBalance = user.balance || 0

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

  const handleWithdraw = async () => {
    try {
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

      setSubmitting(true)
      setError('')
      setOtpError('')

      const payload: any = {
        userId: user.id,
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
          setSubmitting(false)
          return
        }
        if (response.status === 401 && data?.error === 'OTP_REQUIRED') {
          setOtpRequired(true)
          await requestOtp()
          setSubmitting(false)
          return
        }
        if (response.status === 401 && data?.error === 'OTP_INVALID') {
          setOtpError('Invalid OTP code. Please try again.')
          setSubmitting(false)
          return
        }
        throw new Error(data.error || 'Withdrawal failed')
      }

      setSuccess(true)
      setSubmitting(false)
      // auto-close after short success message
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2500)
    } catch (e: any) {
      setSubmitting(false)
      setError(e?.message || 'Failed to process withdrawal')
    }
  }

  return (
    <div 
      className={`fixed inset-0 ${(isSheet && onBack) ? 'z-[160] bg-black/60 backdrop-blur-sm' : 'z-[120] bg-transparent'} flex items-end justify-center`}
      role="dialog" aria-modal="true"
      onClick={isSheet ? undefined : onClose}
    >
      <div 
        className={`w-full max-w-md bg-slate-950 rounded-t-3xl border border-b-0 border-slate-800 shadow-2xl flex flex-col h-[calc(100vh-4rem)] animate-in slide-in-from-bottom-5 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          {isSheet && onBack ? (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
              aria-label="Back"
            >
              <LuChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-slate-50">Withdraw Money</p>
            <p className="text-xs text-slate-400">Withdraw money from wallet</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
            aria-label="Close"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {error && (
            <div className="bg-red-950/60 border border-red-700 rounded-lg p-2.5 text-xs text-red-100 flex gap-2">
              <LuInfo className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Available balance */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-sm text-slate-300 flex justify-between items-center">
            <span>Available</span>
            <span className="font-semibold text-emerald-300">{formatCurrency(userBalance)}</span>
          </div>

          {/* Bank selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Select Withdrawal Method</label>
            <div className="relative">
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 appearance-none"
              >
                <option value="" className="bg-slate-900">Choose bank...</option>
                {BANKS.map((b) => (
                  <option key={b} value={b} className="bg-slate-900">
                    {b}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                <LuChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Amount</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  disabled={amt > userBalance}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    amount === String(amt)
                      ? 'bg-amber-500 text-slate-900'
                      : amt > userBalance
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Custom amount"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Account details */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Enter bank account number"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Account Holder Name</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Enter full name"
            />
          </div>

          {/* OTP section when required */}
          {otpRequired && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-200">Verification Code</p>
                <button
                  type="button"
                  onClick={requestOtp}
                  disabled={otpSending}
                  className="text-[11px] text-amber-400 hover:text-amber-300 disabled:opacity-60"
                >
                  {otpSending ? 'Sending…' : 'Resend'}
                </button>
              </div>
              {otpHint && <p className="text-[11px] text-slate-400">{otpHint}</p>}
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 tracking-[0.3em]"
                placeholder="000000"
              />
              {otpError && <p className="text-[11px] text-red-300">{otpError}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>Processing…</span>
              </>
            ) : success ? (
              <>
                <LuCheck className="w-4 h-4" />
                <span>Submitted</span>
              </>
            ) : (
              <span>Withdraw Money</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
