"use client"

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { getConfig } from '@/lib/admin-config'
import { LuX, LuCheck, LuCoins, LuChevronLeft } from 'react-icons/lu'

interface BankAccount {
  id: string
  bank_name: string
  account_number: string
  account_holder: string
  branch?: string
  swift_code?: string
}

interface DepositModalProps {
  open: boolean
  onClose: () => void
  onBack?: () => void
  isSheet?: boolean
}

export default function DepositModal({ open, onClose, onBack, isSheet = false }: DepositModalProps) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null)
  const [transactionRef, setTransactionRef] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [minDeposit, setMinDeposit] = useState<number>(10)
  const [maxDeposit, setMaxDeposit] = useState<number>(100000)

  // Derive quick amounts from limits
  const quickAmounts = useMemo(() => {
    const base = Math.round(minDeposit)
    const values = Array.from(new Set([
      base,
      Math.min(maxDeposit, base * 2),
      Math.min(maxDeposit, base * 5)
    ]))
    return (values.filter(v => Number.isFinite(v) && v > 0) as number[])
  }, [minDeposit, maxDeposit])

  useEffect(() => {
    if (!open) return

    const fetchData = async () => {
      try {
        setError('')
        // Load active banks
        const { data, error } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('is_active', true)
          .order('bank_name', { ascending: true })

        if (error) throw error
        setBanks(data || [])
        if ((data || []).length > 0) setSelectedBank((data || [])[0] as BankAccount)

        // Load min/max deposit from admin_config (fallbacks inside)
        try {
          const minReq = Number(await getConfig('min_required_deposit'))
          const maxDep = Number(await getConfig('deposit_max'))
          setMinDeposit(Number.isFinite(minReq) && minReq > 0 ? minReq : 10)
          setMaxDeposit(Number.isFinite(maxDep) && maxDep > 0 ? maxDep : 100000)
        } catch {
          setMinDeposit(10)
          setMaxDeposit(100000)
        }
      } catch (e) {
        console.error('Error loading deposit data:', e)
        setError('Failed to load deposit options')
      }
    }

    fetchData()
  }, [open])

  if (!open) return null

  const isSuspended = (user as any)?.status === 'inactive'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleSubmit = async () => {
    try {
      if (!user) {
        setError('Please login first')
        return
      }
      const amt = Number(amount)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError('Please enter a valid amount')
        return
      }
      if (amt < minDeposit) {
        setError(`Minimum deposit is ${formatCurrency(minDeposit)}`)
        return
      }
      if (amt > maxDeposit) {
        setError(`Maximum deposit is ${formatCurrency(maxDeposit)}`)
        return
      }
      if (!selectedBank) {
        setError('Please select a bank account')
        return
      }
      if (!transactionRef.trim()) {
        setError('Transaction reference/FTP number is required')
        return
      }

      setLoading(true)
      setError('')

      let proofUrl: string | null = null
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `deposit-proofs/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('transaction-proofs')
          .upload(filePath, proofFile)

        if (uploadError) throw new Error('Failed to upload proof image')

        const { data: { publicUrl } } = supabase.storage
          .from('transaction-proofs')
          .getPublicUrl(filePath)

        proofUrl = publicUrl
      }

      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          paymentMethod: selectedBank.bank_name,
          bankId: selectedBank.id,
          bankInfo: {
            bank_name: selectedBank.bank_name,
            account_number: selectedBank.account_number,
            account_holder: selectedBank.account_holder,
            branch: selectedBank.branch,
            swift_code: selectedBank.swift_code
          },
          transactionRef: transactionRef.trim(),
          proofUrl
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit deposit request')
      }

      setSuccess(true)
      setLoading(false)
      // auto-close after short delay
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2500)
    } catch (e: any) {
      console.error('Deposit error:', e)
      setLoading(false)
      setError(e?.message || 'Failed to submit deposit request')
    }
  }

  return (
    <div 
      className={`fixed inset-0 ${isSheet ? 'z-[140]' : 'z-[120]'} ${isSheet ? 'bg-transparent' : 'bg-black/70'} flex items-end justify-center`}
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
            <p className="text-sm font-semibold text-slate-50">Deposit Money</p>
            <p className="text-xs text-slate-400">Add money to your wallet</p>
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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isSuspended && (
            <div className="mb-2 bg-red-950/60 border border-red-700 rounded-xl p-3 text-xs text-red-100">
              <p className="font-semibold mb-1">Account Suspended</p>
              <p>You cannot create new deposits while your account is suspended.</p>
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mb-3">
                <LuCheck className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-50 mb-1">Request submitted</p>
              <p className="text-xs text-slate-400">Your deposit request has been sent for review.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-950/60 border border-red-700 rounded-lg p-2.5 text-xs text-red-100">
                  {error}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Amount</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(String(amt))}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                        amount === String(amt)
                          ? 'bg-amber-500 text-slate-900'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
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
                    min={minDeposit}
                    max={maxDeposit}
                    step="1"
                    placeholder={`${minDeposit} - ${maxDeposit}`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-[11px] text-slate-400">ETB</span>
                </div>
              </div>

              {/* Bank selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Bank Account</label>
                {banks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-slate-500 text-xs">
                    <LuCoins className="w-5 h-5 mb-1" />
                    <span>No banks configured</span>
                  </div>
                ) : (
                  <select
                    value={selectedBank?.id || ''}
                    onChange={(e) => {
                      const bank = banks.find(b => b.id === e.target.value) || null
                      setSelectedBank(bank)
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="" className="bg-slate-900">Choose bank...</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id} className="bg-slate-900">
                        {bank.bank_name}
                      </option>
                    ))}
                  </select>
                )}

                {selectedBank && (
                  <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Account</span>
                      <span className="font-mono">{selectedBank.account_number}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Name</span>
                      <span>{selectedBank.account_holder}</span>
                    </div>
                    {selectedBank.branch && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Branch</span>
                        <span>{selectedBank.branch}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Transaction reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Transaction Reference <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="FTP number or bank reference"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  This is shown on your bank transfer confirmation.
                </p>
              </div>

              {/* Proof upload (optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Upload Screenshot (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-50 hover:file:bg-slate-700"
                />
                {proofPreview && (
                  <img
                    src={proofPreview}
                    alt="Proof preview"
                    className="mt-2 h-24 w-full object-cover rounded-lg border border-slate-800"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-4 py-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || isSuspended}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>{isSuspended ? 'Account suspended' : 'Submit Deposit Request'}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
