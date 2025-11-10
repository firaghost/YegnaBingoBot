"use client"

import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export default function AccountPage() {
  const [user] = useState({
    username: 'Player_1234',
    balance: 5250,
    gamesPlayed: 47,
    gamesWon: 12,
    totalWinnings: 15800,
    winRate: 25.5,
    rank: 156,
    level: 8,
    joinedDate: '2025-01-15',
  })

  const [transactions] = useState([
    { id: 1, type: 'win', amount: 1000, game: 'Classic Room', date: '2025-11-10 09:30' },
    { id: 2, type: 'stake', amount: -10, game: 'Speed Bingo', date: '2025-11-10 09:15' },
    { id: 3, type: 'win', amount: 500, game: 'Speed Bingo', date: '2025-11-10 08:45' },
    { id: 4, type: 'stake', amount: -50, game: 'Mega Jackpot', date: '2025-11-10 08:30' },
    { id: 5, type: 'deposit', amount: 1000, game: 'Deposit', date: '2025-11-10 08:00' },
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/lobby" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Lobby
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-12 text-gray-800">
          My Account
        </h1>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold mb-4">
                  {user.username.charAt(0)}
                </div>
                <h2 className="text-2xl font-bold text-gray-800">{user.username}</h2>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(user.balance)}</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Games Played:</span>
                  <span className="font-bold text-lg">{user.gamesPlayed}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Games Won:</span>
                  <span className="font-bold text-lg text-green-600">{user.gamesWon}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Win Rate:</span>
                  <span className="font-bold text-lg text-blue-600">{user.winRate}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Total Winnings:</span>
                  <span className="font-bold text-lg text-purple-600">{formatCurrency(user.totalWinnings)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Leaderboard Rank:</span>
                  <span className="font-bold text-lg text-orange-600">#{user.rank}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Level:</span>
                  <span className="font-bold text-lg text-indigo-600">{user.level}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center mb-4">
                  Member since {new Date(user.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/deposit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold text-center transition-all">
                    💰 Deposit
                  </Link>
                  <Link href="/withdraw" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold text-center transition-all">
                    💸 Withdraw
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-gray-800">Transaction History</h3>
              
              <div className="space-y-3">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                        tx.type === 'win' ? 'bg-green-500' :
                        tx.type === 'stake' ? 'bg-red-500' :
                        'bg-blue-500'
                      }`}>
                        {tx.type === 'win' ? '🎉' :
                         tx.type === 'stake' ? '🎮' :
                         '💰'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{tx.game}</p>
                        <p className="text-sm text-gray-500">{tx.date}</p>
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${
                      tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                    </div>
                  </div>
                ))}
              </div>

              {transactions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-xl">No transactions yet</p>
                  <p className="text-sm mt-2">Start playing to see your history!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
