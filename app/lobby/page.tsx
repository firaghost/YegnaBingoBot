"use client"

import Link from 'next/link'
import { useState } from 'react'

export default function LobbyPage() {
  const [isLoggedIn] = useState(false)

  const rooms = [
    { 
      id: 'classic', 
      name: 'Classic Room', 
      players: 124, 
      maxPlayers: 500, 
      prize: '1,000 ETB', 
      stake: '10 ETB', 
      color: 'from-blue-500 to-blue-700',
      status: 'active',
      description: 'Perfect for beginners. Standard pace, great prizes!'
    },
    { 
      id: 'speed', 
      name: 'Speed Bingo', 
      players: 89, 
      maxPlayers: 200, 
      prize: '500 ETB', 
      stake: '5 ETB', 
      color: 'from-green-500 to-green-700',
      status: 'active',
      description: 'Fast-paced action! Numbers called every 2 seconds.'
    },
    { 
      id: 'mega', 
      name: 'Mega Jackpot', 
      players: 256, 
      maxPlayers: 1000, 
      prize: '10,000 ETB', 
      stake: '50 ETB', 
      color: 'from-purple-500 to-purple-700',
      status: 'active',
      description: 'Huge prizes! High stakes, massive rewards.'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-12">
        <Link href="/" className="inline-block mb-8 text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800">
          Select Your Bingo Room
        </h1>

        {!isLoggedIn && (
          <div className="max-w-2xl mx-auto mb-12 bg-blue-50 border-2 border-blue-300 rounded-xl p-8 text-center shadow-lg">
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold mb-3 text-gray-800">
              Log in with Telegram to join the royal bingo experience!
            </h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Welcome! Please log in to join games and win amazing prizes.
            </p>
            <Link href="/login">
              <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md">
                Login with Telegram
              </button>
            </Link>
            <p className="text-sm text-gray-500 mt-6">
              You can browse rooms below
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {rooms.map(room => (
            <div key={room.id} className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all overflow-hidden transform hover:-translate-y-1">
              <div className={`bg-gradient-to-r ${room.color} p-6 text-white`}>
                <h3 className="text-2xl font-bold mb-2">{room.name}</h3>
                <div className="text-sm opacity-90">Entry: {room.stake}</div>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 mb-4">{room.description}</p>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Players:</span>
                  <span className="font-bold text-lg">{room.players}/{room.maxPlayers}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Prize Pool:</span>
                  <span className="font-bold text-lg text-green-600">{room.prize}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${room.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className="text-sm font-medium capitalize">{room.status}</span>
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`bg-gradient-to-r ${room.color} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${(room.players / room.maxPlayers) * 100}%` }}
                  />
                </div>

                <Link href={`/game/${room.id}`}>
                  <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md mt-4 flex items-center justify-center gap-2">
                    <span>Join Room</span>
                    <span>→</span>
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {rooms.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <div className="text-6xl mb-4">🎰</div>
            <p className="text-xl">No rooms available at the moment. Please check back later!</p>
          </div>
        )}
      </div>
    </div>
  )
}
