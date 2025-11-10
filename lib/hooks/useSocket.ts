"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface GameState {
  id: string
  room_id: string
  status: 'waiting' | 'countdown' | 'active' | 'finished'
  countdown_time: number
  players: string[]
  bots: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  stake: number
  prize_pool: number
  winner_id: string | null
  min_players: number
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    // Supabase is always connected
    setConnected(true)

    return () => {
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [channel])

  const joinGame = async (gameId: string, userId: string) => {
    console.log('🎮 Joining game:', gameId, 'User:', userId)

    // Unsubscribe from previous channel if exists
    if (channel) {
      await channel.unsubscribe()
    }

    // Subscribe to game updates
    const gameChannel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          console.log('🔄 Game update:', payload)
          const game = payload.new as any
          
          setGameState({
            id: game.id,
            room_id: game.room_id,
            status: game.status,
            countdown_time: game.countdown_time || 10,
            players: game.players || [],
            bots: game.bots || [],
            called_numbers: game.called_numbers || [],
            latest_number: game.latest_number || null,
            stake: game.stake,
            prize_pool: game.prize_pool,
            winner_id: game.winner_id,
            min_players: game.min_players || 2
          })
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
      })

    setChannel(gameChannel)

    // Fetch initial game state
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (game) {
      setGameState({
        id: game.id,
        room_id: game.room_id,
        status: game.status,
        countdown_time: game.countdown_time || 10,
        players: game.players || [],
        bots: game.bots || [],
        called_numbers: game.called_numbers || [],
        latest_number: game.latest_number || null,
        stake: game.stake,
        prize_pool: game.prize_pool,
        winner_id: game.winner_id,
        min_players: game.min_players || 2
      })
    }
  }

  const leaveGame = async (gameId: string, userId: string) => {
    console.log('👋 Leaving game:', gameId)
    if (channel) {
      await channel.unsubscribe()
      setChannel(null)
    }
    setGameState(null)
  }

  const markNumber = async (gameId: string, userId: string, number: number) => {
    // Numbers are marked locally, no need to broadcast
    console.log('🎯 Marked number:', number)
  }

  const claimBingo = async (gameId: string, userId: string, card: number[][]) => {
    console.log('🎰 Claiming bingo for game:', gameId)
    
    // Call edge function or API to verify and process bingo
    const { data, error } = await supabase.functions.invoke('claim-bingo', {
      body: { gameId, userId, card }
    })

    if (error) {
      console.error('❌ Bingo claim error:', error)
    } else {
      console.log('✅ Bingo claimed:', data)
    }
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
