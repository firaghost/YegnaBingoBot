"use client"

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { LuArrowLeft, LuCoins, LuUpload, LuCheck, LuX } from 'react-icons/lu'

export default function DepositPage() {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const quickAmounts = [50, 100, 500]

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

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    // No minimum deposit restriction

    // Transaction reference is REQUIRED
    if (!transactionRef || transactionRef.trim() === '') {
      setError('Transaction reference/FTP number is required')
      return
    }

    if (!user) {
      setError('Please login first')
      return
    }
    
    setLoading(true)
    setError('')

    try {
      let proofUrl = null

      // Upload proof file if provided
      if (proofFile) {
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

      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: parseFloat(amount),
          paymentMethod: 'bank_transfer',
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
            {/* Quick Amount Buttons */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <label className="block text-sm font-medium text-slate-900 mb-3">
                Quick Select Amount
              </label>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className={`py-2.5 px-4 rounded-lg font-medium transition-all text-sm ${
                      amount === amt.toString()
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {amt} ETB
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  min="0"
                  step="10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                  ETB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">No minimum deposit required</p>
            </div>

            {/* Transaction Reference */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <label className="block text-sm font-medium text-slate-900 mb-3">
                Transaction Reference <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Enter FTP number or transaction reference"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                required
              />
              <p className="text-xs text-slate-500 mt-2">
                Required: Enter the FTP number from your bank transfer
              </p>
            </div>
            {/* Bank Details */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Bank Transfer Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Bank:</span>
                  <span className="font-medium text-slate-900">Commercial Bank of Ethiopia</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Account Name:</span>
                  <span className="font-medium text-slate-900">BingoX</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Account Number:</span>
                  <span className="font-medium text-slate-900">1000123456789</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleDeposit}
              disabled={!amount || parseFloat(amount) <= 0 || loading}
              className="w-full bg-emerald-500 text-white py-3 rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <span>Submit Deposit Request</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
    
  )
}
