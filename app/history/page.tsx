"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import BottomNav from '@/app/components/BottomNav'
import { LuHistory, LuCalendar, LuClock, LuArrowDown, LuArrowUp, LuInfo, LuWallet, LuStar } from 'react-icons/lu'
import { getConfig } from '@/lib/admin-config'

interface Transaction {
  id: string
  type: 'stake' | 'win' | 'deposit' | 'withdrawal' | 'bonus'
  amount: number
  game_id: string | null
  created_at: string
  status: string
  description: string
  result: 'WIN' | 'LOSS' | 'NEUTRAL'
  game_level: string | null
  display_icon: string
  display_amount: string
  display_status: 'success' | 'loss' | 'neutral'
  room_name: string | null
  reason?: string | null
  prize_pool?: number | null
  net_prize?: number | null
  commission_rate?: number | null
  commission_amount?: number | null
  bonus_deducted?: number | null
  main_deducted?: number | null
  total_deducted?: number | null
  source?: string | null
  credited_to?: string | null
  balance_before?: number | null
  balance_after?: number | null
  bonus_win_balance_before?: number | null
  bonus_win_balance_after?: number | null
}

interface GameHistory {
  id: string
  room_id: string
  status: string
  stake: number
  prize_pool: number
  winner_id: string | null
  started_at: string
  ended_at: string | null
  players: string[]
  rooms: {
    name: string
    color: string
  }
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'transactions' | 'games'>('games')
  const [txVisible, setTxVisible] = useState(5)
  const [gamesVisible, setGamesVisible] = useState(5)
  const [commissionRate, setCommissionRate] = useState<number>(0.1)
  const [myGameIds, setMyGameIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!user) return

    const fetchHistory = async () => {
      try {
        // Fetch transactions using enhanced view
        const { data: txData, error: txError } = await supabase
          .from('user_transaction_history')
          .select('*')
          .eq('user_id', user.id)
          .limit(50)

        if (txError) throw txError
        setTransactions(txData || [])

        // Determine user's game IDs from transactions (stake/win)
        const { data: myTxGameRows } = await supabase
          .from('transactions')
          .select('game_id, type')
          .eq('user_id', user.id)
          .in('type', ['stake', 'win'])
          .not('game_id', 'is', null)
          .limit(200)

        const gameIds = Array.from(new Set((myTxGameRows || []).map((r: any) => r.game_id).filter(Boolean)))
        setMyGameIds(new Set(gameIds as string[]))

        // Fetch game history constrained to these game IDs; if none, fallback to players contains
        let gamesQuery = supabase
          .from('games')
          .select(`
            *,
            rooms (
              name,
              color
            )
          `)
          .order('started_at', { ascending: false })
          .limit(50)

        gamesQuery = gameIds.length > 0 ? gamesQuery.in('id', gameIds as string[]) : gamesQuery.contains('players', [user.id])
        gamesQuery = gamesQuery.eq('status', 'finished')

        const { data: gamesData, error: gamesError } = await gamesQuery
        if (gamesError) throw gamesError
        setGameHistory((gamesData || []) as any)
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [user])

  // Load commission rate once
  useEffect(() => {
    const loadCommission = async () => {
      try {
        const rate = await getConfig('game_commission_rate')
        const numeric = typeof rate === 'number' ? rate : parseFloat(rate)
        const normalized = isNaN(numeric as number)
          ? 0.1
          : ((numeric as number) > 1 ? (numeric as number) / 100 : (numeric as number))
        setCommissionRate(normalized)
      } catch {}
    }
    loadCommission()
  }, [])

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Capture current user fields (user is guaranteed non-null after the guard above)
  const UID = String(user.id)
  const TGID_STR = String(user.telegram_id)
  const TGID_NUM = Number(user.telegram_id)
  const UNAME = String(user.username || '')

  // Helper: decide if a game belongs to the current user (after user is non-null)
  const isMyGame = (game: any) => {
    if (!game) return false
    const players: any[] = Array.isArray(game.players) ? game.players : []
    if (players.length > 0) {
      return (
        players.includes(UID) ||
        players.includes(TGID_STR) ||
        players.includes(TGID_NUM)
      )
    }
    return myGameIds.size > 0 ? myGameIds.has(game.id) : false
  }

  // Only finished games count as history
  const myGames = gameHistory.filter(g => g.status === 'finished' && isMyGame(g))
  const myWins = myGames.filter(g => {
    const wid = (g as any).winner_id
    return String(wid) === UID || String(wid) === UNAME || String(wid) === TGID_STR
  }).length
  const winRate = myGames.length > 0 ? (myWins / myGames.length) * 100 : 0
  const totalWonAmount = transactions
    .filter(tx => tx.type === 'win' && typeof tx.amount === 'number' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuHistory className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold text-slate-900">History</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Summary card */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-4 mb-4 shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs opacity-80">Total Games</div>
              <div className="text-xl font-semibold">{myGames.length}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Games Won</div>
              <div className="text-xl font-semibold">{myWins}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Win Rate</div>
              <div className="text-xl font-semibold">{winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Total Winnings</div>
              <div className="text-xl font-semibold">{formatCurrency(totalWonAmount)}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab('games')}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'games' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Games ({myGames.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Transactions ({transactions.filter(tx => tx.type === 'deposit' || tx.type === 'withdrawal').length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'transactions' ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-semibold mb-4 text-slate-900">Transaction History</h3>
              {transactions.filter(tx => ['deposit', 'withdrawal', 'stake', 'win', 'bonus'].includes(tx.type)).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">💳</div>
                  <p className="text-xl">No transactions yet</p>
                  <p className="text-sm mt-2">Start playing to see your history!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {transactions
                      .filter(tx => ['deposit', 'withdrawal', 'stake', 'win', 'bonus'].includes(tx.type))
                      .slice(0, txVisible)
                      .map(tx => {
                        const isDeposit = tx.type === 'deposit'
                        const isWithdrawal = tx.type === 'withdrawal'
                        const isStake = tx.type === 'stake'
                        const isWin = tx.type === 'win'
                        const status = (tx.status || '').toLowerCase()
                        const title = isDeposit ? 'Deposit' : isWithdrawal ? 'Withdrawal' : isStake ? 'Game Entry' : isWin ? 'Win Payout' : 'Bonus Credit'
                        const iconBg = isDeposit
                          ? 'bg-emerald-500'
                          : isWin
                            ? 'bg-blue-500'
                            : isStake
                              ? 'bg-amber-500'
                              : isWithdrawal
                                ? 'bg-rose-500'
                                : 'bg-purple-500'
                        const amountColor = isDeposit || isWin || tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                        const StatusBadge = () => (
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {status || 'unknown'}
                          </span>
                        )
                        return (
                          <div key={tx.id} className="p-3 border border-slate-200 rounded-lg bg-white hover:shadow-sm transition">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center text-white shrink-0`}>
                                  {isDeposit ? <LuArrowDown className="w-4 h-4" /> : <LuArrowUp className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-900 truncate">{title}</p>
                                    <StatusBadge />
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                    <span className="inline-flex items-center gap-1">
                                      <LuCalendar className="w-3.5 h-3.5" />
                                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <LuClock className="w-3.5 h-3.5" />
                                      {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="truncate">Ref: {String(tx.id).slice(0, 8).toUpperCase()}</span>
                                    {tx.game_level && (
                                      <span className="inline-flex items-center gap-1">
                                        <LuStar className="w-3.5 h-3.5" />
                                        {tx.game_level}
                                      </span>
                                    )}
                                  </div>
                                  {tx.description && (
                                    <p className="mt-1 text-xs text-slate-500 truncate">{tx.description}</p>
                                  )}
                                  {/* Rejection/Failure reason */}
                                  {(status === 'failed' || status === 'rejected') && tx.reason && (
                                    <p className="mt-1 text-xs text-rose-600 truncate">Reason: {tx.reason}</p>
                                  )}
                                  {/* Details grid: stake/win breakdown and wallet snapshots */}
                                  {(isStake || isWin || typeof tx.balance_before === 'number' || typeof tx.bonus_win_balance_before === 'number') && (
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500">
                                      {(isStake && typeof tx.bonus_deducted === 'number' && typeof tx.main_deducted === 'number') && (
                                        <div className="flex items-center gap-1">
                                          <LuWallet className="w-3.5 h-3.5" />
                                          <span>
                                            Stake split: {formatCurrency(tx.main_deducted || 0)} real / {formatCurrency(tx.bonus_deducted || 0)} bonus
                                          </span>
                                        </div>
                                      )}
                                      {(isWin && typeof tx.net_prize === 'number') && (
                                        <div className="flex items-center gap-1">
                                          <LuInfo className="w-3.5 h-3.5" />
                                          <span>
                                            Net prize {formatCurrency(tx.net_prize || 0)} after {Math.round((tx.commission_rate || 0) * 100)}% commission
                                          </span>
                                        </div>
                                      )}
                                      {tx.credited_to && (
                                        <div className="flex items-center gap-1">
                                          <LuWallet className="w-3.5 h-3.5" />
                                          <span>Credited to: {tx.credited_to.replace('_', ' ')}</span>
                                        </div>
                                      )}
                                      {typeof tx.balance_before === 'number' && typeof tx.balance_after === 'number' && (
                                        <div className="flex items-center gap-1">
                                          <LuWallet className="w-3.5 h-3.5" />
                                          <span>Real wallet: {formatCurrency(tx.balance_before || 0)} → {formatCurrency(tx.balance_after || 0)}</span>
                                        </div>
                                      )}
                                      {typeof tx.bonus_win_balance_before === 'number' && typeof tx.bonus_win_balance_after === 'number' && (
                                        <div className="flex items-center gap-1">
                                          <LuWallet className="w-3.5 h-3.5" />
                                          <span>Bonus-win wallet: {formatCurrency(tx.bonus_win_balance_before || 0)} → {formatCurrency(tx.bonus_win_balance_after || 0)}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className={`ml-3 text-right font-bold ${amountColor}`}>
                                {isDeposit ? '+' : '-'}{formatCurrency(Math.abs(tx.amount || 0))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  {transactions.filter(tx => ['deposit', 'withdrawal', 'stake', 'win', 'bonus'].includes(tx.type)).length > txVisible && (
                    <div className="mt-3 flex justify-center">
                      <button onClick={() => setTxVisible(v => v + 10)} className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg">View more</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-semibold mb-4 text-slate-900">Game History</h3>
              {gameHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">🎰</div>
                  <p className="text-xl">No games played yet</p>
                  <p className="text-sm mt-2">Join a room to start playing!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {gameHistory
                      .filter(isMyGame)
                      .slice(0, gamesVisible)
                      .map(game => {
                      const isWinner = game.winner_id === user.id
                      const isFinished = game.status === 'finished'
                      const winnersCount = game.winner_id ? 1 : 0
                      const shortId = (game.id || '').toString().slice(0, 8).toUpperCase()
                      // Calculate net prize after commission
                      const netPrize = game.prize_pool * (1 - commissionRate)
                      // Determine stake source for this game from transaction history
                      const stakeTx = transactions.find(tx => tx.type === 'stake' && tx.game_id === game.id)
                      const stakeSource = stakeTx?.source || null
                      const stakeSourceLabel = stakeSource === 'main'
                        ? 'Cash'
                        : stakeSource === 'bonus'
                          ? 'Bonus'
                          : stakeSource === 'mixed'
                            ? 'Cash + Bonus'
                            : null
                      return (
                        <div key={game.id} className="px-3 py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all">
                          {/* Header: game name + status pill */}
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="font-semibold text-slate-900">Game {shortId}</h4>
                            {isFinished && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isWinner ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                              }`}>
                                {isWinner ? 'Won' : 'Lost'}
                              </span>
                            )}
                          </div>

                          {/* Subline: date/time */}
                          <div className="flex items-center gap-3 text-[11px] text-slate-600 mb-2">
                            <span className="inline-flex items-center gap-1">
                              <LuCalendar className="w-3.5 h-3.5" />
                              {new Date(game.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <LuClock className="w-3.5 h-3.5" />
                              {new Date(game.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-slate-600">Stake</p>
                              <p className="font-semibold text-slate-900">{formatCurrency(game.stake)}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Net Prize</p>
                              <p className="font-semibold text-emerald-600">{formatCurrency(netPrize)}</p>
                            </div>
                            <div>
                              <p className="text-slate-600">Winners</p>
                              <p className="font-semibold text-slate-900">{winnersCount}</p>
                            </div>
                          </div>

                          {stakeSourceLabel && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Wallet used: <span className="font-semibold text-slate-800">{stakeSourceLabel}</span>
                              {typeof (stakeTx?.main_deducted) === 'number' || typeof (stakeTx?.bonus_deducted) === 'number' ? (
                                <>
                                  {' '}
                                  <span className="text-slate-400">(Cash {formatCurrency(stakeTx?.main_deducted || 0)} / Bonus {formatCurrency(stakeTx?.bonus_deducted || 0)})</span>
                                </>
                              ) : null}
                            </p>
                          )}

                          {isFinished && game.ended_at && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-xs text-slate-500">
                                Game ended: {new Date(game.ended_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {gameHistory.length > gamesVisible && (
                    <div className="mt-3 flex justify-center">
                      <button onClick={() => setGamesVisible(v => v + 10)} className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg">View more</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    </div>
  )
}
