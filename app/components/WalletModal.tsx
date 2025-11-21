"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { LuWallet, LuX, LuEye, LuEyeOff, LuGift, LuArrowRight } from 'react-icons/lu'

interface WalletModalProps {
  open: boolean
  onClose: () => void
  onOpenDeposit: () => void
  onOpenWithdraw: () => void
}

export default function WalletModal({ open, onClose, onOpenDeposit, onOpenWithdraw }: WalletModalProps) {
  const { user } = useAuth()
  const [hidden, setHidden] = useState(true)
  const [showBonusDetails, setShowBonusDetails] = useState(false)
  const [recentTx, setRecentTx] = useState<any[]>([])
  const [loadingTx, setLoadingTx] = useState(false)

  // Load a few recent wallet-related transactions when wallet opens
  useEffect(() => {
    if (!open || !user?.id) return

    const fetchRecent = async () => {
      try {
        setLoadingTx(true)
        const { data, error } = await supabase
          .from('user_transaction_history')
          .select('*')
          .eq('user_id', user.id)
          .in('type', ['deposit', 'withdrawal', 'stake', 'win', 'bonus', 'referral_bonus'])
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error
        setRecentTx(data || [])
      } catch (e) {
        console.error('Error loading recent wallet transactions', e)
        setRecentTx([])
      } finally {
        setLoadingTx(false)
      }
    }

    fetchRecent()
  }, [open, user?.id])

  if (!open) return null

  const cashBalance = user?.balance || 0
  const bonusBalance = user?.bonus_balance || 0
  const bonusWinBalance = (user as any)?.bonus_win_balance || 0
  const totalBonus = bonusBalance + bonusWinBalance

  const displayCash = hidden ? '••••••' : formatCurrency(cashBalance)
  const displayBonus = hidden ? '••••••' : formatCurrency(totalBonus)

  return (
    <div 
      className="fixed inset-0 z-[130] bg-transparent flex items-end justify-center"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-slate-950 rounded-t-3xl border border-b-0 border-slate-800 shadow-2xl flex flex-col h-[calc(100vh-4rem)] animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900">
              <LuWallet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-50">My Wallet</p>
              <p className="text-xs text-slate-400">Manage your funds</p>
            </div>
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
          {/* Cash balance card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">Cash Balance (Withdrawable)</p>
              <button
                type="button"
                onClick={() => setHidden((v) => !v)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300"
                aria-label={hidden ? 'Show balance' : 'Hide balance'}
              >
                {hidden ? <LuEye className="w-4 h-4" /> : <LuEyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-3xl font-bold text-slate-50 mb-3">{displayCash}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenDeposit}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <span>+ Deposit</span>
              </button>
              <button
                type="button"
                onClick={onOpenWithdraw}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <span>- Withdraw</span>
              </button>
            </div>
          </div>

          {/* Bonus balance card */}
          <div className="rounded-2xl bg-gradient-to-r from-amber-800 to-amber-600 p-4 text-slate-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold tracking-[0.16em] uppercase">Bonus Balance (Achievements)</p>
              <LuGift className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold mb-1">{displayBonus}</p>
            <p className="text-xs text-amber-100 mb-1">Redeem your bonus</p>
            <button
              type="button"
              onClick={() => setShowBonusDetails((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-50/90"
            >
              <span>View bonus details</span>
              <LuArrowRight className="w-3 h-3" />
            </button>
            {showBonusDetails && (
              <div className="mt-2 text-[11px] text-amber-50/90 space-y-0.5">
                <div>
                  <span>Bonus: {formatCurrency(bonusBalance)}</span>
                  <span className="mx-1">•</span>
                  <span>Bonus Wins: {formatCurrency(bonusWinBalance)}</span>
                </div>
                <p className="text-[10px] text-amber-100/90">
                  Bonus Wins are locked until your first real-money deposit
                </p>
              </div>
            )}
          </div>

          {/* Recent transactions (from history) */}
          <div className="mt-2 rounded-2xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-400">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 mb-3">RECENT TRANSACTIONS</p>
            {loadingTx ? (
              <div className="flex justify-center items-center py-4">
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentTx.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <LuWallet className="w-7 h-7 text-slate-600" />
                <p className="text-sm text-slate-300">No transactions yet</p>
                <p className="text-[11px] text-slate-500">Your recent deposits and withdrawals will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTx.map((tx) => {
                  const isDeposit = tx.type === 'deposit'
                  const isWithdrawal = tx.type === 'withdrawal'
                  const isWin = tx.type === 'win'
                  const isStake = tx.type === 'stake'
                  const isReferral = tx.type === 'referral_bonus'
                  const title = isReferral
                    ? 'Referral bonus'
                    : isDeposit
                      ? 'Deposit'
                      : isWithdrawal
                        ? 'Withdrawal'
                        : isWin
                          ? 'Win Payout'
                          : isStake
                            ? 'Game Entry'
                            : 'Bonus'
                  const amount = Number(tx.amount || 0)
                  const sign = isDeposit || isWin || isReferral || amount > 0 ? '+' : '-'
                  const color = isDeposit || isWin || isReferral || amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                  const created = new Date(tx.created_at)
                  return (
                    <div key={tx.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-200 font-semibold">{title}</span>
                        <span className="text-[10px] text-slate-500">
                          {created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                          • {created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isReferral && (
                          <span className="text-[10px] text-emerald-300 mt-0.5">
                            Invite rewards claimed
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] font-semibold ${color}`}>
                        {sign}
                        {formatCurrency(Math.abs(amount))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
