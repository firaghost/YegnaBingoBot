"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

export default function SuspendedUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [suspensionLog, setSuspensionLog] = useState<any[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)

  useEffect(() => {
    fetchSuspendedUsers()
  }, [])

  const fetchSuspendedUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'inactive')
        .order('suspended_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching suspended users:', err)
    } finally {
      setLoading(false)
    }
  }

  const openSuspensionLog = async (user: any) => {
    setSelectedUser(user)
    setShowLogModal(true)
    setLoadingLog(true)
    try {
      const { data, error } = await supabase
        .from('user_suspensions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setSuspensionLog(data || [])
    } catch (err) {
      console.error('Error loading suspension log:', err)
      setSuspensionLog([])
    } finally {
      setLoadingLog(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/50 shadow-2xl sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.66 1.73-3L13.73 5c-.77-1.34-2.69-1.34-3.46 0L3.2 16c-.77 1.34.19 3 1.73 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-white">Suspended Users</h1>
                  <p className="text-slate-400 text-xs sm:text-sm">Review blocked accounts & reasons</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-red-900/40 to-slate-900 rounded-lg border border-red-700/40 p-3 sm:p-4">
            <div className="text-xs text-red-300 mb-1">Suspended Users</div>
            <div className="text-xl sm:text-2xl font-bold text-red-300">{users.length}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/80 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Wallet</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Referrals</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Reason</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Suspended At</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        Loading suspended users...
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No suspended users
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                            {user.username?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{user.username || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">TG: {user.telegram_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-400 mb-0.5">Real / Bonus</div>
                        <div className="font-semibold text-emerald-400">
                          {formatCurrency(user.balance || 0)}
                          <span className="text-slate-400"> / </span>
                          <span className="text-emerald-300">{formatCurrency(user.bonus_balance || 0)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm">
                        <div className="font-medium text-indigo-300">{user.total_referrals || 0}</div>
                        <div className="text-xs text-indigo-400">{formatCurrency(Number(user.referral_earnings || 0))}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 max-w-xs">
                        <div className="text-xs text-slate-400 mb-0.5">Last reason</div>
                        <div className="text-slate-200 text-xs line-clamp-3">{user.suspension_reason || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {user.suspended_at ? new Date(user.suspended_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openSuspensionLog(user)}
                            className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-700/70 hover:bg-slate-600/80 text-slate-200 border border-slate-600/60"
                          >
                            View log
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from('users')
                                  .update({ status: 'active', suspension_reason: null })
                                  .eq('id', user.id)
                                if (error) throw error
                                await fetchSuspendedUsers()
                              } catch (err) {
                                console.error('Failed to reactivate user:', err)
                              }
                            }}
                            className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40"
                          >
                            Reactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Suspension Log Modal */}
        {showLogModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700/50 p-4 sm:p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Suspension history</h3>
                  <p className="text-xs text-slate-400">{selectedUser.username} · {selectedUser.telegram_id}</p>
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingLog ? (
                <div className="py-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading suspension history...
                </div>
              ) : suspensionLog.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-sm">No suspension entries found.</div>
              ) : (
                <div className="space-y-3 text-sm">
                  {suspensionLog.map((entry) => (
                    <div key={entry.id} className="border border-slate-700/60 rounded-lg p-3 bg-slate-900/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/70 text-slate-200 border border-slate-600/60 uppercase tracking-wide">
                          {entry.source}
                        </span>
                      </div>
                      <div className="text-slate-100 mb-1">
                        {entry.reason}
                      </div>
                      {entry.context && (
                        <pre className="mt-1 text-[10px] text-slate-400 bg-slate-900/70 rounded p-2 overflow-x-auto">
                          {JSON.stringify(entry.context, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
