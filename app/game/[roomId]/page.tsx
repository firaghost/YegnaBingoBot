"use client"

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSocket } from '@/lib/hooks/useSocket'
import { supabase } from '@/lib/supabase'
import { generateBingoCard, checkBingoWin, formatCurrency } from '@/lib/utils'
import { getGameConfig, getConfig } from '@/lib/admin-config'
import { Users, Trophy, Clock, Loader2, LogOut, ArrowLeft, CheckCircle, XCircle, Star, Frown, Volume2, VolumeX } from 'lucide-react'

// Game status as used by UI; backend may also send 'waiting_for_players', which we
// normalize to 'waiting' below so the waiting room view still renders correctly.
type GameStatus = 'waiting' | 'countdown' | 'active' | 'finished'

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDevEnv = process.env.NODE_ENV !== 'production'
  const devModeParam = isDevEnv ? (searchParams.get('devMode') || null) : null
  const devSpectator = devModeParam === 'spectator'
  const devActive = devModeParam === 'active'
  const devWaiting = devModeParam === 'waiting'
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
  const [didUserWin, setDidUserWin] = useState(false)
  const [winAmount, setWinAmount] = useState(0)
  const [winnerName, setWinnerName] = useState('')
  const [findingNewGame, setFindingNewGame] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bingoError, setBingoError] = useState<string | null>(null)
  const [claimingBingo, setClaimingBingo] = useState(false)
  const [gameConfig, setGameConfig] = useState<any>(null)
  const [commissionRate, setCommissionRate] = useState<number>(0.1)
  // Bot profile cache for display (id -> { name, avatar })
  const [botProfiles, setBotProfiles] = useState<Record<string, { name: string; avatar?: string | null }>>({})
  
  // Enhanced waiting room states
  const [inviteToastVisible, setInviteToastVisible] = useState(false)
  const [prizePoolAnimation, setPrizePoolAnimation] = useState(false)
  const [showConnectionError, setShowConnectionError] = useState(false)
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('')
  const cleanupRef = useRef<{ gameId: string; userId: string } | null>(null)
  // Sound toggle and simple audio cache
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const [showSoundPrompt, setShowSoundPrompt] = useState(false)
  const pendingAudioRef = useRef<{ letter: string; number: number } | null>(null)
  const bingoAudioPlayedRef = useRef<boolean>(false)

  // Bases for asset loading (prod may host frontend and socket on different domains)
  const SOCKET_BASE = (process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app').replace(/\/$/, '')
  const ASSETS_BASE = (process.env.NEXT_PUBLIC_ASSETS_BASE_URL || '').replace(/\/$/, '')
  const buildUrl = (key: string, base: string) => base ? `${base}/BINGO_Sound/${key}.mp3` : `/BINGO_Sound/${key}.mp3`
  const BINGO_VOICE_URL = '/AdditionalSounds/Good-Bingo.mp3'

  // Play called number audio using files under /BINGO_Sound (served from public/)
  const playCallAudio = (letter: string, number: number | string) => {
    if (!soundEnabled) {
      console.log(' Sound disabled, skipping audio')
      return
    }
    // Don't play audio if game is finished
    if (gameState?.status === 'finished') {
      console.log(' Game finished, not playing audio')
      return
    }
    const L = String(letter || '').toUpperCase()
    const N = typeof number === 'number' ? number : parseInt(String(number), 10)
    if (!Number.isFinite(N)) {
      console.warn(' Invalid number for audio:', number)
      return
    }
    const key = `${L}${N}`
    const primaryUrl = buildUrl(key, ASSETS_BASE)
    const fallbackUrl = SOCKET_BASE ? buildUrl(key, SOCKET_BASE) : ''
    console.log(' Attempting to play:', key, primaryUrl)
    let audio = audioCacheRef.current.get(key)
    if (!audio) {
      audio = new Audio(primaryUrl)
      audio.preload = 'auto'
      const a = audio
      a.onerror = () => {
        // Try fallback host once if different
        if (fallbackUrl && a.src !== fallbackUrl) {
          console.warn(' Primary URL failed, trying fallback:', fallbackUrl)
          try {
            a.src = fallbackUrl
            a.load()
            a.play().catch((e) => {
              pendingAudioRef.current = { letter: L, number: N }
              setShowSoundPrompt(true)
              console.warn('Audio play blocked or failed (fallback):', e?.message || e)
            })
          } catch (e) {
            console.error(' Fallback audio failed to load:', fallbackUrl, e)
          }
        } else {
          console.error(' Audio failed to load:', a.src)
        }
      }
      audioCacheRef.current.set(key, a)
      audio = a
    }
    try {
      const a = audio
      a.currentTime = 0
      a.play().catch((e) => {
        // Try runtime fallback swap even for cached audio
        if (fallbackUrl && a.src !== fallbackUrl) {
          console.warn(' Primary play failed, trying fallback at runtime:', fallbackUrl)
          try {
            a.src = fallbackUrl
            a.load()
            a.play().catch((e2) => {
              pendingAudioRef.current = { letter: L, number: N }
              setShowSoundPrompt(true)
              console.warn('Audio play blocked or failed (fallback runtime):', e2?.message || e2)
            })
            return
          } catch (eSwap) {
            console.error(' Runtime fallback swap failed:', eSwap)
          }
        }
        // Autoplay might be blocked; show prompt
        pendingAudioRef.current = { letter: L, number: N }
        setShowSoundPrompt(true)
        console.warn('Audio play blocked or failed:', e?.message || e)
      })
    } catch {}
  }

  const enableSoundAndReplay = () => {
    try {
      setSoundEnabled(true)
      const pending = pendingAudioRef.current
      setShowSoundPrompt(false)
      if (pending) {
        playCallAudio(pending.letter, pending.number)
      } else if (gameState?.latest_number) {
        playCallAudio(gameState.latest_number.letter, gameState.latest_number.number)
      }
    } catch {}
  }

  // Load persisted sound preference
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('bingo_sound_enabled') : null
      if (stored != null) setSoundEnabled(stored === 'true')
    } catch {}
  }, [])

  // Resolve bot names when bot IDs change
  useEffect(() => {
    const loadBotProfiles = async () => {
      try {
        const botIds = (gameState?.bots || []).filter(Boolean)
        if (!botIds.length) return
        const { data } = await supabase
          .from('bots')
          .select('id,name,avatar')
          .in('id', botIds)
        if (data && Array.isArray(data)) {
          setBotProfiles((prev) => {
            const next = { ...prev }
            data.forEach((b: any) => {
              next[b.id] = { name: b.name, avatar: b.avatar }
            })
            return next
          })
        }
      } catch {}
    }
    loadBotProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(gameState?.bots || [])])

  // Persist sound preference
  useEffect(() => {
    try { if (typeof window !== 'undefined') localStorage.setItem('bingo_sound_enabled', String(soundEnabled)) } catch {}
  }, [soundEnabled])

  // Listen for preference changes made on other pages (no refresh)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bingo_sound_enabled' && e.newValue != null) {
        setSoundEnabled(e.newValue === 'true')
      }
    }
    const onCustom = (ev: Event) => {
      try {
        const enabled = (ev as CustomEvent)?.detail?.enabled
        if (typeof enabled === 'boolean') setSoundEnabled(enabled)
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('bingo_sound_pref_changed', onCustom as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('bingo_sound_pref_changed', onCustom as EventListener)
    }
  }, [])

  // Play "Bingo" voice when user claims/wins
  const playBingoAudio = () => {
    if (!soundEnabled) return
    const key = 'BINGO_WIN'
    let audio = audioCacheRef.current.get(key)
    if (!audio) {
      audio = new Audio(BINGO_VOICE_URL)
      audio.preload = 'auto'
      audioCacheRef.current.set(key, audio)
    }
    try {
      audio.currentTime = 0
      audio.play().catch(() => {
        // Autoplay might be blocked; show prompt
        setShowSoundPrompt(true)
      })
    } catch {}
  }

  // If autoplay is blocked, enable on first user interaction
  useEffect(() => {
    if (!showSoundPrompt) return
    const onInteract = () => {
      setShowSoundPrompt(false)
      const pending = pendingAudioRef.current
      if (pending) {
        playCallAudio(pending.letter, pending.number)
      } else if (gameState?.latest_number) {
        playCallAudio(gameState.latest_number.letter, gameState.latest_number.number)
      }
    }
    window.addEventListener('pointerdown', onInteract, { once: true } as any)
    return () => window.removeEventListener('pointerdown', onInteract)
  }, [showSoundPrompt, gameState?.latest_number?.number])

  // Listen for number-called events from the socket layer and play audio
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent).detail as any
        if (!detail) return
        const letter = detail.letter
        const number = typeof detail.number === 'number' ? detail.number : parseInt(String(detail.number), 10)
        if (!letter || !Number.isFinite(number)) return
        console.log('🎙️ Socket event received for audio:', letter + number)
        playCallAudio(letter, number)
      } catch (e) {
        console.warn('Failed to handle bingo_number_called event:', e)
      }
    }
    window.addEventListener('bingo_number_called', handler as EventListener)
    return () => {
      window.removeEventListener('bingo_number_called', handler as EventListener)
    }
  }, [playCallAudio])

  // Lucky number selection (purely cosmetic)
  const [luckyNumber, setLuckyNumber] = useState<number | null>(null)
  // Winner pattern fallback (if socket update hasn't brought it yet)
  const [fallbackWinnerCard, setFallbackWinnerCard] = useState<number[][] | null>(null)
  const [fallbackWinnerPattern, setFallbackWinnerPattern] = useState<string | null>(null)

  // Load commission rate from admin config once
  useEffect(() => {
    const loadCommission = async () => {
      try {
        const rate = await getConfig('game_commission_rate')
        const numeric = typeof rate === 'number' ? rate : parseFloat(rate) || 0.1
        setCommissionRate(numeric)
      } catch (e) {
        console.warn('Failed to load commission rate, using default 10%')
      }
    }
    loadCommission()
  }, [])

  // Compute a 5x5 boolean mask for the winning pattern string
  const getPatternMask = (pattern?: string | null): boolean[][] => {
    const mask = Array(5).fill(null).map(() => Array(5).fill(false))
    if (!pattern) return mask
    if (pattern.startsWith('row:')) {
      const i = parseInt(pattern.split(':')[1] || '0')
      if (!isNaN(i) && i >= 0 && i < 5) {
        for (let c = 0; c < 5; c++) mask[i][c] = true
      }
    } else if (pattern.startsWith('column:')) {
      const j = parseInt(pattern.split(':')[1] || '0')
      if (!isNaN(j) && j >= 0 && j < 5) {
        for (let r = 0; r < 5; r++) mask[r][j] = true
      }
    } else if (pattern === 'diag:main') {
      for (let k = 0; k < 5; k++) mask[k][k] = true
    } else if (pattern === 'diag:anti') {
      for (let k = 0; k < 5; k++) mask[k][4 - k] = true
    }
    return mask
  }

  // Fetch winner card/pattern after loss if not present yet
  useEffect(() => {
    const fetchWinnerInfo = async () => {
      if (showLoseDialog && gameId && (!gameState?.winner_card || !gameState?.winner_pattern)) {
        try {
          // First try admin-backed API (bypasses RLS)
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const resp = await fetch('/api/game/winner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId })
              })
              if (resp.ok) {
                const data = await resp.json()
                if (data?.winner_card && !fallbackWinnerCard) setFallbackWinnerCard(data.winner_card as number[][])
                if (data?.winner_pattern && !fallbackWinnerPattern) setFallbackWinnerPattern(data.winner_pattern as string)
                if (data?.winner_pattern) return // success
              }
            } catch {}
            await new Promise(res => setTimeout(res, 500))
          }

          // If still not available, poll DB directly up to 5 times in case server is still writing
          for (let attempt = 0; attempt < 5; attempt++) {
            const { data } = await supabase
              .from('games')
              .select('winner_card,winner_pattern')
              .eq('id', gameId)
              .single()
            if (data) {
              if (data.winner_card && !fallbackWinnerCard) setFallbackWinnerCard(data.winner_card as number[][])
              if (data.winner_pattern && !fallbackWinnerPattern) setFallbackWinnerPattern(data.winner_pattern as string)
            }
            if ((data?.winner_card && data?.winner_pattern)) break
            await new Promise(res => setTimeout(res, 700))
          }
        } catch {}
      }
    }
    fetchWinnerInfo()
  }, [showLoseDialog, gameId, gameState?.winner_card, gameState?.winner_pattern, fallbackWinnerCard, fallbackWinnerPattern])

  // Load and persist lucky number locally
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('bingo_lucky_number') : null
      if (stored) {
        const n = parseInt(stored)
        if (!isNaN(n)) setLuckyNumber(n)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (luckyNumber != null) {
      try { localStorage.setItem('bingo_lucky_number', String(luckyNumber)) } catch {}
    }
  }, [luckyNumber])

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
        const { data: roomsIlike } = await supabase
          .from('rooms')
          .select('*')
          .ilike('id', roomId)
          .limit(1)

        room = roomsIlike?.[0] || null
      }

      if (!room) {
        throw new Error(`Room '${roomId}' not found`)
      }

      if (error) throw error
      setRoomData(room)

      // Create game configuration using room's actual data (commissionRate loaded separately)
      const config = {
        stake: room.stake,
        maxPlayers: room.max_players,
        callInterval: 2000, // 2 seconds between numbers
        prizePool: room.stake * room.max_players,
        commissionRate: commissionRate,
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
    // In dev preview modes, don't auto-join real games
    if (isDevEnv && (devSpectator || devActive || devWaiting)) {
      // Best-effort: load room data for stake display, then stop loading
      if (!roomData) {
        fetchRoomData().finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
      return
    }
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
        const apiBaseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://yegnabingobot-production.up.railway.app'
        
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

          const players = (result.game && Array.isArray(result.game.players)) ? result.game.players as string[] : []
          const isPlayerInGame = players.includes(user.id)

          // If server says spectate but DB game record still lists this user as a player,
          // treat this as a rejoin and attach as a player instead of spectator.
          if (result.action === 'spectate' && isPlayerInGame) {
            console.log('⚠️ API returned spectate but user is in players; rejoining as player')
            await joinGame(result.gameId, user.id)
            console.log('🔌 Rejoin as player completed')
          } else if (result.action === 'spectate') {
            console.log('👁️ Game already active, joining as spectator...')
            await spectateGame(result.gameId, user.username || user.id)
            console.log('👁️ Spectator join completed')
          } else {
            // Normal join / already_joined_active -> join as player
            console.log('🔌 Joining game via socket... (action=', result.action, ')')
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

    // Extract gameId from waitingRoomState if available
    if (isInWaitingRoom && waitingRoomState?.gameId && !gameId) {
      console.log('📌 Setting gameId from waiting room state:', waitingRoomState.gameId)
      setGameId(waitingRoomState.gameId)
    }

    // Stop loading when we successfully join waiting room or become spectator
    if (isInWaitingRoom || isSpectator || gameState) {
      console.log('✅ Successfully connected, stopping loading')
      setLoading(false)
    }
  }, [isInWaitingRoom, waitingRoomState, isSpectator, gameState?.status, connected, gameState, gameId])

  // (Preview card removed) We will show a 10x10 picker grid in waiting room instead

  // Prize pool animation effect
  useEffect(() => {
    if (roomData?.prize_pool) {
      setPrizePoolAnimation(true)
      const timer = setTimeout(() => setPrizePoolAnimation(false), 600)
      return () => clearTimeout(timer)
    }
  }, [roomData?.prize_pool])

  // Handle game over for spectators - auto redirect to waiting room
  useEffect(() => {
    if (isSpectator && gameState?.status === 'finished') {
      console.log('🏁 Game finished, spectator will be redirected to waiting room')
      
      // Wait 3 seconds then redirect to waiting room
      const redirectTimer = setTimeout(() => {
        console.log('🔄 Redirecting spectator to waiting room')
        router.push(`/game/${roomId}`)
      }, 3000)

      return () => clearTimeout(redirectTimer)
    }
  }, [isSpectator, gameState?.status, router, roomId])


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
        // Intentionally do NOT auto-leave on refresh/unload.
        // Rely on explicit leave actions (X/back buttons) so a simple
        // page refresh keeps the player in the active game.
        console.log('beforeunload: skipping automatic /api/game/leave')
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
  const [stakeSource, setStakeSource] = useState<string | null>(null)
  const [stakeMainAmount, setStakeMainAmount] = useState<number | null>(null)
  const [stakeBonusAmount, setStakeBonusAmount] = useState<number | null>(null)
  
  useEffect(() => {
    if (!gameState || !user || !gameId || !roomData) return
    // Do not deduct for spectators
    if (isSpectator) return
    if (stakeDeducted) return // Already deducted

    // Deduct stake when game starts (countdown or active)
    if (gameState.status === 'countdown' || gameState.status === 'active') {
      const deductStake = async () => {
        try {
          // Decide stake source on the client for UX, but server enforces wallet rules.
          const realAvailable = Math.max(0, user.balance || 0)
          const bonusAvailable = Math.max(0, user.bonus_balance || 0)
          let source: 'real' | 'bonus' | null = null

          if (realAvailable >= roomData.stake) {
            source = 'real'
          } else if (bonusAvailable >= roomData.stake) {
            source = 'bonus'
          } else {
            console.error('Insufficient wallet balance to deduct stake:', {
              realAvailable,
              bonusAvailable,
              stake: roomData.stake,
            })
            return
          }

          // Always call the same-origin Next.js API route so wallet RPCs run correctly
          const resp = await fetch('/api/game/confirm-join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId,
              userId: user.id,
              stakeSource: source,
            }),
          })

          if (!resp.ok) {
            const errBody = await resp.text().catch(() => '')
            console.error('Failed to confirm join / deduct stake:', resp.status, errBody)
            return
          }

          setStakeDeducted(true)
          setStakeSource(source)
          console.log('💰 Stake deducted via confirm-join:', roomData.stake, 'source=', source)
        } catch (error) {
          console.error('Error deducting stake:', error)
        }
      }

      deductStake()
    }
  }, [gameState?.status, gameState, user, gameId, roomData, stakeDeducted, isSpectator])

  // Generate bingo card when game becomes active/countdown and none exists yet
  useEffect(() => {
    if (!gameState) return
    if (isSpectator) return
    if (bingoCard.length > 0) return

    if (gameState.status === 'countdown' || gameState.status === 'active') {
      console.log('🎯 Generating bingo card on game start')
      const newCard = generateBingoCard()
      setBingoCard(newCard)

      const initialMarked = Array(5)
        .fill(null)
        .map((_, row) =>
          Array(5)
            .fill(null)
            .map((_, col) => row === 2 && col === 2)
        )
      setMarkedCells(initialMarked)
    }
  }, [gameState?.status, gameState, isSpectator, bingoCard.length])

  // Handle cell click - Manual marking only (no unmarking)
  const handleCellClick = (row: number, col: number) => {
    if (!user) return
    // Spectators cannot interact with the board
    if (isSpectator) return
    
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
    // Spectators cannot claim
    if (isSpectator) {
      setBingoError('You are spectating this game. Join next round to play and claim BINGO.')
      setTimeout(() => setBingoError(null), 3000)
      return
    }
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
          const gross = freshGame.prize_pool
          const net = typeof freshGame.net_prize === 'number' 
            ? freshGame.net_prize 
            : Math.round((gross || 0) * (1 - commissionRate) * 100) / 100
          setWinAmount(net)
          
          const winnerStr = String(freshGame.winner_id)
          const uid = String(user.id)
          const uname = user.username ? String(user.username) : ''
          const tgidStr = user.telegram_id ? String(user.telegram_id) : ''
          const isSelfWinner = !!winnerStr && (winnerStr === uid || winnerStr === uname || winnerStr === tgidStr)

          if (isSelfWinner) {
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
              .then(({ data }: any) => {
                if (data) setWinnerName(data.username)
              })
            
            // Auto-redirect after 8 seconds
            setTimeout(() => {
              router.push(`/game/${roomId}`)
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
    const result = await claimBingo(gameId, user.id, bingoCard, markedCells)
    
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
        
        const gross = freshGame.prize_pool
        const net = typeof freshGame.net_prize === 'number' 
          ? freshGame.net_prize 
          : Math.round((gross || 0) * (1 - commissionRate) * 100) / 100
        setWinAmount(net)
        
        const winnerStr = String(freshGame.winner_id)
        const uid = String(user.id)
        const uname = user.username ? String(user.username) : ''
        const tgidStr = user.telegram_id ? String(user.telegram_id) : ''
        const isSelfWinner = !!winnerStr && (winnerStr === uid || winnerStr === uname || winnerStr === tgidStr)

        if (isSelfWinner) {
          // Somehow we won even though claim failed (race condition)
          console.log('✅ You are the winner!')
          if (!bingoAudioPlayedRef.current) {
            playBingoAudio()
            bingoAudioPlayedRef.current = true
          }
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
            .then(({ data }: any) => {
              if (data) setWinnerName(data.username)
            })
          
          // Auto-redirect after 8 seconds
          setTimeout(() => {
            router.push(`/game/${roomId}`)
          }, 8000)
        }
      } else {
        // Game still active or other error - show error for 3 seconds
        setTimeout(() => setBingoError(null), 3000)
      }
      // Re-enable claim button after handling failure
      setClaimingBingo(false)
    } else {
      console.log('✅ BINGO claimed successfully!')
      // Immediately fetch the updated game state to show dialogs to all players
      try {
        const { data: updatedGame } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()
        
        if (updatedGame && updatedGame.status === 'finished' && updatedGame.winner_id) {
          console.log('🎯 Game finished! Winner:', updatedGame.winner_id)
          
          const gross = updatedGame.prize_pool
          const net = typeof updatedGame.net_prize === 'number' 
          ? updatedGame.net_prize 
          : Math.round((gross || 0) * (1 - commissionRate) * 100) / 100
        setWinAmount(net)
        
        const winnerStr = String(updatedGame.winner_id)
        const uid = String(user.id)
        const uname = user.username ? String(user.username) : ''
        const tgidStr = user.telegram_id ? String(user.telegram_id) : ''
        const isSelfWinner = !!winnerStr && (winnerStr === uid || winnerStr === uname || winnerStr === tgidStr)

        if (isSelfWinner) {
            // Current user won
            console.log('🎉 You won!')
            if (!bingoAudioPlayedRef.current) {
              playBingoAudio()
              bingoAudioPlayedRef.current = true
            }
            setShowWinDialog(true)
          } else {
            // Current user lost
            console.log('😢 You lost. Winner:', updatedGame.winner_id)
            setShowLoseDialog(true)
            
            // Fetch winner name
            supabase
              .from('users')
              .select('username')
              .eq('id', updatedGame.winner_id)
              .single()
              .then(({ data }: any) => {
                if (data) setWinnerName(data.username)
              })
          }
        }
      } catch (error) {
        console.error('Error fetching updated game state:', error)
      }
    }
  }

  // Clear claiming state when game finishes (prevents needing a second click)
  useEffect(() => {
    if (gameState?.status === 'finished') {
      setClaimingBingo(false)
    }
  }, [gameState?.status])

  // When the game finishes, show win/lose dialogs for all players
  useEffect(() => {
    if (!gameState) return
    if (gameState.status !== 'finished') return

    // If there is no winner_id (no-winner game), don't show win/lose dialogs here
    if (!gameState.winner_id) return
    if (!user) return

    try {
      const winnerStr = String(gameState.winner_id)
      const uid = String(user.id)
      const uname = user.username ? String(user.username) : ''
      const tgidStr = user.telegram_id ? String(user.telegram_id) : ''
      const isSelfWinner = !!winnerStr && (winnerStr === uid || winnerStr === uname || winnerStr === tgidStr)

      const gross = gameState.prize_pool
      const net = typeof (gameState as any).net_prize === 'number'
        ? (gameState as any).net_prize as number
        : Math.round((gross || 0) * (1 - commissionRate) * 100) / 100

      if (isSelfWinner) {
        setDidUserWin(true)
        setWinAmount(net)
        setShowLoseDialog(false)
        setShowWinDialog(true)
        if (!bingoAudioPlayedRef.current) {
          playBingoAudio()
          bingoAudioPlayedRef.current = true
        }
      } else {
        setDidUserWin(false)
        setShowWinDialog(false)
        setShowLoseDialog(true)

        // Best-effort: load winner username for display if not already set
        if (!winnerName && typeof gameState.winner_id === 'string') {
          supabase
            .from('users')
            .select('username')
            .eq('id', gameState.winner_id)
            .single()
            .then(({ data }: any) => {
              if (data?.username) setWinnerName(data.username)
            })
            .catch(() => {})
        }
      }
    } catch (e) {}
  }, [gameState, user, commissionRate, winnerName])

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
    const inviteUrl = `https://t.me/BingoXOfficialBot?startapp=room_${roomId}`
    
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
  // and skip this guard entirely in dev preview modes
  if (
    !gameState &&
    !isInWaitingRoom &&
    !isSpectator &&
    !gameId &&
    !(isDevEnv && (devSpectator || devActive || devWaiting))
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-slate-600">Connecting to game...</p>
        </div>
      </div>
    )
  }

  // Dev preview mock game state (only used when devMode is set and no live gameState yet)
  const devMockGameState: any = (isDevEnv && (devSpectator || devActive) && !gameState)
    ? {
        status: 'active',
        players: ['dev-player-1', 'dev-player-2'],
        bots: [],
        called_numbers: Array.from({ length: 25 }, (_, i) => i + 1),
        latest_number: { letter: 'O', number: 64 },
        prize_pool: 170,
        net_prize: 136,
      }
    : null

  const viewGameState = (devMockGameState || gameState) as typeof gameState
  const viewIsSpectator = devSpectator || isSpectator

  // Normalize backend status (e.g. 'waiting_for_players') into the smaller
  // set of UI statuses so our conditions render the correct view.
  const rawStatus = viewGameState?.status as GameStatus | 'waiting_for_players' | undefined
  const gameStatus: GameStatus =
    rawStatus === 'waiting_for_players'
      ? 'waiting'
      : (rawStatus as GameStatus) || 'waiting'
  const calledNumbers = viewGameState?.called_numbers || []
  const latestNumber = viewGameState?.latest_number
  const humanPlayers = viewGameState?.players?.length || 0
  const botPlayers = viewGameState?.bots?.length || 0
  const players = humanPlayers

  // Financial summary for header
  const totalBalance = user ? user.balance + (user.bonus_balance || 0) : 0
  
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
  const currentParticipants = (gameState?.players?.length || 0) + (gameState?.bots?.length || 0) || 1
  const prizePool = currentParticipants * stake
  const netPrizePool = Math.round(prizePool * (1 - commissionRate) * 100) / 100

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={async () => {
              if (gameStatus === 'active' || gameStatus === 'countdown') {
                setShowLeaveDialog(true)
              } else {
                // Explicitly leave the game when clicking X button (same logic as Back to Lobby)
                if (gameId && user?.id) {
                  console.log('🚪 Player explicitly leaving game via X button')
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
                  // Also call the leave API to properly clean up the game from DB
                  if (gameId && user?.id) {
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
                      console.error('Error leaving waiting room game:', error)
                    }
                  }
                }
                router.push('/lobby')
              }
            }} 
            className="text-slate-900 text-2xl hover:text-slate-600 transition-colors"
          >
            ×
          </button>
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-base font-semibold text-slate-900 leading-tight">{getRoomName()}</h1>
            {user && (
              <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                Balance {formatCurrency(totalBalance)}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSoundEnabled((s) => {
                const next = !s
                if (!next) {
                  // On muting, immediately stop all playing audio
                  audioCacheRef.current.forEach((audio) => {
                    try {
                      audio.pause()
                      audio.currentTime = 0
                    } catch {}
                  })
                  console.log('🔇 All audio stopped immediately')
                } else {
                  // On enabling, try replaying pending or the latest number
                  const pending = pendingAudioRef.current
                  if (pending) {
                    playCallAudio(pending.letter, pending.number)
                    setShowSoundPrompt(false)
                  } else if (latestNumber) {
                    playCallAudio(latestNumber.letter, latestNumber.number)
                    setShowSoundPrompt(false)
                  }
                }
                return next
              })
            }}
            aria-label={soundEnabled ? 'Mute calls' : 'Unmute calls'}
            title={soundEnabled ? 'Sound: On' : 'Sound: Off'}
            className="text-slate-900 hover:text-slate-600 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">
        {showSoundPrompt && (
          <div className="fixed bottom-4 left-0 right-0 z-50">
            <div className="max-w-sm mx-auto bg-blue-600 text-white rounded-xl shadow-lg p-3 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Tap to enable game audio</div>
              <button
                onClick={enableSoundAndReplay}
                className="bg-white text-blue-700 text-sm font-semibold px-3 py-1 rounded-lg hover:bg-slate-100"
              >
                Enable
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Waiting Room System - Not for spectators */}
        {!viewIsSpectator && (gameStatus === 'waiting' || gameStatus === 'countdown' || isInWaitingRoom || (gameId && !gameState)) && (
          <div className="space-y-3 animate-in fade-in duration-500">
            
            {/* Invite Toast */}
            {inviteToastVisible && (
              <div className="fixed top-4 left-4 right-4 z-50 animate-in slide-in-from-top">
                <div className="max-w-md mx-auto bg-green-500 text-white rounded-xl p-4 shadow-lg">
                  <p className="text-sm font-medium">Invite link copied to clipboard!</p>
                </div>
              </div>
            )}

            {/* Game Level Header - Compact */}
            <div className={`bg-gradient-to-r ${getGameLevelColor(roomData?.game_level || roomData?.default_level || 'medium')} rounded-lg p-3 text-white shadow-md transition-all duration-500`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  <div>
                    <h2 className="font-bold text-base">{roomData?.name || 'Game Room'}</h2>
                    <p className="text-white/80 text-xs">Stake: {roomData?.stake} ETB • Max: {roomData?.max_players} players</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{(gameState?.players?.length || 0) + (gameState?.bots?.length || 0) || 1}</div>
                  <div className="text-white/80 text-xs">/ {roomData?.max_players || 8}</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, ((gameState?.players?.length || 0) + (gameState?.bots?.length || 0)) / (roomData?.max_players || 8) * 100)}%` }}
                />
              </div>
              
              {/* Status Line */}
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-white/80">
                  {((gameState?.players?.length || 0) + (gameState?.bots?.length || 0)) === (roomData?.max_players || 8) 
                    ? 'Room Full' 
                    : ((gameState?.players?.length || 0) + (gameState?.bots?.length || 0)) >= (roomData?.max_players || 8) * 0.75
                    ? 'Almost Full'
                    : ((gameState?.players?.length || 0) + (gameState?.bots?.length || 0)) >= (roomData?.max_players || 8) * 0.5
                    ? 'Filling Up'
                    : 'Waiting'}
                </span>
                {gameState?.countdown_time && gameState.countdown_time <= 10 && (
                  <span className="font-bold animate-pulse">Starts in {gameState.countdown_time}s</span>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
              <div className="space-y-3">
                {/* Players List with Avatars */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Players ({(gameState?.players?.length || 0) + (gameState?.bots?.length || 0) || waitingRoomState?.currentPlayers || 1}/{roomData?.max_players || 8})</span>
                  </div>

                  {/* Players Display with Avatars */}
                  {(gameState?.players && gameState.players.length > 0) ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(() => {
                        // Create a combined list of all participants (humans + bots)
                        type P = { username: string; isCurrentUser: boolean; playerNumber: number; isBot?: boolean }
                        const allPlayers: P[] = []

                        // Humans first
                        gameState.players.forEach((playerId: string, index: number) => {
                          const isCurrentUser = playerId === user?.id
                          allPlayers.push({
                            username: getDisplayName(playerId, isCurrentUser),
                            isCurrentUser,
                            playerNumber: index + 1
                          })
                        })

                        // Then bots (display with their names, no bot label)
                        const startIndex = allPlayers.length
                        ;(gameState.bots || []).forEach((botId: string, i: number) => {
                          const name = botProfiles[botId]?.name || `Player ${startIndex + i + 1}`
                          allPlayers.push({
                            username: name,
                            isCurrentUser: false,
                            playerNumber: startIndex + i + 1,
                            isBot: true
                          })
                        })

                        return allPlayers.map((player, index) => (
                          <div 
                            key={index} 
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                              player.isCurrentUser 
                                ? 'bg-green-100 text-green-800 border border-green-300' 
                                : 'bg-blue-50 text-slate-700 border border-blue-200'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                              player.isCurrentUser ? 'bg-green-600' : 'bg-indigo-600'
                            }`}>
                              {getRandomEmoji(player.username)}
                            </div>
                            <span>{player.username}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  ) : null}

                  {/* Spectators List */}
                  {waitingRoomState?.spectators && waitingRoomState.spectators.length > 0 && (
                    <div className="border-t pt-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1.5">
                        <Star className="w-3 h-3" />
                        <span>Watching ({waitingRoomState.spectators.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {waitingRoomState.spectators.map((spectator: any, index: number) => (
                          <div key={index} className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium">
                            {spectator.username}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Waiting Status */}
                  {gameStatus === 'countdown' && gameState?.countdown_time && gameState.countdown_time <= 10 ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                      <div className="text-3xl font-bold text-orange-600 animate-pulse">
                        {gameState.countdown_time}s
                      </div>
                      <span className="text-xs font-medium text-orange-700">Get Ready</span>
                    </div>
                  ) : gameState?.countdown_time && gameState.countdown_time > 10 ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                      <div className="text-sm font-medium text-blue-700">
                        Starting in {gameState.countdown_time}s
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
                      <div className="text-xs font-medium text-yellow-700">
                        Waiting for players...
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Prize */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
                    <Trophy className="w-4 h-4" />
                    <span>Derash</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <div className="text-xl font-bold text-emerald-600">
                      {formatCurrency(netPrizePool)}
                    </div>
                  </div>
                </div>

                {/* Lucky Number Picker */}
                <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500" />
                      <span>Lucky Number</span>
                    </div>
                    <button
                      onClick={() => setLuckyNumber(Math.floor(Math.random() * 100) + 1)}
                      className="text-xs px-2 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors"
                    >
                      Random
                    </button>
                  </div>
                  <div className="bg-white rounded p-2 border border-amber-200">
                    <div className="grid grid-cols-10 gap-0.5">
                      {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setLuckyNumber(n)}
                          className={`h-6 text-xs font-bold rounded border transition-all ${
                            luckyNumber === n
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* No modal; picking is done directly on the 10x10 card above */}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={generateInviteLink}
                className="bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors"
              >
                Invite Friend
              </button>
              <button 
                onClick={async () => {
                  if (gameId && user?.id) {
                    try {
                      await fetch('/api/game/leave', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gameId, userId: user.id })
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
                className="bg-slate-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-slate-700 transition-colors"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}

        {/* Spectator Mode - Compact redesign */}
        {viewIsSpectator && (
          <div className="space-y-1.5 animate-in fade-in duration-500 pb-2 bg-gradient-to-b from-white to-slate-50 rounded-lg p-2">
            {/* Compact stats row */}
            <div className="grid grid-cols-5 gap-1.5 text-[10px]">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                <div className="text-blue-700 font-medium">Game ID</div>
                <div className="font-bold text-xs text-blue-900 truncate">
                  {gameId ? String(gameId).slice(0, 6).toUpperCase() : '—'}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                <div className="text-blue-700 font-medium">Players</div>
                <div className="font-bold text-xs text-blue-900">
                  {(viewGameState?.players?.length || 0) + (viewGameState?.bots?.length || 0)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                <div className="text-blue-700 font-medium">Bet</div>
                <div className="font-bold text-xs text-blue-900">
                  {formatCurrency(stake)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                <div className="text-blue-700 font-medium">Derash</div>
                <div className="font-bold text-xs text-blue-900">
                  {formatCurrency(typeof viewGameState?.net_prize === 'number' ? viewGameState.net_prize : netPrizePool)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                <div className="text-blue-700 font-medium">Called</div>
                <div className="font-bold text-xs text-blue-900">
                  {viewGameState?.called_numbers?.length || 0}/75
                </div>
              </div>
            </div>

            {/* Latest number card - at top */}
            <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 rounded-lg p-2 text-white shadow-md">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold opacity-90">Latest</div>
                <div className="flex gap-0.5">
                  {(viewGameState?.called_numbers || []).length > 0 &&
                    [...(viewGameState?.called_numbers || [])]
                      .reverse()
                      .slice(0, 3)
                      .map((num, idx) => {
                        const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O'
                        const colors = ['bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500']
                        const colorIdx = ['B', 'I', 'N', 'G', 'O'].indexOf(letter)
                        return (
                          <div
                            key={idx}
                            className={`${colors[colorIdx]} text-white px-2 py-1 rounded text-xs font-bold`}
                          >
                            {letter}-{num}
                          </div>
                        )
                      })}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-1">
                {latestNumber ? (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 flex items-center justify-center text-lg font-black text-slate-900 shadow-lg border-2 border-yellow-200">
                    {latestNumber.letter}
                    {latestNumber.number}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-400 flex items-center justify-center text-[9px] opacity-70">
                    —
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="text-sm font-semibold mb-0.5">Watching</div>
                <p className="text-xs leading-tight opacity-90">
                  ይህ እይታ ብቻ ነው።
                </p>
              </div>
            </div>

            {/* 75-number board - below latest number */}
            <div className="bg-white border-2 border-slate-200 rounded-lg p-2 shadow-md flex-1">
              <div className="grid grid-cols-5 gap-0 mb-1 border-b-2 border-slate-300 pb-1">
                {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
                  const colors = ['text-red-500', 'text-blue-500', 'text-emerald-500', 'text-amber-500', 'text-purple-500']
                  return (
                    <div key={letter} className={`text-center font-bold text-base ${colors[idx]}`}>
                      {letter}
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-5 gap-0.5">
                {Array.from({ length: 15 }, (_, ri) => ri).map((ri) =>
                  Array.from({ length: 5 }, (_, ci) => ci).map((ci) => {
                    const num = ri + 1 + 15 * ci
                    const isCalled = viewGameState?.called_numbers?.includes(num)
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        className={`
                          h-6 flex items-center justify-center text-xs font-bold
                          border border-slate-300 rounded
                          ${
                            isCalled
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }
                        `}
                      >
                        {num}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => router.push('/lobby')}
                className="bg-red-600 text-white py-1.5 rounded-lg font-semibold text-xs hover:bg-red-700 transition-colors"
              >
                Leave
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-slate-600 text-white py-1.5 rounded-lg font-semibold text-xs hover:bg-slate-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Active Game - Only for players, not spectators */}
        {gameStatus === 'active' && !viewIsSpectator && (
          <div className="min-h-screen bg-white flex flex-col p-4">
            {/* Compact Header Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-slate-100 rounded-lg p-2 text-center">
                <div className="text-slate-600 text-xs font-medium mb-1">Stake</div>
                <div className="text-slate-900 font-bold text-sm">{formatCurrency(stake)}</div>
              </div>
              <div className="bg-slate-100 rounded-lg p-2 text-center">
                <div className="text-slate-600 text-xs font-medium mb-1">Players</div>
                <div className="text-slate-900 font-bold text-sm">{(gameState?.players?.length || 0) + (gameState?.bots?.length || 0)}</div>
              </div>
              <div className="bg-slate-100 rounded-lg p-2 text-center">
                <div className="text-slate-600 text-xs font-medium mb-1">Derash</div>
                <div className="text-emerald-600 font-bold text-sm">{formatCurrency(netPrizePool)}</div>
              </div>
              <div className="bg-slate-100 rounded-lg p-2 text-center">
                <div className="text-slate-600 text-xs font-medium mb-1">Called</div>
                <div className="text-slate-900 font-bold text-sm">{calledNumbers.length}/75</div>
              </div>
            </div>

            {/* Latest Number - Card Style */}
            <div className="bg-white rounded-xl p-3 shadow-md mb-4 border border-slate-200">
              <div className="flex items-center gap-3">
                {latestNumber ? (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-lg ring-4 ring-blue-200 animate-pulse flex-shrink-0">
                    {latestNumber.letter}{latestNumber.number}
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-medium flex-shrink-0">Waiting...</div>
                )}
                <div className="flex flex-col gap-1">
                  <div className="text-slate-700 text-xs font-semibold">Recent:</div>
                  <div className="flex gap-1">
                    {[...calledNumbers].reverse().slice(0, 3).map((num) => {
                      const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O'
                      const colorClass = 
                        letter === 'B' ? 'bg-red-500' :
                        letter === 'I' ? 'bg-blue-500' :
                        letter === 'N' ? 'bg-emerald-500' :
                        letter === 'G' ? 'bg-amber-500' :
                        'bg-purple-500'
                      return (
                        <div key={num} className={`${colorClass} text-white px-2 py-1 rounded text-xs font-bold`}>
                          {letter}{num}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bingo Card - Premium Compact Design */}
            <div className="bg-gradient-to-b from-slate-100 to-slate-200 rounded-2xl p-2 shadow-2xl flex flex-col max-w-sm mx-auto w-full">
              {/* B-I-N-G-O Headers */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {[
                  { letter: 'B', color: 'text-red-400' },
                  { letter: 'I', color: 'text-blue-400' },
                  { letter: 'N', color: 'text-emerald-400' },
                  { letter: 'G', color: 'text-teal-400' },
                  { letter: 'O', color: 'text-cyan-400' }
                ].map(({ letter, color }) => (
                  <div key={letter} className={`${color} text-center font-black text-2xl py-2 drop-shadow-lg`} style={{textShadow: '2px 2px 0px rgba(0,0,0,0.08)'}}>
                    {letter}
                  </div>
                ))}
              </div>

              {/* Bingo Grid - 3D Blocks */}
              <div className="grid grid-cols-5 gap-1">
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
                    const isMarkedVisual = isMarked || (viewIsSpectator && isCalled)
                    const isFree = num === 0

                    return (
                      <button
                        key={`${ri}-${ci}`}
                        onClick={() => handleCellClick(ri, ci)}
                        disabled={viewIsSpectator || (!isCalled && !isFree)}
                        className={`
                          aspect-square flex items-center justify-center font-bold text-base
                          transition-all duration-150 rounded-lg
                          ${isMarkedVisual
                            ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-lg cursor-default active:shadow-md active:translate-y-0.5'
                            : isCalled
                            ? 'bg-white text-slate-800 hover:bg-slate-50 cursor-pointer active:shadow-sm active:translate-y-0.5 shadow-md border-b-2 border-slate-300'
                            : isFree
                            ? 'bg-gradient-to-b from-indigo-400 to-indigo-500 text-white font-black text-xl shadow-md cursor-default border-b-2 border-indigo-600'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
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
              <div className="bg-red-500/20 border border-red-400 rounded-lg p-2 text-center animate-pulse mt-2">
                <p className="text-red-300 font-semibold text-xs">{bingoError}</p>
              </div>
            )}

            {/* BINGO Button - Premium Compact */}
            {!viewIsSpectator && (
              <button
                onClick={handleBingoClick}
                disabled={!markedCells.length || !checkBingoWin(markedCells) || claimingBingo}
                className={`w-full max-w-sm mx-auto py-3 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 mt-3 ${
                  markedCells.length && checkBingoWin(markedCells) && !claimingBingo
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-xl hover:scale-105 active:scale-95 shadow-lg'
                    : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
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
            )}
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

        {/* Game Ended Dialog - For Both Losers and Spectators */}
        {showLoseDialog && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl my-auto">
              {/* Header based on user type */}
              <div className="flex justify-center mb-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isSpectator ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  {isSpectator ? (
                    <Trophy className="w-10 h-10 text-emerald-600" />
                  ) : (
                    <Frown className="w-10 h-10 text-red-500" />
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-bold text-center mb-2 text-slate-900">
                {isSpectator ? 'Game Ended' : 'You Lost This Round'}
              </h2>
              
              {!isSpectator && (
                <p className="text-center text-slate-600 mb-2 text-sm">
                  Stake lost: <span className="font-bold text-red-600">{formatCurrency(stake)}</span>
                </p>
              )}

              {winnerName && (
                <div className="text-center mb-3">
                  <p className="text-slate-600 mb-1 text-xs">
                    {isSpectator ? 'The winner is:' : 'Winner:'}
                  </p>
                  <p className="text-lg font-bold text-amber-600">{winnerName}</p>
                  {winAmount > 0 && (
                    <p className="text-slate-600 mt-1 text-xs">
                      Derash: <span className="font-bold text-emerald-600">{formatCurrency(winAmount)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Winner Pattern Grid */}
              {(() => {
                const displayCard = (gameState?.winner_card as number[][] | undefined) || fallbackWinnerCard
                const displayPattern = (gameState?.winner_pattern as string | undefined) || fallbackWinnerPattern
                const mask = getPatternMask(displayPattern)

                // Case 1: We have the winner's actual card
                if (displayCard && Array.isArray(displayCard) && displayCard.length === 5) {
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-5 max-w-[260px] mx-auto">
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-slate-700">Winning Card</span>
                        {displayPattern && (
                          <span className="text-[10px] text-slate-500">({displayPattern})</span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-0 mb-1 border-b border-amber-300 pb-0.5">
                        {['B','I','N','G','O'].map((h) => (
                          <div key={h} className="text-center font-black text-[11px] text-slate-700">{h}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-5 gap-0">
                        {displayCard.map((row, ri) =>
                          row.map((num, ci) => {
                            const isWinCell = mask[ri]?.[ci]
                            const isFree = num === 0
                            return (
                              <div
                                key={`win-${ri}-${ci}`}
                                className={`h-7 flex items-center justify-center text-[11px] font-bold border-r border-b border-slate-200 ${
                                  ci === 4 ? 'border-r-0' : ''
                                } ${ri === 4 ? 'border-b-0' : ''} ${
                                  isWinCell
                                    ? 'bg-emerald-500 text-white'
                                    : isFree
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-white text-slate-700'
                                }`}
                              >
                                {isFree ? '★' : num}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                }

                // Case 2: Only pattern available -> render mask-only grid (no numbers)
                if (displayPattern) {
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-5 max-w-[260px] mx-auto">
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-slate-700">Winning Pattern</span>
                        <span className="text-[10px] text-slate-500">({displayPattern})</span>
                      </div>
                      <div className="grid grid-cols-5 gap-0 mb-1 border-b border-amber-300 pb-0.5">
                        {['B','I','N','G','O'].map((h) => (
                          <div key={h} className="text-center font-black text-[11px] text-slate-700">{h}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-5 gap-0">
                        {Array.from({ length: 5 }, (_, ri) => ri).map((ri) =>
                          Array.from({ length: 5 }, (_, ci) => ci).map((ci) => {
                            const isWinCell = mask[ri]?.[ci]
                            const isCenter = ri === 2 && ci === 2
                            return (
                              <div
                                key={`mask-${ri}-${ci}`}
                                className={`h-7 flex items-center justify-center text-[11px] font-bold border-r border-b border-slate-200 ${
                                  ci === 4 ? 'border-r-0' : ''
                                } ${ri === 4 ? 'border-b-0' : ''} ${
                                  isWinCell
                                    ? 'bg-emerald-500 text-white'
                                    : isCenter
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-white text-slate-400'
                                }`}
                              >
                                {isCenter ? '★' : ''}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              <p className="text-center text-xs text-slate-500 mb-3">
                {isSpectator ? 'Redirecting in 3 seconds...' : 'Auto-redirecting in 8 seconds...'}
              </p>

              {/* Action Buttons */}
              <div className="space-y-2">
                {!isSpectator && (
                  <button 
                    onClick={() => router.push(`/game/${roomId}`)}
                    className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trophy className="w-4 h-4" />
                    Play Again
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    if (isSpectator) {
                      // Spectator joins next game in same room (valid route)
                      router.push(`/game/${roomId}`)
                    } else {
                      // Loser goes to lobby
                      router.push('/lobby')
                    }
                  }}
                  className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                    isSpectator 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-slate-700 hover:bg-slate-800 text-white'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {isSpectator ? 'Join Next Game' : 'Go to Lobby'}
                </button>
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
                {isSpectator
                  ? 'Are you sure you want to leave?'
                  : gameState?.status === 'waiting' 
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
