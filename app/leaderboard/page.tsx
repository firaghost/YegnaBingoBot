"use client"

import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export default function LeaderboardPage() {
  const [leaderboard] = useState([
    { rank: 1, username: 'BingoMaster_999', totalWins: 156, totalWinnings: 450000, gamesPlayed: 523 },
    { rank: 2, username: 'LuckyQueen_777', totalWins: 134, totalWinnings: 380000, gamesPlayed: 487 },
    { rank: 3, username: 'Champion_888', totalWins: 128, totalWinnings: 365000, gamesPlayed: 456 },
    { rank: 4, username: 'StarPlayer_555', totalWins: 112, totalWinnings: 298000, gamesPlayed: 412 },
    { rank: 5, username: 'KingBingo_321', totalWins: 98, totalWinnings: 267000, gamesPlayed: 389 },
    { rank: 6, username: 'ProGamer_456', totalWins: 87, totalWinnings: 234000, gamesPlayed: 356 },
    { rank: 7, username: 'AceWinner_789', totalWins: 76, totalWinnings: 198000, gamesPlayed: 334 },
    { rank: 8, username: 'Phoenix_123', totalWins: 65, totalWinnings: 176000, gamesPlayed: 312 },
    { rank: 9, username: 'Dragon_444', totalWins: 54, totalWinnings: 145000, gamesPlayed: 289 },
    { rank: 10, username: 'Eagle_666', totalWins: 48, totalWinnings: 132000, gamesPlayed: 267 },
  ])

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/lobby" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Lobby
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-4 text-gray-800">
          🏆 Leaderboard
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Top players competing for glory and prizes!
        </p>

        {/* Period Selector */}
        <div className="flex justify-center gap-4 mb-12">
          {['Daily', 'Weekly', 'Monthly', 'All Time'].map((period) => (
            <button
              key={period}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                period === 'All Time'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Table Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="grid grid-cols-12 gap-4 font-bold text-sm md:text-base">
                <div className="col-span-1">Rank</div>
                <div className="col-span-3">Player</div>
                <div className="col-span-2 text-center">Wins</div>
                <div className="col-span-2 text-center">Games</div>
                <div className="col-span-2 text-center">Win Rate</div>
                <div className="col-span-2 text-right">Winnings</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {leaderboard.map((player, index) => (
                <div 
                  key={player.rank}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-4 items-center text-sm md:text-base">
                    <div className="col-span-1">
                      <div className={`text-2xl font-bold ${
                        player.rank === 1 ? 'text-yellow-500' :
                        player.rank === 2 ? 'text-gray-400' :
                        player.rank === 3 ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {getMedalEmoji(player.rank)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          index < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                          'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}>
                          {player.username.charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-800 truncate">{player.username}</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-bold text-green-600">{player.totalWins}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-gray-600">{player.gamesPlayed}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-semibold text-blue-600">
                        {((player.totalWins / player.gamesPlayed) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-bold text-purple-600">{formatCurrency(player.totalWinnings)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-6xl mb-4">🏆</div>
              <p className="text-xl">No leaderboard data yet</p>
              <p className="text-sm mt-2">Be the first to make the list!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
