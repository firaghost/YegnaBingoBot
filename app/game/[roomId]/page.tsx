"use client"

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSocket } from '@/lib/hooks/useSocket'
import { supabase } from '@/lib/supabase'
import { generateBingoCard, checkBingoWin, formatCurrency } from '@/lib/utils'
import { getGameConfig } from '@/lib/admin-config'
import { Users, Trophy, Clock, Loader2, LogOut, ArrowLeft, CheckCircle, XCircle, Star, Frown } from 'lucide-react'

type GameStatus = 'waiting' | 'countdown' | 'active' | 'finished'

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params?.roomId as string
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { 
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
    leaveWaitingRoom
  } = useSocket()

  const [gameId, setGameId] = useState<string | null>(null)
  const [roomData, setRoomData] = useState<any>(null)
  const [bingoCard, setBingoCard] = useState<number[][]>([])
  const [markedCells, setMarkedCells] = useState<boolean[][]>(
    // Initialize with empty 5x5 grid to prevent undefined errors
    Array(5).fill(null).map(() => Array(5).fill(false))
  )
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showWinDialog, setShowWinDialog] = useState(false)
  const [showLoseDialog, setShowLoseDialog] = useState(false)
  const [winAmount, setWinAmount] = useState(0)
  const [winnerName, setWinnerName] = useState('')
  const [findingNewGame, setFindingNewGame] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bingoError, setBingoError] = useState<string | null>(null)
  const [claimingBingo, setClaimingBingo] = useState(false)
  const [gameConfig, setGameConfig] = useState<any>(null)
  
  // Enhanced waiting room states
  const [inviteToastVisible, setInviteToastVisible] = useState(false)
  const [prizePoolAnimation, setPrizePoolAnimation] = useState(false)
  const [showConnectionError, setShowConnectionError] = useState(false)
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('')
  const cleanupRef = useRef<{ gameId: string; userId: string } | null>(null)

  // Fetch room data and game configuration
  const fetchRoomData = async () => {
    try {
      // Try exact match first, then case-insensitive
      let { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()
      
      // If not found, try case-insensitive search
      if (!room && roomId) {
        const { data: rooms } = await supabase
          .from('rooms')
          .select('*')
          .ilike('id', roomId)
          .limit(1)
        
        room = rooms?.[0] || null
      }
      
      if (!room) {
        throw new Error(`Room '${roomId}' not found`)
      }

      if (error) throw error
      setRoomData(room)

      // Create game configuration using room's actual data
      const config = {
        stake: room.stake,
        maxPlayers: room.max_players,
        callInterval: 2000, // 2 seconds between numbers
        prizePool: room.stake * room.max_players,
        commissionRate: 0.1, // 10%
        level: room.game_level || room.default_level || 'medium'
      }
      setGameConfig(config)
      console.log('📋 Game config loaded from room data:', config)

      return room
    } catch (error) {
      console.error('Error fetching room data:', error)
      return null
    }
  }

  // Direct room joining logic - join the specific room that was clicked
  useEffect(() => {
    if (!isAuthenticated || !user || !connected || !roomId) return
    if (gameId || gameState) return // Already in a game

    const joinSpecificRoom = async () => {
      console.log('🎯 Joining specific room:', roomId)
      
      try {
        // Get room data first
        const room = await fetchRoomData()
        if (!room) {
          console.log('❌ Room not found')
          setLoading(false)
          return
        }

        // Check user balance
        const totalBalance = user.balance + (user.bonus_balance || 0)
        if (totalBalance < room.stake) {
          console.log('❌ Insufficient balance')
          setLoading(false)
          return
        }

        // Call the game join API directly for this specific room
        console.log(`🎮 Joining room ${room.name} with stake ${room.stake} ETB`)
        
        // Test if API routes are working on Railway
        const apiBaseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://BingoXbot-production.up.railway.app'
        
        // Remove test API calls - they're working now

        console.log('🔥 About to call API with:', { roomId, userId: user.id })
        const response = await fetch(`${apiBaseUrl}/api/game/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            roomId: roomId,
            userId: user.id
          })
        })
        console.log('🔥 API call completed, status:', response.status)

        let result
        try {
          if (!response.ok) {
            console.error('❌ API call failed:', response.status, response.statusText)
            const errorText = await response.text()
            console.error('❌ Error response:', errorText)
            setLoading(false)
            return
          }
          
          result = await response.json()
          console.log('📡 API Response:', { status: response.status, ok: response.ok, result })
        } catch (parseError) {
          console.error('❌ Failed to parse API response:', parseError)
          try {
            const responseText = await response.text()
            console.log('📡 Raw response text:', responseText)
          } catch (textError) {
            console.error('❌ Could not read response text:', textError)
          }
          setLoading(false)
          return
        }
        
        if (response.ok && result.gameId) {
          console.log('✅ Game joined successfully:', result.gameId)
          setGameId(result.gameId)
          
          // Check if user should spectate
          if (result.action === 'spectate') {
            console.log('👁️ Game already active, joining as spectator...')
            await spectateGame(result.gameId, user.username || user.id)
            console.log('👁️ Spectator join completed')
          } else {
            // Join the game via socket as player
            console.log('🔌 Joining game via socket...')
            await joinGame(result.gameId, user.id)
            console.log('🔌 Socket join completed')
          }
        } else {
          console.error('❌ Failed to join game. Response:', response.status, result)
          console.error('❌ Full error details:', result)
          setLoading(false)
        }
        
      } catch (error) {
        console.error('❌ Error joining room:', error)
        setLoading(false)
      }
    }

    joinSpecificRoom()
  }, [isAuthenticated, user, connected, roomId, gameId, gameState, joinGame])

  // Debug waiting room state and stop loading when connected
  useEffect(() => {
    console.log('🔍 Waiting room state changed:', {
      isInWaitingRoom,
      waitingRoomState,
      isSpectator,
      gameStatus: gameState?.status,
      connected
    })

    // Stop loading when we successfully join waiting room or become spectator
    if (isInWaitingRoom || isSpectator || gameState) {
      console.log('✅ Successfully connected, stopping loading')
      setLoading(false)
    }
  }, [isInWaitingRoom, waitingRoomState, isSpectator, gameState?.status, connected, gameState])

  // Prize pool animation effect
  useEffect(() => {
    if (roomData?.prize_pool) {
      setPrizePoolAnimation(true)
      const timer = setTimeout(() => setPrizePoolAnimation(false), 600)
      return () => clearTimeout(timer)
    }
  }, [roomData?.prize_pool])

  // Handle game over for spectators - auto redirect to new game
  useEffect(() => {
    if (isSpectator && gameState?.status === 'finished') {
      console.log('🏁 Game finished, spectator will be redirected to new game')
      
      // Wait 3 seconds then try to join a new game
      const redirectTimer = setTimeout(() => {
        // Try to join waiting room for new game
        if (user && roomId) {
          console.log('🔄 Redirecting spectator to new game')
          const level = roomData?.default_level || 'medium'
          joinWaitingRoom(level, user.username || 'Player')
        }
      }, 3000)

      return () => clearTimeout(redirectTimer)
    }
  }, [isSpectator, gameState?.status, user, roomId, roomData?.default_level, joinWaitingRoom])


  // Cleanup socket connection on unmount only
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        leaveGame(cleanupRef.current.gameId, cleanupRef.current.userId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add cleanup on page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameId && user?.id) {
        // Use sendBeacon for reliable cleanup on page unload
        const formData = new FormData()
        formData.append('gameId', gameId)
        formData.append('userId', user.id)
        navigator.sendBeacon('/api/game/leave', formData)
      }
    }

    const handleVisibilityChange = () => {
      // Don't cleanup on visibility change - only on actual page unload
      // This prevents removing players when they just switch tabs
      if (document.visibilityState === 'visible' && gameId && user?.id) {
        // Player came back - ensure they're still in the game
        console.log('👀 Player returned to tab, checking game state')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [gameId, user?.id])

  // Safety timeout - if loading takes too long, show error modal
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.error('⚠️ Loading timeout after 15 seconds')
        console.log('Debug - isInWaitingRoom:', isInWaitingRoom, 'isSpectator:', isSpectator, 'gameState:', gameState)
        setLoading(false)
        if (!isInWaitingRoom && !isSpectator && !gameState) {
          setConnectionErrorMessage('Failed to connect to game. The server might be busy or the room might not exist.')
          setShowConnectionError(true)
        }
      }, 15000)

      return () => clearTimeout(timeout)
    }
  }, [loading, isInWaitingRoom, isSpectator, gameState])

  // Deduct stake when game transitions to countdown/active
  const [stakeDeducted, setStakeDeducted] = useState(false)
  
  useEffect(() => {
    if (!gameState || !user || !gameId || !roomData) return
    if (stakeDeducted) return // Already deducted
    
    // Deduct stake when game starts (countdown or active)
    if (gameState.status === 'countdown' || gameState.status === 'active') {
      const deductStake = async () => {
        try {
          // Deduct stake from user balance
          await supabase.rpc('deduct_balance', {
            user_id: user.id,
            amount: roomData.stake
          })

          // Create transaction record
          await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'stake',
            amount: -roomData.stake,
            game_id: gameId,
            status: 'completed'
          })
          
          setStakeDeducted(true)
          console.log('💰 Stake deducted:', roomData.stake)
        } catch (error) {
          console.error('Error deducting stake:', error)
        }
      }
      
      deductStake()
    }
  }, [gameState?.status, user, gameId, roomData, stakeDeducted])

  // Track previous latest number for haptic feedback
  const prevLatestNumberRef = useRef<number | null>(null)

  // Handle game transition and generate bingo card
  useEffect(() => {
    const handleGameTransition = (event: any) => {
      console.log('🎯 Game transition event received, generating bingo card')
      
      // Generate bingo card
      const newCard = generateBingoCard()
      setBingoCard(newCard)
      
      // Initialize marked cells (5x5 grid, center is free space)
      const initialMarked = Array(5).fill(null).map((_, row) => 
        Array(5).fill(null).map((_, col) => row === 2 && col === 2) // Center is always marked
      )
      setMarkedCells(initialMarked)
      
      console.log('✅ Bingo card generated and ready for play')
    }

    window.addEventListener('gameTransition', handleGameTransition)
    return () => window.removeEventListener('gameTransition', handleGameTransition)
  }, [])

  // Generate bingo card when game becomes active (fallback)
  useEffect(() => {
    if (gameState?.status === 'active' && bingoCard.length === 0) {
      console.log('🎯 Game is active but no bingo card - generating now')
      
      // Generate bingo card
      const newCard = generateBingoCard()
      setBingoCard(newCard)
      
      // Initialize marked cells (5x5 grid, center is free space)
      const initialMarked = Array(5).fill(null).map((_, row) => 
        Array(5).fill(null).map((_, col) => row === 2 && col === 2) // Center is always marked
      )
      setMarkedCells(initialMarked)
      
      console.log('✅ Fallback bingo card generated')
    }
  }, [gameState?.status, bingoCard.length])

  // Handle game state updates from Socket.IO
  useEffect(() => {
    if (!gameState) return

    // Haptic feedback when new number is called
    if (gameState.status === 'active' && gameState.latest_number) {
      const currentNumber = gameState.latest_number.number
      if (prevLatestNumberRef.current !== currentNumber) {
        prevLatestNumberRef.current = currentNumber
        
        // Vibrate on mobile when number is called
        if (navigator.vibrate) {
          navigator.vibrate(100) // Vibrate for 100ms
        }
      }
    }

    // Check if game finished
    if (gameState.status === 'finished' && gameState.winner_id) {
      console.log('🏁 Game finished! Winner:', gameState.winner_id)
      
      if (gameState.winner_id === user?.id) {
        // User won
        const prize = gameState.net_prize || gameState.prize_pool
        setWinAmount(prize)
        
        // Note: Auto-win when opponent left
        
        console.log('🎉 You won!', prize)
        setShowWinDialog(true)
      } else {
        // User lost
        const prize = gameState.net_prize || gameState.prize_pool
        setWinAmount(prize)
        setShowLoseDialog(true)
        
        console.log('😢 You lost. Winner:', gameState.winner_id)
        
        // Fetch winner name
        if (gameState.winner_id) {
          supabase
            .from('users')
            .select('username')
            .eq('id', gameState.winner_id)
            .single()
            .then(({ data }) => {
              if (data) {
                console.log('Winner name:', data.username)
                setWinnerName(data.username)
              }
            })
        }
        
        // Auto-redirect after 8 seconds
        setTimeout(() => {
          router.push('/lobby')
        }, 8000)
      }
    }
  }, [gameState?.status, gameState?.winner_id, user, roomId, router])

  // Handle cell click - Manual marking only (no unmarking)
  const handleCellClick = (row: number, col: number) => {
    if (!user) return
    
    // Safety check for markedCells
    if (!markedCells.length || !markedCells[row]) return
    
    const num = bingoCard[row][col]
    if (num === 0) return // Free space (always marked)
    if (!gameState?.called_numbers.includes(num)) return // Not called yet
    if (markedCells[row][col]) return // Already marked - don't allow unmarking
    
    console.log(`🎯 Marking cell [${row},${col}] with number ${num}`)
    
    // Mark the cell (no unmarking allowed)
    const newMarked = markedCells.map(r => [...r])
    newMarked[row][col] = true
    setMarkedCells(newMarked)

    console.log('✅ Cell marked successfully')
  }

  // Handle BINGO button click
  const handleBingoClick = async () => {
    // Prevent multiple simultaneous claims
    if (claimingBingo) return
    
    if (!gameState || gameState.status !== 'active') {
      setBingoError('Game is not active')
      setTimeout(() => setBingoError(null), 3000)
      
      // Refresh game state to check if game ended
      if (gameId && user) {
        const { data: freshGame } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()
        
        if (freshGame && freshGame.status === 'finished' && freshGame.winner_id) {
          // Game already finished - manually trigger win/lose dialog
          const prize = freshGame.net_prize || freshGame.prize_pool
          setWinAmount(prize)
          
          if (freshGame.winner_id === user.id) {
            console.log('🎉 You won!')
            setShowWinDialog(true)
          } else {
            console.log('😢 You lost')
            setShowLoseDialog(true)
            
            // Fetch winner name
            supabase
              .from('users')
              .select('username')
              .eq('id', freshGame.winner_id)
              .single()
              .then(({ data }) => {
                if (data) setWinnerName(data.username)
              })
            
            // Auto-redirect after 8 seconds
            setTimeout(() => {
              router.push('/lobby')
            }, 8000)
          }
        }
      }
      return
    }
    
    if (!gameId || !user) return

    // Check if markedCells is properly initialized
    if (!markedCells.length) {
      setBingoError('Game not ready yet. Please wait...')
      setTimeout(() => setBingoError(null), 3000)
      return
    }

    // Check if user actually has a bingo
    if (!checkBingoWin(markedCells)) {
      setBingoError('Not a valid BINGO! Complete a line, column, or diagonal first!')
      setTimeout(() => setBingoError(null), 3000)
      return
    }

    // Valid bingo - claim it!
    console.log('🎉 Claiming BINGO!')
    setClaimingBingo(true)
    const result = await claimBingo(gameId, user.id, bingoCard)
    setClaimingBingo(false)
    
    // Handle claim result
    if (!result.success) {
      console.log('❌ Claim failed:', result.error)
      
      // Show error to user
      setBingoError(result.error || 'Failed to claim BINGO')
      
      // Refresh game state to check current status
      const { data: freshGame } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()
      
      if (freshGame && freshGame.status === 'finished' && freshGame.winner_id) {
        console.log('🔄 Game already finished. Winner:', freshGame.winner_id)
        
        // Clear error and show game result
        setBingoError(null)
        
        const prize = freshGame.net_prize || freshGame.prize_pool
        setWinAmount(prize)
        
        if (freshGame.winner_id === user.id) {
          // Somehow we won even though claim failed (race condition)
          console.log('✅ You are the winner!')
          setShowWinDialog(true)
        } else {
          // Someone else won
          console.log('😢 Another player won')
          setShowLoseDialog(true)
          
          // Fetch winner name
          supabase
            .from('users')
            .select('username')
            .eq('id', freshGame.winner_id)
            .single()
            .then(({ data }) => {
              if (data) setWinnerName(data.username)
            })
          
          // Auto-redirect after 8 seconds
          setTimeout(() => {
            router.push('/lobby')
          }, 8000)
        }
      } else {
        // Game still active or other error - show error for 3 seconds
        setTimeout(() => setBingoError(null), 3000)
      }
    } else {
      console.log('✅ BINGO claimed successfully!')
      // The useEffect will handle showing the win dialog when game state updates
    }
  }

  // No auto-redirect - removed to let user choose

  const handleFindNewGame = () => {
    setFindingNewGame(true)
    // Reload the page to join a new game
    setTimeout(() => {
      window.location.href = `/game/${roomId}`
    }, 1500)
  }

  const getRoomName = () => {
    console.log('🏠 getRoomName called:', { roomData, roomId })
    return roomData?.name || 'Bingo Room'
  }

  // Helper functions for enhanced waiting room
  const getGameLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'easy': return 'from-green-500 to-green-600'
      case 'medium': return 'from-blue-500 to-blue-600'
      case 'hard': return 'from-red-500 to-red-600'
      default: return 'from-blue-500 to-blue-600'
    }
  }

  const getGameLevelTheme = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'easy': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' }
      case 'medium': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' }
      case 'hard': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' }
      default: return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' }
    }
  }

  const generateInviteLink = () => {
    // Generate Telegram bot mini app link that opens the game room directly
    const inviteUrl = `https://t.me/BingoXOfficialBot/bingox?startapp=room_${roomId}`
    
    // Copy the Telegram bot mini app link (for sharing in Telegram)
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setInviteToastVisible(true)
      setTimeout(() => setInviteToastVisible(false), 3000)
    })
  }


  const getRandomEmoji = (username: string) => {
    const emojis = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎺', '🎸', '🎹', '🎤']
    const index = username.length % emojis.length
    return emojis[index]
  }

  // Function to get proper display name
  const getDisplayName = (userId: string, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      // For current user, prefer first_name > display_name > username (without @) > fallback
      const firstName = user?.first_name?.trim()
      const displayName = user?.display_name?.trim()
      const username = user?.username?.replace('@', '').trim()
      
      return firstName || displayName || username || 'You'
    } else {
      // For other players, generate a friendly name
      const playerNumber = (gameState?.players?.findIndex(p => p === userId) ?? -1) + 1 || 1
      return `Player ${playerNumber}`
    }
  }

  // Function to calculate user level from XP
  const getUserLevel = (xp: number = 0) => {
    if (xp >= 1000) return { name: 'Legend', color: 'text-purple-600', bgColor: 'bg-purple-100' }
    if (xp >= 600) return { name: 'Master', color: 'text-red-600', bgColor: 'bg-red-100' }
    if (xp >= 300) return { name: 'Expert', color: 'text-orange-600', bgColor: 'bg-orange-100' }
    if (xp >= 100) return { name: 'Skilled', color: 'text-blue-600', bgColor: 'bg-blue-100' }
    return { name: 'Beginner', color: 'text-green-600', bgColor: 'bg-green-100' }
  }

  // Generate sequential player numbers
  const getAnonymousName = (username: string, index?: number) => {
    if (index) return `Player ${index}`
    return username || 'Player'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Joining game...</p>
        </div>
      </div>
    )
  }

  if (!roomData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-600">Loading game...</p>
        </div>
      </div>
    )
  }

  // If gameState hasn't loaded yet, show a brief loading state
  // BUT allow waiting room to be shown even without gameState
  if (!gameState && !isInWaitingRoom && !isSpectator && !gameId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-slate-600">Connecting to game...</p>
        </div>
      </div>
    )
  }

  const gameStatus = gameState?.status || 'waiting'
  const calledNumbers = gameState?.called_numbers || []
  const latestNumber = gameState?.latest_number
  const players = gameState?.players?.length || 0
  
  // Debug logging
  console.log('🎮 Game render state:', {
    gameStatus,
    isInWaitingRoom,
    hasGameState: !!gameState,
    players,
    gameId,
    roomData: !!roomData
  })
  const stake = roomData?.stake || 10
  // Calculate FULL prize pool (before commission)
  // Commission is deducted when winner receives the prize
  const currentPlayers = gameState?.players?.length || 1
  const prizePool = currentPlayers * stake

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => {
              if (gameStatus === 'active' || gameStatus === 'countdown') {
                setShowLeaveDialog(true)
              } else {
                router.push('/lobby')
              }
            }} 
            className="text-slate-900 text-2xl hover:text-slate-600 transition-colors"
          >
            ×
          </button>
          <h1 className="text-xl font-bold text-slate-900">{getRoomName()}</h1>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">

        {/* Enhanced Waiting Room System */}
        {(gameStatus === 'waiting' || gameStatus === 'waiting_for_players' || gameStatus === 'countdown' || isInWaitingRoom || (gameId && !gameState)) && (
          <div className="space-y-4 animate-in fade-in duration-500">
            
            {/* Invite Toast */}
            {inviteToastVisible && (
              <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top">
                <div className="max-w-md mx-auto bg-green-500 text-white rounded-xl p-4 shadow-lg">
                  <p className="text-sm font-medium">Invite link copied to clipboard!</p>
                </div>
              </div>
            )}

            {/* Game Level Header */}
            <div className={`bg-gradient-to-r ${getGameLevelColor(roomData?.game_level || roomData?.default_level || 'medium')} rounded-xl p-4 text-white shadow-lg transition-all duration-500`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {roomData?.name || 'Game Room'}
                    </h2>
                    <p className="text-white/80 text-sm">Stake: {roomData?.stake} ETB • Max: {roomData?.max_players} players</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{gameState?.players?.length || 1}</div>
                  <div className="text-white/80 text-sm">/ {roomData?.max_players || 8}</div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${getGameLevelTheme(roomData?.game_level || roomData?.default_level || 'medium').bg}`}>
                  <Users className={`w-5 h-5 ${getGameLevelTheme(roomData?.game_level || roomData?.default_level || 'medium').text}`} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Players & Status</h3>
              </div>
              
              <div className="space-y-4">
                {/* Compact Players List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <Users className="w-4 h-4" />
                      <span>Players ({gameState?.players?.length || waitingRoomState?.currentPlayers || 1}/{roomData?.max_players || 8})</span>
                    </div>
                  </div>

                  {/* Simplified Players Display */}
                  {(gameState?.players && gameState.players.length > 0) ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(() => {
                        // Create a combined list of all players with proper indexing
                        const allPlayers: Array<{username: string, isCurrentUser: boolean, playerNumber: number}> = []
                        
                        // Add all players from gameState
                        gameState.players.forEach((playerId: string, index: number) => {
                          const isCurrentUser = playerId === user?.id
                          allPlayers.push({
                            username: getDisplayName(playerId, isCurrentUser),
                            isCurrentUser: isCurrentUser,
                            playerNumber: index + 1
                          })
                        })
                        
                        return allPlayers.map((player, index) => (
                          <div 
                            key={index} 
                            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
                              player.isCurrentUser 
                                ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs ${
                              player.isCurrentUser ? 'bg-green-600' : 'bg-blue-600'
                            }`}>
                              {getRandomEmoji(player.username)}
                            </div>
                            {player.username}{player.isCurrentUser ? ' (You)' : ''}
                          </div>
                        ))
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">Waiting for players to join...</p>
                    </div>
                  )}

                  {/* Spectators List */}
                  {waitingRoomState?.spectators && waitingRoomState.spectators.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-3">
                        <Star className="w-4 h-4" />
                        <span>Watching ({waitingRoomState.spectators.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {waitingRoomState.spectators.map((spectator: any, index: number) => (
                          <div key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                            {spectator.username}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Compact Waiting Status */}
                  {waitingRoomState?.countdown ? (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <span className="font-medium text-orange-700">Starting in {waitingRoomState.countdown}s</span>
                      </div>
                    </div>
                  ) : waitingRoomState?.waitingForMore ? (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-center gap-2">
                        <Users className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-700">
                          Waiting for more players ({waitingRoomState.currentPlayers}/{waitingRoomState.minPlayers}+ needed)
                        </span>
                      </div>
                      {waitingRoomState.waitingTime && (
                        <div className="text-xs text-green-600 text-center mt-1">
                          Game starts in {waitingRoomState.waitingTime}s if no more players join
                        </div>
                      )}
                    </div>
                  ) : ((waitingRoomState?.currentPlayers || gameState?.players?.length || 0) < 2) ? (
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center justify-center gap-2">
                        <Users className="w-4 h-4 text-yellow-600" />
                        <span className="font-medium text-yellow-700">
                          Waiting for players... ({waitingRoomState?.currentPlayers || gameState?.players?.length || 0}/2)
                        </span>
                      </div>
                    </div>
                  ) : gameStatus === 'waiting_for_players' && gameState?.countdown_time && gameState.countdown_time > 10 ? (
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Clock className="w-6 h-6 text-blue-600 animate-pulse" />
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600 mb-1">
                            {gameState.countdown_time}s
                          </div>
                          <span className="text-sm font-medium text-blue-700">
                            Waiting for more players...
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : gameStatus === 'countdown' && gameState?.countdown_time && gameState.countdown_time <= 10 ? (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-300 rounded-lg p-4">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="text-5xl font-black text-orange-600 animate-pulse">
                          {gameState.countdown_time}
                        </div>
                        <span className="text-lg font-bold text-orange-700">
                          Get Ready!
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={`bg-gradient-to-r border rounded-lg p-3 ${
                      gameStatus === 'countdown' 
                        ? 'from-orange-50 to-yellow-50 border-orange-200' 
                        : gameStatus === 'waiting_for_players'
                        ? 'from-green-50 to-emerald-50 border-green-200'
                        : 'from-blue-50 to-indigo-50 border-blue-200'
                    }`}>
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className={`w-4 h-4 animate-spin ${
                          gameStatus === 'countdown' ? 'text-orange-600' : 
                          gameStatus === 'waiting_for_players' ? 'text-green-600' : 'text-blue-600'
                        }`} />
                        <span className={`font-medium ${
                          gameStatus === 'countdown' ? 'text-orange-700' : 
                          gameStatus === 'waiting_for_players' ? 'text-green-700' : 'text-blue-700'
                        }`}>
                          {gameStatus === 'countdown' 
                            ? `Starting in ${gameState?.countdown_time || 10}s...` 
                            : gameStatus === 'waiting_for_players'
                            ? `Waiting for more players... ${gameState?.countdown_time || 30}s`
                            : 'Waiting for players...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Compact Prize Pool */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <Trophy className="w-4 h-4" />
                      <span>Prize Pool</span>
                    </div>
                  </div>
                  <div className={`bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-3 transition-all duration-500 ${prizePoolAnimation ? 'scale-105 shadow-lg' : ''}`}>
                    <div className="text-2xl font-bold text-emerald-600 transition-all duration-300">
                      {formatCurrency(prizePool)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Invite Friend Button */}
              <button 
                onClick={generateInviteLink}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4" />
                <span>Invite a Friend</span>
              </button>


              {/* Secondary Actions */}
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={async () => {
                    // Explicitly leave the game when clicking back to lobby
                    if (gameId && user?.id) {
                      console.log('🚪 Player explicitly leaving game via Back to Lobby button')
                      try {
                        await fetch('/api/game/leave', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            gameId: gameId,
                            userId: user.id
                          })
                        })
                      } catch (error) {
                        console.error('Error leaving game:', error)
                      }
                    }
                    
                    if (isInWaitingRoom) {
                      leaveWaitingRoom()
                    }
                    router.push('/lobby')
                  }}
                  className="bg-slate-600 text-white py-3 rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Lobby</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Spectator Mode */}
        {isSpectator && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Spectator Header */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Spectator Mode</h2>
                    <p className="text-white/80 text-sm">Watching live game</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">LIVE</div>
                  <div className="text-white/80 text-sm">Game in progress</div>
                </div>
              </div>
            </div>

            {/* Game Progress */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Trophy className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Game Progress</h3>
              </div>

              {gameState && (
                <div className="space-y-6">
                  {/* Game Status */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse"></div>
                      <span className="font-bold text-purple-700">
                        {gameState.status === 'active' ? 'Game Active' : 
                         gameState.status === 'finished' ? 'Game Finished' : 
                         'Game Starting'}
                      </span>
                    </div>
                    {gameState.status === 'finished' && (
                      <p className="text-sm text-purple-600 text-center">
                        Redirecting to new game in 3 seconds...
                      </p>
                    )}
                  </div>

                  {/* Game Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">{gameState.players?.length || 0}</div>
                      <div className="text-sm text-slate-600">Active Players</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {gameState.called_numbers?.length || 0}/75
                      </div>
                      <div className="text-sm text-slate-600">Numbers Called</div>
                    </div>
                  </div>

                  {/* Prize Pool */}
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-4">
                    <div className="text-center">
                      <div className="text-sm text-emerald-600 mb-1">Prize Pool</div>
                      <div className="text-3xl font-bold text-emerald-600">
                        {formatCurrency(gameState.prize_pool)}
                      </div>
                    </div>
                  </div>

                  {/* Latest Number Called */}
                  {gameState.latest_number && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-center">
                        <div className="text-sm text-blue-600 mb-2">Latest Number</div>
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto">
                          {gameState.latest_number.number}
                        </div>
                        <div className="text-lg font-bold text-blue-600 mt-2">
                          {gameState.latest_number.letter}{gameState.latest_number.number}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {gameState.called_numbers && (
                    <div>
                      <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Game Progress</span>
                        <span>{Math.round((gameState.called_numbers.length / 75) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(gameState.called_numbers.length / 75) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
        
              {/* Back to Lobby */}
              <button
                onClick={() => router.push('/lobby')}
                className="w-full bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Lobby
              </button>
            </div>
          </div>
        )}



        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 p-2 rounded text-xs mb-4">
            <div>gameStatus: {gameStatus}</div>
            <div>isInWaitingRoom: {isInWaitingRoom.toString()}</div>
            <div>bingoCard.length: {bingoCard.length}</div>
            <div>gameState: {gameState ? 'exists' : 'null'}</div>
          </div>
        )}

        {/* Active Game */}
        {gameStatus === 'active' && (
          <div className="space-y-3 pb-4">
            {/* Stake & Prize Info - Clean header */}
            <div className="text-center text-sm text-slate-700 font-medium py-2">
              <span>Stake: <span className="font-bold text-amber-600">{formatCurrency(stake)}</span></span>
              <span className="mx-3 text-slate-300">|</span>
              <span>Total Win Pool: <span className="font-bold text-emerald-600">{formatCurrency(prizePool)}</span></span>
            </div>

            {/* Number Called Section - Beautiful card */}
            <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-100">
              <h3 className="text-slate-700 font-bold text-sm mb-3">Latest Number Called</h3>
              
              <div className="flex items-center gap-4">
                {/* Latest Number - Prominent */}
                <div className="flex-shrink-0">
                  {latestNumber ? (
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-xl ring-4 ring-blue-100">
                        {latestNumber.number}
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-medium">
                      Wait...
                    </div>
                  )}
                </div>

                {/* Recent Numbers - Styled badges */}
                <div className="flex-1">
                  <div className="text-slate-600 text-xs font-semibold mb-2">Recent:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...calledNumbers].reverse().slice(1, 5).map((num) => {
                      const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O'
                      const colorClass = 
                        letter === 'B' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                        letter === 'I' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' :
                        letter === 'N' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' :
                        letter === 'G' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                        'bg-purple-100 text-purple-700 ring-1 ring-purple-200'
                      return (
                        <div
                          key={num}
                          className={`${colorClass} px-2 py-1 rounded-lg text-xs font-bold`}
                        >
                          {letter}{num}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bingo Card - Beautiful and Compact */}
            <div className="bg-white rounded-2xl p-3 border-4 border-amber-400 shadow-xl max-w-md mx-auto">
              {/* B-I-N-G-O Headers */}
              <div className="grid grid-cols-5 gap-0 mb-0 border-b-4 border-amber-400 pb-2.5">
                {[
                  { letter: 'B', color: 'text-red-500' },
                  { letter: 'I', color: 'text-blue-500' },
                  { letter: 'N', color: 'text-emerald-500' },
                  { letter: 'G', color: 'text-amber-500' },
                  { letter: 'O', color: 'text-purple-500' }
                ].map(({ letter, color }) => (
                  <div key={letter} className={`text-center font-black text-2xl ${color}`}>
                    {letter}
                  </div>
                ))}
              </div>

              {/* Bingo Grid - Optimized size */}
              <div className="grid grid-cols-5 gap-0 pt-2.5">
                {bingoCard.length === 0 ? (
                  // Loading state for bingo card
                  <div className="col-span-5 text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm text-slate-600">Generating your bingo card...</p>
                  </div>
                ) : (
                  bingoCard.map((row, ri) =>
                    row.map((num, ci) => {
                    const isMarked = markedCells[ri] && markedCells[ri][ci]
                    const isCalled = calledNumbers.includes(num) && num !== 0
                    const isFree = num === 0

                    return (
                      <button
                        key={`${ri}-${ci}`}
                        onClick={() => handleCellClick(ri, ci)}
                        disabled={!isCalled && !isFree}
                        className={`
                          aspect-square flex items-center justify-center text-base font-bold
                          transition-all duration-200 border-r border-b border-slate-200
                          ${ci === 4 ? 'border-r-0' : ''}
                          ${ri === 4 ? 'border-b-0' : ''}
                          ${isMarked
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full m-1 shadow-lg cursor-default'
                            : isCalled
                            ? 'bg-white text-slate-700 rounded-full m-1 ring-2 ring-blue-300 hover:bg-blue-50 cursor-pointer hover:scale-105 active:scale-95'
                            : isFree
                            ? 'bg-slate-100 text-slate-600 rounded-full m-1 cursor-default'
                            : 'bg-white text-slate-400 cursor-not-allowed'
                          }
                        `}
                      >
                        {isFree ? '★' : num}
                      </button>
                    )
                  })
                  )
                )}
              </div>
            </div>

            {/* BINGO Error Message */}
            {bingoError && (
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-2.5 text-center animate-pulse max-w-md mx-auto">
                <p className="text-red-600 font-semibold text-sm">{bingoError}</p>
              </div>
            )}

            {/* BINGO Button - Beautiful */}
            <button
              onClick={handleBingoClick}
              disabled={!markedCells.length || !checkBingoWin(markedCells) || claimingBingo}
              className={`w-full max-w-md mx-auto py-3.5 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                markedCells.length && checkBingoWin(markedCells) && !claimingBingo
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl active:scale-95'
                  : 'bg-slate-400 text-slate-600 cursor-not-allowed opacity-60'
              }`}
            >
              {claimingBingo ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Claiming...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>BINGO!</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Win Dialog */}
        {showWinDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
              {/* Trophy Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center">
                  <Trophy className="w-14 h-14 text-amber-600" />
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-3 text-slate-900">Congratulations!</h2>
              <p className="text-lg mb-6 text-slate-600">
                You've hit the BINGO!
              </p>
              
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-6">
                <p className="text-sm text-slate-600 mb-2">You won:</p>
                <p className="text-4xl font-bold text-green-600">{formatCurrency(winAmount)}</p>
              </div>

              <p className="text-sm text-slate-500 mb-6">
                The winnings have been credited to your account.
              </p>

              <Link href="/lobby">
                <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center gap-2">
                  <ArrowLeft className="w-5 h-5" />
                  Go to Lobby
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Lose Dialog */}
        {showLoseDialog && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
              {/* Close Button */}
              <button
                onClick={() => setShowLoseDialog(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>

              {/* Sad Face Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <Frown className="w-12 h-12 text-red-500" />
                </div>
              </div>

              <h2 className="text-3xl font-bold text-center mb-4 text-slate-900">You Lost This Round</h2>
              
              <p className="text-center text-slate-600 mb-2">
                Stake lost: <span className="font-bold text-red-600">{formatCurrency(stake)}</span>. Better luck next time!
              </p>

              {winnerName && (
                <div className="text-center mb-6">
                  <p className="text-slate-700 mb-1">
                    The winner is: <span className="font-bold text-amber-600">{winnerName}</span>
                  </p>
                  {winAmount > 0 && (
                    <p className="text-slate-700">
                      They won: <span className="font-bold text-emerald-600">{formatCurrency(winAmount)}</span>
                    </p>
                  )}
                </div>
              )}

              <p className="text-center text-sm text-slate-500 mb-6">
                Auto-redirecting in 8 seconds...
              </p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button 
                  onClick={handleFindNewGame}
                  disabled={findingNewGame}
                  className="w-full bg-amber-500 text-white py-4 rounded-xl font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  {findingNewGame ? 'Finding...' : 'Play Again'}
                </button>
                
                <Link href="/lobby" className="block">
                  <button className="w-full bg-slate-700 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Close
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Leave Dialog */}
        {showLeaveDialog && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold text-center mb-4 text-slate-900">Leave Game?</h2>
              <p className="text-center text-slate-600 mb-8">
                {gameState?.status === 'waiting' 
                  ? 'Are you sure you want to leave?' 
                  : `Are you sure you want to leave the current game? You will lose your stake of ${formatCurrency(stake)}.`}
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={async () => {
                    if (gameId && user) {
                      try {
                        await fetch('/api/game/leave', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            gameId, 
                            userId: user.id,
                            gameStatus: gameState?.status,
                            stakeDeducted: stakeDeducted
                          })
                        })
                      } catch (error) {
                        console.error('Error leaving game:', error)
                      }
                    }
                    window.location.href = '/lobby'
                  }}
                  className="w-full bg-amber-500 text-white py-3.5 rounded-xl font-bold hover:bg-amber-600 transition-colors"
                >
                  Leave Game
                </button>
                
                <button 
                  onClick={() => setShowLeaveDialog(false)}
                  className="w-full bg-slate-700 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                  Stay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connection Error Modal */}
        {showConnectionError && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-center mb-4 text-slate-900">Connection Failed</h2>
              
              <p className="text-center text-slate-600 mb-6">
                {connectionErrorMessage}
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setShowConnectionError(false)
                    setLoading(true)
                    // Retry connection
                    window.location.reload()
                  }}
                  className="w-full bg-blue-500 text-white py-3.5 rounded-xl font-bold hover:bg-blue-600 transition-colors"
                >
                  Try Again
                </button>
                
                <button 
                  onClick={() => {
                    setShowConnectionError(false)
                    router.push('/lobby')
                  }}
                  className="w-full bg-slate-600 text-white py-3.5 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
