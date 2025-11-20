"use client"

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { LuArrowLeft, LuCoins, LuUpload, LuCheck, LuX } from 'react-icons/lu'
import { getConfig } from '@/lib/admin-config'

interface BankAccount {
  id: string
  bank_name: string
  account_number: string
  account_holder: string
  branch?: string
  swift_code?: string
}

export default function DepositPage() {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null)
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [transactionRef, setTransactionRef] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string; enabled: boolean; min_amount?: number | null; max_amount?: number | null }[]>([])
  const [selectedMethod, setSelectedMethod] = useState<'Chapa' | 'Manual'>('Manual')
  const [minDeposit, setMinDeposit] = useState<number>(10)
  const [maxDeposit, setMaxDeposit] = useState<number>(100000)
  const [chapaModalOpen, setChapaModalOpen] = useState(false)
  const [chapaCheckoutUrl, setChapaCheckoutUrl] = useState<string>('')
  const [pendingTxId, setPendingTxId] = useState<string>('')
  const txChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const quickAmounts = (
    Array.from(new Set([
      Math.round(minDeposit),
      Math.min(maxDeposit, Math.round(minDeposit * 2)),
      Math.min(maxDeposit, Math.round(minDeposit * 5)),
    ]))
    .filter(v => Number.isFinite(v) && v > 0) as number[]
  )

  // Fetch available banks and payment methods
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [banksRes, pmRes] = await Promise.all([
          supabase.from('bank_accounts').select('*').eq('is_active', true).order('bank_name', { ascending: true }),
          supabase.from('payment_methods').select('*').eq('enabled', true).order('name', { ascending: true })
        ])

        if (banksRes.error) throw banksRes.error
        setBanks(banksRes.data || [])

        if (!pmRes.error) {
          const methods = (pmRes.data || []) as any[]
          const mapped = methods.map(m => ({ id: m.id, name: m.name, enabled: !!m.enabled, min_amount: m.min_amount ?? null, max_amount: m.max_amount ?? null }))
          setPaymentMethods(mapped)
          // Default method based on enabled methods
          const hasChapa = mapped.some(m => m.name === 'Chapa' && m.enabled)
          const hasManual = mapped.some(m => m.name === 'Manual' && m.enabled)
          setSelectedMethod(hasChapa ? 'Chapa' : (hasManual ? 'Manual' : 'Manual'))
          const pmMin = mapped.find(m => m.name === 'Chapa')?.min_amount
          const pmMax = mapped.find(m => m.name === 'Chapa')?.max_amount
          // Load additional limits from admin_config
          try {
            const minReq = Number(await getConfig('min_required_deposit'))
            const maxDep = Number(await getConfig('deposit_max'))
            setMinDeposit(Number.isFinite(minReq) && minReq > 0 ? minReq : (typeof pmMin === 'number' ? pmMin : 10))
            setMaxDeposit(Number.isFinite(maxDep) && maxDep > 0 ? maxDep : (typeof pmMax === 'number' ? pmMax : 100000))
          } catch {
            setMinDeposit(typeof pmMin === 'number' ? pmMin : 10)
            setMaxDeposit(typeof pmMax === 'number' ? pmMax : 100000)
          }
        }
      } catch (error) {
        console.error('Error loading deposit data:', error)
        setError('Failed to load deposit options')
      }
    }

    fetchData()
    return () => {
      try { if (txChannelRef.current) txChannelRef.current.unsubscribe() } catch {}
    }
  }, [])

  // Centralized cleanup for Chapa modal/session
  const closeChapaModal = async () => {
    try { if (txChannelRef.current) await txChannelRef.current.unsubscribe() } catch {}
    txChannelRef.current = null
    setChapaModalOpen(false)
    setPendingTxId('')
    setChapaCheckoutUrl('')
    setLoading(false)
  }

  // Cleanup if page is hidden/unloaded (Telegram or browser)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && chapaModalOpen) closeChapaModal()
    }
    const handlePageHide = () => {
      if (chapaModalOpen) closeChapaModal()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
    }
  }, [chapaModalOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('File size must be less than 5MB')
        return
      }
      setProofFile(file)
      setProofPreview(URL.createObjectURL(file))
      setError('')
    }
  }

  // Initialize Chapa inline checkout
  const handleChapaDeposit = async () => {
    try {
      setError('')
      if (!user) return setError('Please login first')
      const amt = Number(amount)
      if (!Number.isFinite(amt) || amt <= 0) return setError('Please enter a valid amount')
      if (amt < minDeposit) return setError(`Minimum deposit is ${minDeposit} ETB`)
      if (amt > maxDeposit) return setError(`Maximum deposit is ${maxDeposit} ETB`)

      setLoading(true)
      // Create/init payment
      const res = await fetch('/api/payments/chapa/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: amt })
      })
      const data = await res.json()
      if (!res.ok) {
        const details = typeof data?.details === 'string'
          ? data.details
          : (data?.details?.message || (data?.details ? JSON.stringify(data.details) : ''))
        setLoading(false)
        setError([data?.error, details].filter(Boolean).join(': '))
        return
      }

      const { checkout_url, transaction_id } = data
      if (!checkout_url || !transaction_id) throw new Error('Invalid payment session')
      setChapaCheckoutUrl(checkout_url)
      setPendingTxId(transaction_id)
      setChapaModalOpen(true)

      // Subscribe to transaction status updates
      try {
        if (txChannelRef.current) await txChannelRef.current.unsubscribe()
      } catch {}
      const channel = supabase
        .channel(`tx:${transaction_id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${transaction_id}` }, (payload: any) => {
          const newRow = payload?.new || {}
          const status = String(newRow?.status || '').toLowerCase()
          if (status === 'completed' || status === 'completed_test') {
            setSuccess(true)
            setLoading(false)
            closeChapaModal()
            setTimeout(() => { window.location.href = '/account' }, 1200)
          } else if (status === 'failed' || status === 'rejected') {
            setError('Payment failed. Please try again or use manual deposit.')
            setLoading(false)
            closeChapaModal()
          }
        })
        .subscribe()
      txChannelRef.current = channel
    } catch (e: any) {
      setLoading(false)
      closeChapaModal()
      setError(e?.message || 'Failed to initialize Chapa')
    }
  }

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    // If Chapa is selected, start Chapa flow immediately
    if (selectedMethod === 'Chapa') {
      await handleChapaDeposit()
      return
    }

    if (selectedMethod === 'Manual' && !selectedBank) {
      setError('Please select a bank account')
      return
    }

    // For manual deposits only
    if (selectedMethod === 'Manual') {
      // Transaction reference is REQUIRED
      if (!transactionRef || transactionRef.trim() === '') {
        setError('Transaction reference/FTP number is required')
        return
      }
    }

    if (!user) {
      setError('Please login first')
      return
    }
    
    setLoading(true)
    setError('')

    try {
      let proofUrl = null

      // Upload proof file if provided (manual only)
      if (selectedMethod === 'Manual' && proofFile) {
        const fileExt = proofFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `deposit-proofs/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('transaction-proofs')
          .upload(filePath, proofFile)

        if (uploadError) {
          throw new Error('Failed to upload proof image')
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('transaction-proofs')
          .getPublicUrl(filePath)

        proofUrl = publicUrl
      }

      // Manual deposit flow remains the same
      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: parseFloat(amount),
          paymentMethod: selectedBank?.bank_name,
          bankId: selectedBank?.id,
          bankInfo: selectedBank ? {
            bank_name: selectedBank.bank_name,
            account_number: selectedBank.account_number,
            account_holder: selectedBank.account_holder,
            branch: selectedBank.branch,
            swift_code: selectedBank.swift_code
          } : null,
          transactionRef: transactionRef || null,
          proofUrl: proofUrl
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit deposit request')
      }

      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/account'
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to submit deposit request')
      setLoading(false)
    }
  }

  const isSuspended = (user as any)?.status === 'inactive'

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/account" className="text-slate-600 hover:text-slate-900">
            <LuArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-2">
            <LuCoins className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900">Deposit</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Suspension Banner */}
        {isSuspended && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
                <LuX className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-800 mb-1">Account Suspended</h2>
              <p className="text-xs text-red-700 mb-1">You cannot create new deposits while your account is suspended.</p>
              {(user as any)?.suspension_reason && (
                <p className="text-xs text-red-600"><span className="font-semibold">Reason:</span> {(user as any).suspension_reason}</p>
              )}
            </div>
          </div>
        )}

        {success ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LuCheck className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-slate-900">Request Submitted!</h2>
            <p className="text-slate-600 mb-4 text-sm">
              Your deposit request for {formatCurrency(parseFloat(amount))} has been submitted.
            </p>
            <p className="text-xs text-slate-500">Redirecting to account...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <LuX className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {/* Payment method auto-selected (UI hidden). If Chapa is enabled, it's used by default; otherwise Manual is used. */}

            {/* Amount & Method-specific Section */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Amount Section */}
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Amount
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(amt.toString())}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-xs ${
                          amount === amt.toString()
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {amt} ETB
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Custom amount"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                      min={minDeposit}
                      max={maxDeposit}
                      step="1"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-slate-500 text-xs">ETB</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Method-specific UI */}
                <div>
                  {selectedMethod === 'Chapa' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700">Pay instantly using Chapa. A secure checkout will open below.</p>
                      <button
                        onClick={handleChapaDeposit}
                        disabled={isSuspended || !amount || Number(amount) < minDeposit || Number(amount) > maxDeposit || loading}
                        className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSuspended ? 'Account suspended' : (loading ? 'Starting payment…' : 'Pay with Chapa')}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        Bank Account
                      </label>
                      {banks.length === 0 ? (
                        <div className="text-center py-4 text-slate-500">
                          <LuCoins className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                          <p className="text-xs">No banks configured</p>
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            value={selectedBank?.id || ''}
                            onChange={(e) => {
                              const bank = banks.find(b => b.id === e.target.value)
                              setSelectedBank(bank || null)
                            }}
                            className="w-full px-3 py-2 pr-8 text-sm border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100 bg-white appearance-none"
                            required
                          >
                            <option value="">Choose bank...</option>
                            {banks.map((bank) => (
                              <option key={bank.id} value={bank.id}>
                                {bank.bank_name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      )}
                      
                      {/* Bank Details - Compact */}
                      {selectedBank && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-blue-700">Account:</span>
                              <span className="font-mono text-blue-900">{selectedBank.account_number}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-700">Name:</span>
                              <span className="text-blue-900">{selectedBank.account_holder}</span>
                            </div>
                            {selectedBank.branch && (
                              <div className="flex justify-between">
                                <span className="text-blue-700">Branch:</span>
                                <span className="text-blue-900">{selectedBank.branch}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction Reference - Manual only */}
            {selectedMethod === 'Manual' && (
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Transaction Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Enter FTP number or transaction reference"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Required: Enter the FTP number from your bank transfer
                </p>
              </div>
            )}
            
            {/* Submit Button - only for Manual deposits (Chapa has its own button above) */}
            {selectedMethod === 'Manual' && (
              <button
                onClick={handleDeposit}
                disabled={isSuspended || !amount || parseFloat(amount) <= 0 || !selectedBank || loading}
                className="w-full bg-emerald-500 text-white py-3 rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSuspended ? (
                  <span>Account suspended</span>
                ) : loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Submit Deposit Request</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
      {/* Chapa Inline Modal */}
      {chapaModalOpen && chapaCheckoutUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-0 md:p-4" role="dialog" aria-modal="true" onClick={closeChapaModal}>
          <div className="relative bg-white w-full h-[100dvh] md:h-[92vh] md:max-w-2xl md:rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Floating close button */}
            <button
              onClick={closeChapaModal}
              className="absolute top-3 left-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow border border-slate-200"
              aria-label="Close"
            >
              <LuX className="w-5 h-5" />
            </button>

            {/* Full-bleed iframe */}
            <iframe src={chapaCheckoutUrl} title="Chapa Checkout" className="w-full h-full border-0" />

            {/* Floating external link (no layout height cost) */}
            <a
              href={chapaCheckoutUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 right-3 text-xs px-3 py-1.5 rounded-full bg-white/90 text-emerald-700 hover:underline shadow border border-slate-200"
            >
              Open in new window
            </a>
          </div>
        </div>
      )}
    </div>
    
  )
}
