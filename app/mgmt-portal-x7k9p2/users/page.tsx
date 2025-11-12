"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.telegram_id?.toString().includes(searchTerm)
  )

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setDeletingUser(true)
    try {
      // First, update any games where this user is the winner to set winner_id to null
      const { error: gamesError } = await supabase
        .from('games')
        .update({ winner_id: null })
        .eq('winner_id', selectedUser.id)

      if (gamesError) throw gamesError

      // Delete user's transactions
      const { error: transactionsError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', selectedUser.id)

      if (transactionsError) throw transactionsError

      // Finally, delete the user
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id)

      if (userError) throw userError

      // Refresh the users list
      fetchUsers()
      setShowDeleteModal(false)
      setShowUserModal(false)
      setSelectedUser(null)
      alert('User deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert(error.message || 'Failed to delete user')
    } finally {
      setDeletingUser(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Enhanced Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 shadow-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-white">User Management</h1>
                  <p className="text-gray-300 text-xs sm:text-sm">Manage platform users and analytics</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/mgmt-portal-x7k9p2/games" className="flex items-center gap-2 bg-green-600/20 text-green-400 px-3 py-2 rounded-lg hover:bg-green-600/30 transition-colors text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline">Live Games</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Search Bar */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username or Telegram ID..."
            className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg focus:border-blue-400 focus:outline-none text-white placeholder-gray-400"
          />
        </div>

        {/* Desktop Users Table - Hidden on Mobile */}
        <div className="hidden lg:block bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Telegram ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Balance</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Games</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Wins</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Joined</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {user.username?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{user.username || 'Unknown'}</div>
                            <div className="text-sm text-gray-400">ID: {user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{user.telegram_id}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-400">
                          {formatCurrency(user.balance || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{user.games_played || 0}</td>
                      <td className="px-6 py-4 text-gray-300">{user.games_won || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {user.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowUserModal(true)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => window.open(`https://t.me/${user.telegram_id}`, '_blank')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Contact
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user)
                              setShowDeleteModal(true)
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            Delete
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

        {/* Mobile Users Cards - Visible on Mobile Only */}
        <div className="lg:hidden space-y-4 mb-6">
          {loading ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-8 text-center">
              <p className="text-gray-400">No users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {user.username?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-lg">{user.username || 'Unknown'}</div>
                    <div className="text-sm text-gray-400">ID: {user.id.slice(0, 8)}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {user.status || 'pending'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">Telegram ID</div>
                    <div className="text-white font-medium">{user.telegram_id}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Balance</div>
                    <div className="text-green-400 font-semibold">{formatCurrency(user.balance || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Games Played</div>
                    <div className="text-white font-medium">{user.games_played || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Games Won</div>
                    <div className="text-white font-medium">{user.games_won || 0}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-400 mb-1">Joined</div>
                    <div className="text-white font-medium">{new Date(user.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Mobile Action Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowUserModal(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => window.open(`https://t.me/${user.telegram_id}`, '_blank')}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Contact
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowDeleteModal(true)
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User Details Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-white">User Details</h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {selectedUser.username?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg">{selectedUser.username || 'Unknown'}</h4>
                    <p className="text-gray-400 text-sm">ID: {selectedUser.id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Balance</div>
                    <div className="text-green-400 font-bold">{formatCurrency(selectedUser.balance || 0)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Games Played</div>
                    <div className="text-white font-bold">{selectedUser.games_played || 0}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Games Won</div>
                    <div className="text-white font-bold">{selectedUser.games_won || 0}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">Win Rate</div>
                    <div className="text-white font-bold">
                      {selectedUser.games_played > 0 
                        ? `${Math.round((selectedUser.games_won / selectedUser.games_played) * 100)}%`
                        : '0%'
                      }
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Telegram ID</div>
                  <div className="text-white font-medium">{selectedUser.telegram_id}</div>
                </div>

                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedUser.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      selectedUser.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {selectedUser.status || 'pending'}
                    </span>
                    {selectedUser.status === 'pending' && (
                      <button
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('users')
                              .update({ status: 'active' })
                              .eq('id', selectedUser.id)
                            
                            if (error) throw error
                            
                            // Refresh the selected user data
                            setSelectedUser({ ...selectedUser, status: 'active' })
                            // Refresh the users list
                            fetchUsers()
                            alert('User activated successfully!')
                          } catch (error) {
                            console.error('Error activating user:', error)
                            alert('Failed to activate user')
                          }
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Member Since</div>
                  <div className="text-white font-medium">{new Date(selectedUser.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => window.open(`https://t.me/${selectedUser.telegram_id}`, '_blank')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Contact User
                </button>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-white">Delete User</h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-4 p-4 bg-red-500/10 rounded-lg border border-red-500/20 mb-4">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-400 text-lg">Warning!</h4>
                    <p className="text-red-300 text-sm">This action cannot be undone.</p>
                  </div>
                </div>

                <p className="text-gray-300 mb-4">
                  Are you sure you want to delete <strong className="text-white">{selectedUser.username || 'this user'}</strong>?
                </p>
                
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300">
                  <p className="mb-2">This will:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Permanently delete the user account</li>
                    <li>Remove all transaction history</li>
                    <li>Clear winner references from games</li>
                    <li>Cannot be reversed</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deletingUser}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {deletingUser ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete User'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Users</div>
            <div className="text-3xl font-bold text-white">{users.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Active Users</div>
            <div className="text-3xl font-bold text-green-400">
              {users.filter(u => u.status === 'active').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Balance</div>
            <div className="text-3xl font-bold text-purple-400">
              {formatCurrency(users.reduce((sum, u) => sum + (u.balance || 0), 0))}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
            <div className="text-sm text-gray-400 mb-1">Total Games</div>
            <div className="text-3xl font-bold text-orange-400">
              {users.reduce((sum, u) => sum + (u.games_played || 0), 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
