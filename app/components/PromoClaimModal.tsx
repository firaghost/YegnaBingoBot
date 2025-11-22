"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'
import { LuGift, LuX } from 'react-icons/lu'

interface PromoClaimModalProps {
  open: boolean
  onClose: () => void
}

export default function PromoClaimModal({ open, onClose }: PromoClaimModalProps) {
  const { user, refreshUser } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [amount, setAmount] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      setCode('')
      setError(null)
      setSuccess(false)
      setAmount(null)
    }
  }, [open])

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('Please open the game from Telegram again.')
      return
    }
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Please enter your promo code.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, code: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to redeem promo')
      }
      const credited = Number(json.amount || 0)
      setSuccess(true)
      setAmount(credited || null)
      await refreshUser()
    } catch (err: any) {
      console.error('Promo redeem error:', err)
      setSuccess(false)
      setAmount(null)
      const msg = err?.message || 'Failed to redeem promo'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-xl flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-b-0 border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.85)] flex flex-col max-h-[60vh] animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-900">
              <LuGift className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-50">Claim Promo</p>
              <p className="text-xs text-slate-400">Enter the code you received on Telegram</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-300"
            aria-label="Close"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-4 py-3 gap-3">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Promo Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FRIWIN520"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/70 tracking-[0.18em] uppercase"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-900/40 border border-rose-700/60 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {success && (
            <div className="text-xs text-emerald-200 bg-emerald-900/40 border border-emerald-700/60 rounded-lg px-3 py-2">
              Promo applied!
              {amount && amount > 0
                ? ` ${formatCurrency(amount)} has been added to your balance.`
                : ' Your balance has been updated.'}
            </div>
          )}

          <div className="mt-auto pt-2 flex flex-col gap-2 text-[11px] text-slate-400">
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-500 text-slate-900 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>Checking promo</span>
                </>
              ) : (
                <span>Claim Promo</span>
              )}
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Promo codes are single-use and may expire. If your code does not work, please contact support.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
