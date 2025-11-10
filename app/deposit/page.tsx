"use client"

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function DepositPage() {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const quickAmounts = [100, 500, 1000, 5000, 10000]

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

    if (parseFloat(amount) < 100) {
      setError('Minimum deposit is 100 ETB')
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/account" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Account
        </Link>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800">
            💰 Deposit Funds
          </h1>

          {success ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-8xl mb-6">✅</div>
              <h2 className="text-3xl font-bold mb-4 text-gray-800">Request Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Your deposit request for {formatCurrency(parseFloat(amount))} has been submitted to admin for approval.
              </p>
              <p className="text-sm text-gray-500">You'll be notified once it's approved. Redirecting...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <p className="text-red-600 font-semibold">❌ {error}</p>
                </div>
              )}
              {/* Quick Amount Buttons */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Quick Select Amount
                </label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt.toString())}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                        amount === amt.toString()
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {amt} ETB
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount Input */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Or Enter Custom Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                    min="0"
                    step="10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                    ETB
                  </span>
                </div>
              </div>

              {/* Transaction Reference */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Enter your bank transaction reference"
                  className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Include your transaction reference to speed up approval
                </p>
              </div>

              {/* Proof Upload */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Upload Payment Proof (Screenshot/Receipt)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  {proofPreview ? (
                    <div className="space-y-4">
                      <img
                        src={proofPreview}
                        alt="Proof preview"
                        className="max-h-64 mx-auto rounded-lg shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null)
                          setProofPreview(null)
                        }}
                        className="text-red-600 hover:text-red-700 font-semibold"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-6xl mb-4">📸</div>
                      <label className="cursor-pointer">
                        <span className="text-blue-600 hover:text-blue-700 font-semibold">
                          Click to upload
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        PNG, JPG, or PDF up to 5MB
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Upload a screenshot of your bank transfer or Telebirr receipt
                </p>
              </div>

              {/* Payment Methods */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Payment Method
                </label>
                <div className="space-y-3">
                  <button className="w-full p-4 border-2 border-blue-500 bg-blue-50 rounded-lg text-left hover:bg-blue-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white text-2xl">
                        💳
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">Bank Transfer</div>
                        <div className="text-sm text-gray-600">Transfer to our bank account</div>
                      </div>
                    </div>
                  </button>

                  <button className="w-full p-4 border-2 border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors opacity-50 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white text-2xl">
                        📱
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">Mobile Money</div>
                        <div className="text-sm text-gray-600">Coming soon</div>
                      </div>
                    </div>
                  </button>

                  <button className="w-full p-4 border-2 border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors opacity-50 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center text-white text-2xl">
                        ₿
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">Cryptocurrency</div>
                        <div className="text-sm text-gray-600">Coming soon</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="font-bold text-gray-800 mb-3">Bank Transfer Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bank Name:</span>
                    <span className="font-semibold">Commercial Bank of Ethiopia</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account Name:</span>
                    <span className="font-semibold">Bingo Royale</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account Number:</span>
                    <span className="font-semibold">1000123456789</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-4">
                  After transfer, contact support with your transaction reference
                </p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleDeposit}
                disabled={!amount || parseFloat(amount) <= 0 || loading}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Deposit</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                Minimum deposit: 100 ETB
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
