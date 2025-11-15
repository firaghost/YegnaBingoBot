"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface GameState {
  id: string
  room_id: string
  status: 'waiting' | 'waiting_for_players' | 'countdown' | 'active' | 'finished'
  countdown_time: number
  players: string[]
  bots: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  stake: number
  prize_pool: number
  winner_id: string | null
  min_players: number
  commission_rate?: number
  commission_amount?: number
  net_prize?: number
  winner_card?: number[][] | null
  winner_pattern?: string | null
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [waitingRoomState, setWaitingRoomState] = useState<any>(null)
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false)
  const [isSpectator, setIsSpectator] = useState(false)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const lastAnnouncedNumberRef = useRef<number | null>(null)

  const computeLetter = (n: number): 'B' | 'I' | 'N' | 'G' | 'O' =>
    n > 60 ? 'O' : n > 45 ? 'G' : n > 30 ? 'N' : n > 15 ? 'I' : 'B'

  // Connect to Socket.IO server on Railway
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
    console.log('🔌 Connecting to Socket.IO:', socketUrl)
    
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected')
      setConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message)
      setConnected(false)
    })

    // Waiting Room Events
    socket.on('room_assigned', (data) => {
      console.log('🏠 Assigned to waiting room:', data.roomId)
      setIsInWaitingRoom(true)
      setWaitingRoomState(data)
    })

    socket.on('room_update', (data) => {
      console.log('📊 Waiting room update:', data)
      setWaitingRoomState(data)
    })

    socket.on('player_joined', (data) => {
      console.log('👤 Player joined:', data.username)
      setWaitingRoomState((prev: any) => ({
        ...prev,
        players: data.players || [],
        currentPlayers: data.totalPlayers
      }))
    })

    socket.on('player_left', (data) => {
      console.log('👋 Player left:', data.username)
      setWaitingRoomState((prev: any) => ({
        ...prev,
        players: data.players || [],
        currentPlayers: data.totalPlayers
      }))
    })

    socket.on('room_ready_status', (data) => {
      console.log('✅ Ready status update:', data)
      setWaitingRoomState((prev: any) => ({
        ...prev,
        readyCount: data.readyCount,
        totalPlayers: data.totalPlayers
      }))
    })

    socket.on('countdown_start', (data) => {
      console.log('⏰ Countdown started:', data.seconds)
      setWaitingRoomState((prev: any) => ({
        ...prev,
        countdown: data.seconds,
        isCountdownActive: true
      }))
    })

    socket.on('countdown_cancelled', () => {
      console.log('❌ Countdown cancelled')
      setWaitingRoomState((prev: any) => ({
        ...prev,
        countdown: null,
        isCountdownActive: false
      }))
    })

    socket.on('game_starting_in', (data) => {
      console.log('⏰ Game starting in:', data.seconds)
      setWaitingRoomState((prev: any) => ({ ...prev, countdown: data.seconds }))
    })

    socket.on('start_game', (data) => {
      console.log('🎮 Game started via start_game event')
      setIsInWaitingRoom(false)
      
      // Initialize game state for the transition
      setGameState({
        id: data.roomId,
        room_id: data.roomId,
        status: 'active',
        countdown_time: 0,
        players: data.players?.map((p: any) => p.username) || [],
        bots: [],
        called_numbers: [],
        latest_number: null,
        stake: 10,
        prize_pool: 100,
        winner_id: null,
        min_players: 2
      })
      
      console.log('✅ Game state initialized via start_game event')
      
      // Trigger bingo card generation
      window.dispatchEvent(new CustomEvent('gameTransition', { 
        detail: { roomId: data.roomId } 
      }))
    })

    socket.on('transition_to_game', (data) => {
      console.log('🎮 Transitioning to game mode:', data.message)
      setIsInWaitingRoom(false)
      
      // Initialize game state for the transition
      setGameState({
        id: data.roomId,
        room_id: data.roomId,
        status: 'active',
        countdown_time: 0,
        players: [],
        bots: [],
        called_numbers: [],
        latest_number: null,
        stake: 10,
        prize_pool: 100,
        winner_id: null,
        min_players: 2
      })
      
      console.log('✅ Game state initialized, transitioning to game interface')
      
      // Trigger bingo card generation by emitting a custom event
      // The game page will handle this
      window.dispatchEvent(new CustomEvent('gameTransition', { 
        detail: { roomId: data.roomId } 
      }))
    })

    // In-Game Events
    socket.on('game_started', (data) => {
      console.log('🎮 In-game started:', data)
      setGameState(prev => prev ? { ...prev, status: 'active' } : null)
      setIsInWaitingRoom(false)
    })

    socket.on('game_snapshot', (data) => {
      console.log('📸 Game snapshot received:', data)
      setGameState(prev => ({
        ...prev,
        id: data.roomId,
        room_id: data.roomId,
        status: data.status || 'active',
        countdown_time: 0,
        players: data.players?.map((p: any) => p.username) || [],
        // keep previously known bots if snapshot doesn't provide them
        bots: prev?.bots || [],
        called_numbers: data.numbersCalled || [],
        latest_number: data.currentNumber ? {
          letter: data.currentNumber > 60 ? 'O' : data.currentNumber > 45 ? 'G' : data.currentNumber > 30 ? 'N' : data.currentNumber > 15 ? 'I' : 'B',
          number: data.currentNumber
        } : null,
        stake: 10,
        prize_pool: 100,
        winner_id: null,
        min_players: 1
      }))

      // Announce latest number from snapshot if it's new
      try {
        const n = data?.currentNumber
        if (typeof n === 'number' && lastAnnouncedNumberRef.current !== n) {
          lastAnnouncedNumberRef.current = n
          const l = computeLetter(n)
          console.log('🔊 Dispatching bingo_number_called (snapshot):', l + n)
          window.dispatchEvent(new CustomEvent('bingo_number_called', { detail: { number: n, letter: l } }))
        }
      } catch {}
    })

    // New unified game state update (from cache system)
    socket.on('game_state_update', (data) => {
      console.log('⚡ Fast game state update:', data)
      setGameState(prev => prev ? {
        ...prev,
        status: data.status,
        called_numbers: data.called_numbers || prev.called_numbers,
        latest_number: data.latest_number || prev.latest_number,
        countdown_time: data.countdown_time ?? prev.countdown_time,
        prize_pool: data.prize_pool ?? prev.prize_pool,
        winner_id: data.winner_id ?? prev.winner_id
      } : null)

      // If latest number changed, fire immediate event for UI (audio)
      try {
        const ln = data?.latest_number
        let n: number | null = null
        let l: string | null = null
        if (typeof ln === 'number') {
          n = ln
        } else if (ln && typeof ln.number === 'number') {
          n = ln.number
          l = ln.letter ?? null
        }
        if (typeof n === 'number') {
          if (!l) l = computeLetter(n)
          if (lastAnnouncedNumberRef.current !== n) {
            lastAnnouncedNumberRef.current = n
            console.log('🔊 Dispatching bingo_number_called (state_update):', l + n)
            window.dispatchEvent(new CustomEvent('bingo_number_called', { detail: { number: n, letter: l } }))
          }
        }
      } catch {}
    })

    socket.on('number_called', (data) => {
      console.log('📢 Number called:', data.letter + data.number)
      setGameState(prev => prev ? {
        ...prev,
        called_numbers: [...(prev.called_numbers || []), data.number],
        latest_number: { letter: data.letter, number: data.number }
      } : null)

      // Fire a lightweight DOM event so the UI can react instantly (e.g., play audio)
      try {
        console.log('🔊 Dispatching bingo_number_called (number_called):', data.letter + data.number)
        window.dispatchEvent(new CustomEvent('bingo_number_called', { detail: data }))
      } catch {}
    })

    socket.on('bingo_winner', (data) => {
      console.log('🏆 Bingo winner:', data.username, 'pattern:', data.pattern)
      setGameState(prev => prev ? { 
        ...prev, 
        winner_id: data.username, 
        winner_pattern: data.pattern ?? prev.winner_pattern ?? null,
        status: 'finished' 
      } : null)
    })

    socket.on('game_over', (data) => {
      console.log('🏁 Game over:', data)
      setGameState(prev => prev ? { ...prev, status: 'finished', winner_id: data.winner } : null)
    })

    socket.on('game_error', (data) => {
      console.log('❌ Game error:', data.message)
      if (data.canSpectate) {
        console.log('💡 Auto-joining as spectator')
        // Automatically join as spectator if game is in progress
        setTimeout(() => {
          socket.emit('join_spectator', {
            username: 'TestUser_677',
            roomId: data.roomId
          })
        }, 1000)
      }
    })

    socket.on('invalid_claim', (data) => {
      console.log('❌ Invalid bingo claim:', data.reason)
    })

    socket.on('valid_but_late', (data) => {
      console.log('⏰ Valid but late claim:', data.message)
    })

    socket.on('late_claim', (data) => {
      console.log('⏰ Late claim:', data.message)
    })

    socket.on('waiting_for_more_players', (data) => {
      console.log('⏳ Waiting for more players:', data)
      setWaitingRoomState((prev: any) => ({
        ...prev,
        waitingForMore: true,
        currentPlayers: data.currentPlayers,
        minPlayers: data.minPlayers,
        waitingTime: data.waitingTime
      }))
    })

    socket.on('game_full', (data) => {
      console.log('🎮 Game is full, joining as spectator')
      setIsSpectator(true)
      // Auto-spectate when game is full
      setTimeout(() => {
        socket.emit('join_spectator', {
          username: 'Spectator', 
          roomId: data.roomId
        })
      }, 500)
    })

    socket.on('spectator_joined', (data) => {
      console.log('👁️ Spectator joined:', data.username)
    })

    socket.on('bingo_winner', (data) => {
      console.log('🏆 Bingo winner:', data.username)
    })

    socket.on('game_over', (data) => {
      console.log('🏁 Game over:', data)
      setIsInWaitingRoom(false)
      setIsSpectator(false)
    })

    socketRef.current = socket

    return () => {
      console.log('🔌 Cleaning up Socket.IO connection')
      socket.disconnect()
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [])

  const joinGame = useCallback(async (gameId: string, userId: string) => {
    console.log(`🎮 Joining game: ${gameId} User: ${userId}`)
    
    // Join Socket.IO room
    if (socketRef.current) {
      console.log('📡 Emitting join-game to Socket.IO...')
      socketRef.current.emit('join-game', { gameId, userId })
      
      // Listen for game state updates from Socket.IO
      socketRef.current.on('game-state', (state: any) => {
        console.log('📥 Received game-state from Socket.IO:', state.status)
        setGameState({
          id: state.id,
          room_id: state.room_id,
          status: state.status,
          countdown_time: state.countdown_time || 10,
          players: state.players || [],
          bots: state.bots || [],
          called_numbers: state.called_numbers || [],
          latest_number: state.latest_number || null,
          stake: state.stake,
          prize_pool: state.prize_pool,
          winner_id: state.winner_id,
          min_players: state.min_players || 2
        })
      })

      socketRef.current.on('game-won', (data: any) => {
        console.log('🏆 Game won event:', data)
      })
    }

    // Clean up existing channel if any
    if (channelRef.current) {
      console.log('⚠️ Cleaning up existing Supabase channel...')
      await channelRef.current.unsubscribe()
      channelRef.current = null
    }

    // Subscribe to game updates with throttling
    let lastUpdate = 0
    const UPDATE_THROTTLE = 500 // Only update every 500ms max

      const gameChannel = supabase
        .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload: any) => {
          const now = Date.now()
          if (now - lastUpdate < UPDATE_THROTTLE) {
            return // Throttle updates
          }
          lastUpdate = now

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
            min_players: game.min_players || 2,
            commission_rate: game.commission_rate ?? undefined,
            commission_amount: game.commission_amount ?? undefined,
            net_prize: game.net_prize ?? undefined,
            winner_card: game.winner_card || null,
            winner_pattern: game.winner_pattern || null
          })
        }
      )
      .subscribe((status: any) => {
        console.log('📡 Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to game updates')
        }
      })

    channelRef.current = gameChannel
    setChannel(gameChannel)

    // Fetch initial game state
    console.log('📥 Fetching initial game state...')
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (error) {
      console.error('❌ Error fetching game state:', error)
    } else if (game) {
      console.log('✅ Initial game state loaded:', game.status)
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
        min_players: game.min_players || 2,
        commission_rate: game.commission_rate ?? undefined,
        commission_amount: game.commission_amount ?? undefined,
        net_prize: game.net_prize ?? undefined,
        winner_card: game.winner_card || null,
        winner_pattern: game.winner_pattern || null
      })
    } else {
      console.warn('⚠️ No game found with ID:', gameId)
    }
  }, [])

  const leaveGame = async (gameId: string, userId: string) => {
    console.log('👋 Leaving game:', gameId)
    
    // Leave Socket.IO room
    if (socketRef.current) {
      socketRef.current.emit('leave-game', { gameId, userId })
      socketRef.current.off('game-state')
      socketRef.current.off('game-won')
    }
    
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

  // Waiting Room Functions
  const joinWaitingRoom = async (level: 'easy' | 'medium' | 'hard' = 'medium', username: string = 'Player') => {
    console.log(`🏠 Joining waiting room (${level}) as ${username}`)
    if (socketRef.current) {
      socketRef.current.emit('join_waiting_room', {
        username,
        level,
        telegram_id: `user_${Date.now()}`
      })
      setIsInWaitingRoom(true)
      setWaitingRoomState((prev: any) => ({ ...(prev || {}), level, username }))
    }
  }

  const claimBingo = async (gameId: string, userId: string, card: number[][], marked: boolean[][]): Promise<{ success: boolean; error?: string; status?: string }> => {
  console.log('🎰 Claiming bingo for game:', gameId)

  // Compute claimed cells and a simple pattern string (row/column/diagonal)
  const claimedCells: number[] = []
  const isMarked = (i: number, j: number) => (i === 2 && j === 2) ? true : !!(marked?.[i]?.[j])
  try {
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (isMarked(i, j)) claimedCells.push(card?.[i]?.[j])
      }
    }
  } catch {}
  const computePattern = (): string => {
    try {
      // Rows
      for (let i = 0; i < 5; i++) {
        let ok = true
        for (let j = 0; j < 5; j++) if (!isMarked(i, j)) { ok = false; break }
        if (ok) return `row:${i}`
      }
      // Columns
      for (let j = 0; j < 5; j++) {
        let ok = true
        for (let i = 0; i < 5; i++) if (!isMarked(i, j)) { ok = false; break }
        if (ok) return `column:${j}`
      }
      // Diagonals
      if ([0,1,2,3,4].every(k => isMarked(k, k))) return 'diag:main'
      if ([0,1,2,3,4].every(k => isMarked(k, 4-k))) return 'diag:anti'
    } catch {}
    return 'unknown'
  }
  const bingoPattern = computePattern()

  // Emit through Socket.IO for instant broadcast (does not affect DB state)
  try {
    if (socketRef.current) {
      console.log('📡 Emitting bingo_claim via socket for instant broadcast')
      socketRef.current.emit('bingo_claim', {
        username: userId,
        claimedCells,
        bingoPattern,
        board: card
      })
    }
  } catch (e) {
    console.warn('⚠️ Failed to emit bingo_claim via socket:', e)
  }

  // Still call the HTTP API to perform authoritative validation and payouts
  try {
    const response = await fetch('/api/game/claim-bingo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, userId, card, marked })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌bingo claim error:', data.error)
      return {
        success: false,
        error: data.error || 'Failed to claim bingo',
        status: data.status || 'unknown'
      }
    }

    console.log('✅ Bingo claimed:', data)
    return { success: true }
  } catch (error) {
    console.error('❌ Bingo claim error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

  const spectateGame = async (roomId: string, username: string = 'Spectator') => {
    console.log(`👁️ Joining as spectator: ${roomId}`)
    
    if (socketRef.current) {
      socketRef.current.emit('join_spectator', {
        username,
        roomId
      })
    }
  }

  const leaveWaitingRoom = () => {
    console.log('👋 Leaving waiting room')
    
    if (socketRef.current) {
      socketRef.current.emit('leave_waiting_room', {})
      setIsInWaitingRoom(false)
      setWaitingRoomState(null)
    }
  }

  const togglePlayerReady = (username: string, roomId: string) => {
    console.log('✅ Toggling ready status')
    
    if (socketRef.current) {
      socketRef.current.emit('player_ready', {
        username,
        roomId
      })
    }
  }

  return {
    connected,
    gameState,
    waitingRoomState,
    isInWaitingRoom,
    isSpectator,
    joinGame,
    leaveGame,
    markNumber,
    claimBingo,
    joinWaitingRoom,
    spectateGame,
    leaveWaitingRoom,
    togglePlayerReady
  }
}
