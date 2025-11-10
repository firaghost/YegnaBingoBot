"use client"

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export interface GameState {
  id: string
  room_id: string
  status: 'countdown' | 'active' | 'finished'
  countdown_time: number
  players: string[]
  bots: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  stake: number
  prize_pool: number
  winner_id: string | null
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
      setConnected(false)
    })

    socket.on('game-state', (state: GameState) => {
      setGameState(state)
    })

    socket.on('number-called', (data: { letter: string; number: number }) => {
      setGameState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          called_numbers: [...prev.called_numbers, data.number],
          latest_number: data
        }
      })
    })

    socket.on('countdown-update', (time: number) => {
      setGameState(prev => {
        if (!prev) return prev
        return { ...prev, countdown_time: time }
      })
    })

    socket.on('game-started', () => {
      setGameState(prev => {
        if (!prev) return prev
        return { ...prev, status: 'active' }
      })
    })

    socket.on('game-finished', (data: { winner_id: string; prize: number }) => {
      setGameState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'finished',
          winner_id: data.winner_id
        }
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const joinGame = (gameId: string, userId: string) => {
    socketRef.current?.emit('join-game', { gameId, userId })
  }

  const leaveGame = (gameId: string, userId: string) => {
    socketRef.current?.emit('leave-game', { gameId, userId })
  }

  const markNumber = (gameId: string, userId: string, number: number) => {
    socketRef.current?.emit('mark-number', { gameId, userId, number })
  }

  const claimBingo = (gameId: string, userId: string, card: number[][]) => {
    socketRef.current?.emit('claim-bingo', { gameId, userId, card })
  }

  return {
    connected,
    gameState,
    joinGame,
    leaveGame,
    markNumber,
    claimBingo
  }
}
