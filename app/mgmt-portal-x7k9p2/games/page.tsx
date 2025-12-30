"use client"

import Link from 'next/link'
import { useMemo, useState, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import { AlertTriangle, Eye, Filter, Gamepad2, Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2, Users, X } from 'lucide-react'

type BasicUser = { id: string; username: string }

export default function AdminGamesPage() {
  const [allGames, setAllGames] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useLocalStorage('games_filter', 'all')
  const [searchTerm, setSearchTerm] = useLocalStorage('games_search', '')
  const [currentPage, setCurrentPage] = useLocalStorage('games_page', 1)
  const [pageSize, setPageSize] = useLocalStorage('games_pageSize', 10)
  const [activeTab, setActiveTab] = useLocalStorage<'active' | 'waiting' | 'stuck' | 'completed' | 'rooms'>('games_tab', 'active')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [roomFilter, setRoomFilter] = useLocalStorage('games_room', 'all')
  const [rooms, setRooms] = useState<any[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [manageRoomsOpen, setManageRoomsOpen] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const [roomForm, setRoomForm] = useState({
    id: '',
    name: '',
    stake: '',
    max_players: '',
    description: '',
    default_level: 'medium',
    status: 'active',
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm?: () => void
  }>({ title: '', message: '' })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [createGameOpen, setCreateGameOpen] = useState(false)
  const [createGameRoomId, setCreateGameRoomId] = useState('')
  const [creatingGame, setCreatingGame] = useState(false)
  const isFetchingRef = useRef(false)
  const lastAutoCleanupAtRef = useRef(0)

  useEffect(() => {
    // Load once on mount; further updates are triggered manually via the Refresh button
    fetchGames()
    fetchRooms()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchRooms = async () => {
    try {
      setRoomsLoading(true)
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('stake', { ascending: true })
      if (error) throw error
      setRooms(data || [])
    } catch (e) {
      console.error('Error fetching rooms:', e)
    } finally {
      setRoomsLoading(false)
    }
  }

  const openCreateRoom = () => {
    setEditingRoom(null)
    setRoomForm({
      id: '',
      name: '',
      stake: '',
      max_players: '',
      description: '',
      default_level: 'medium',
      status: 'active',
    })
    setShowRoomModal(true)
  }

  const openCreateGame = () => {
    openCreateRoom()
  }

  const doCreateGame = async () => {
    if (!createGameRoomId) {
      showToast('error', 'Select a room')
      return
    }
    try {
      setCreatingGame(true)
      const room = rooms.find((r) => String(r.id) === String(createGameRoomId))
      if (!room) {
        showToast('error', 'Room not found')
        return
      }
      const stake = Number(room.stake || 0)
      const { error } = await supabase
        .from('games')
        .insert({
          room_id: createGameRoomId,
          status: 'waiting',
          countdown_time: 10,
          players: [],
          bots: [],
          called_numbers: [],
          stake,
          prize_pool: 0,
          started_at: new Date().toISOString(),
        })
      if (error) throw error
      showToast('success', 'Game created')
      setCreateGameOpen(false)
      await fetchGames()
    } catch (e: any) {
      console.error('Failed to create game', e)
      showToast('error', e?.message || 'Failed to create game')
    } finally {
      setCreatingGame(false)
    }
  }

  const openEditRoom = (room: any) => {
    setEditingRoom(room)
    setRoomForm({
      id: String(room?.id || ''),
      name: String(room?.name || ''),
      stake: String(room?.stake ?? ''),
      max_players: String(room?.max_players ?? ''),
      description: String(room?.description || ''),
      default_level: String(room?.default_level || room?.game_level || 'medium'),
      status: String(room?.status || 'active'),
    })
    setShowRoomModal(true)
  }

  const saveRoom = async () => {
    try {
      const payload: any = {
        name: roomForm.name,
        stake: Number(roomForm.stake || 0),
        max_players: Number(roomForm.max_players || 0),
        description: roomForm.description,
        default_level: roomForm.default_level,
        game_level: roomForm.default_level,
        status: roomForm.status || 'active',
      }

      if (editingRoom) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editingRoom.id)
        if (error) throw error
        showToast('success', 'Room updated')
      } else {
        const { error } = await supabase.from('rooms').insert({ ...payload, id: roomForm.id })
        if (error) throw error
        showToast('success', 'Room created')
      }
      setShowRoomModal(false)
      await fetchRooms()
      await fetchGames()
    } catch (e: any) {
      console.error('Failed to save room', e)
      showToast('error', e?.message || 'Failed to save room')
    }
  }

  const toggleRoomStatus = (room: any) => {
    const next = String(room?.status || 'active') === 'active' ? 'inactive' : 'active'
    setConfirmConfig({
      title: next === 'active' ? 'Activate room' : 'Deactivate room',
      message: `Are you sure you want to ${next === 'active' ? 'activate' : 'deactivate'} "${room?.name || room?.id}"?`,
      confirmLabel: next === 'active' ? 'Activate' : 'Deactivate',
      cancelLabel: 'Cancel',
      variant: 'default',
      onConfirm: () => {
        void (async () => {
          try {
            const { error } = await supabase.from('rooms').update({ status: next }).eq('id', room.id)
            if (error) throw error
            showToast('success', `Room ${next === 'active' ? 'activated' : 'deactivated'}`)
            await fetchRooms()
          } catch (e: any) {
            console.error('Failed to toggle room', e)
            showToast('error', e?.message || 'Failed to update room')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const deleteRoom = (room: any) => {
    setConfirmConfig({
      title: 'Delete room',
      message: `Delete "${room?.name || room?.id}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const { error } = await supabase.from('rooms').delete().eq('id', room.id)
            if (error) throw error
            showToast('success', 'Room deleted')
            await fetchRooms()
          } catch (e: any) {
            console.error('Failed to delete room', e)
            showToast('error', e?.message || 'Failed to delete room')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  useEffect(() => {
    filterGames()
    setCurrentPage(1)
  }, [filter, searchTerm, allGames])

  const fetchGames = async () => {
    try {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      const { data, error } = await supabase
        .from('games')
        .select(`
          id, status, created_at, started_at, ended_at, game_status,
          players, called_numbers, winner_id, latest_number, prize_pool, net_prize,
          rooms (id, name, stake, max_players)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      let gamesRaw: any[] = (data || []) as any[]

      // Auto-cleanup: no-progress sessions older than 10 minutes (safe guard: no players)
      try {
        const now = Date.now()
        if (now - lastAutoCleanupAtRef.current > 60_000) {
          lastAutoCleanupAtRef.current = now
          const idsToDelete: string[] = []

          for (const g of gamesRaw) {
            const status = String(g?.status || '')
            if (!['waiting', 'waiting_for_players', 'countdown', 'active'].includes(status)) continue

            const playersArr = Array.isArray(g?.players) ? g.players : []
            const playerCount = playersArr.length
            if (playerCount !== 0) continue

            const calledCount = Array.isArray(g?.called_numbers) ? g.called_numbers.length : 0
            const hasLatest = !!g?.latest_number
            const hasProgress = calledCount > 0 || hasLatest
            if (hasProgress) continue

            const baseMs = g?.started_at
              ? new Date(g.started_at).getTime()
              : g?.created_at
                ? new Date(g.created_at).getTime()
                : NaN
            if (!Number.isFinite(baseMs)) continue

            const minutes = (now - baseMs) / 60000
            if (minutes >= 10) idsToDelete.push(String(g.id))
          }

          if (idsToDelete.length > 0) {
            const { error: delErr } = await supabase.from('games').delete().in('id', idsToDelete)
            if (!delErr) {
              gamesRaw = gamesRaw.filter((g) => !idsToDelete.includes(String(g.id)))
              showToast('success', `Auto-deleted ${idsToDelete.length} stuck session(s) (10m+)`)
            } else {
              console.warn('Auto-cleanup delete failed', delErr)
            }
          }
        }
      } catch (cleanupErr) {
        console.warn('Auto-cleanup error', cleanupErr)
      }

      // Build a unique set of user IDs (first 5 players per game + winners) to fetch once
      const idSet = new Set<string>()
      for (const g of gamesRaw) {
        if (Array.isArray(g.players)) {
          const top5 = g.players.slice(0, 5)
          for (const pid of top5) idSet.add(pid)
        }
        if (g.winner_id) idSet.add(g.winner_id)
      }
      let userMap = new Map<string, any>()
      if (idSet.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, username')
          .in('id', Array.from(idSet))
        if (users) userMap = new Map((users as BasicUser[]).map((u) => [u.id, u]))
      }

      // Build base list used for enrichment below
      const baseList = gamesRaw.map((game: any) => {
        // Use the new game_status column from database
        let displayStatus = game.game_status

        // Fallback detection when game_status missing
        if (!displayStatus) {
          const isCanceled = game.status === 'finished' &&
            (!game.started_at || !game.ended_at) &&
            (!game.players || game.players.length === 0) &&
            (!game.called_numbers || game.called_numbers.length === 0) &&
            !game.winner_id

          const isIncomplete = game.status === 'finished' &&
            game.started_at &&
            game.ended_at &&
            !game.winner_id &&
            game.players &&
            game.players.length > 0

          if (isCanceled) displayStatus = 'finished_canceled'
          else if (isIncomplete) displayStatus = 'finished_no_winner'
          else if (game.status === 'finished' && game.winner_id) displayStatus = 'finished_winner'
          else displayStatus = game.status
        }

        // Safety: hide impossible "active" rows (0 players and no calls/latest) to prevent double-counting in Waiting
        const calledCount = Array.isArray(game.called_numbers) ? game.called_numbers.length : 0
        const playerCount = Array.isArray(game.players) ? game.players.length : 0
        const hasLatest = !!game.latest_number
        const impossibleActive = (game.status === 'active') && (playerCount === 0) && (calledCount === 0) && !hasLatest
        if (impossibleActive) return null

        // Hide empty waiting rows (0 players) to avoid showing phantom waiting games
        if (game.status === 'waiting' && playerCount === 0) return null

        // Remove empty canceled games from the UI (never started, no players, no calls)
        const shouldHide = game.status === 'finished' &&
          (!game.started_at || !game.ended_at) &&
          (!game.players || game.players.length === 0) &&
          (!game.called_numbers || game.called_numbers.length === 0) &&
          !game.winner_id
        if (shouldHide) return null

        return {
          ...game,
          player_count: playerCount,
          player_details: [],
          winner_info: null,
          display_status: displayStatus,
          net_prize: game.net_prize || 0,
        }
      }).filter(Boolean) as any[]

      // Second pass: enrich with usernames (non-blocking)
      const gamesWithDetails = baseList.map((game: any) => {
        const playerDetails = (Array.isArray(game.players) ? game.players : [])
          .slice(0, 5)
          .map((id: string) => userMap.get(id))
          .filter(Boolean)
        const winnerInfo = game.winner_id ? userMap.get(game.winner_id) || null : null
        return { ...game, player_details: playerDetails, winner_info: winnerInfo }
      })
      // Third pass: compute wallet mix (Cash / Bonus / Mixed) using prize pool composition
      const gamesWithWallet = await Promise.all(
        gamesWithDetails.map(async (game: any) => {
          let wallet_source: 'cash' | 'bonus' | 'mixed' | null = null
          try {
            const [{ data: realPoolData, error: realErr }, { data: bonusPoolData, error: bonusErr }] = await Promise.all([
              supabase.rpc('compute_real_prize_pool', { p_game_id: game.id }).then((res: any) => ({ data: res.data, error: res.error })),
              supabase.rpc('compute_bonus_prize_pool', { p_game_id: game.id }).then((res: any) => ({ data: res.data, error: res.error })),
            ])
            const realPool = !realErr && typeof realPoolData === 'number' ? Number(realPoolData) : 0
            const bonusPool = !bonusErr && typeof bonusPoolData === 'number' ? Number(bonusPoolData) : 0
            if (realPool > 0 && bonusPool === 0) wallet_source = 'cash'
            else if (bonusPool > 0 && realPool === 0) wallet_source = 'bonus'
            else if (realPool > 0 && bonusPool > 0) wallet_source = 'mixed'
          } catch (e) {
            // Soft-fail: leave wallet_source as null
            console.warn('Failed to compute wallet mix for game', game.id, e)
          }
          return { ...game, wallet_source }
        })
      )

      setAllGames(gamesWithWallet)
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  const filterGames = () => {
    let filtered = allGames

    if (filter !== 'all') {
      if (filter === 'finished') {
        filtered = filtered.filter(g => g.display_status === 'finished_winner' || g.display_status === 'finished_no_winner')
      } else if (filter === 'waiting' || filter === 'countdown' || filter === 'active') {
        // Match DB exactly for live states
        filtered = filtered.filter(g => g.status === filter)
        if (filter === 'waiting') {
          filtered = filtered.filter(g => (g.player_count || 0) > 0)
        }
      } else {
        filtered = filtered.filter(g => g.display_status === filter)
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(g =>
        g.rooms?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Deduplicate by id (safety)
    const seen = new Set<string>()
    const unique = filtered.filter((g) => {
      if (seen.has(g.id)) return false
      seen.add(g.id)
      return true
    })

    setGames(unique)
  }

  const totalPages = Math.ceil(games.length / pageSize)
  const paginatedGames = games.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Calculate stats
  const stats = {
    total: allGames.length,
    waiting: allGames.filter(g => g.status === 'waiting' && (g.player_count || 0) > 0).length,
    countdown: allGames.filter(g => g.status === 'countdown').length,
    active: allGames.filter(g => g.status === 'active').length,
    finished: allGames.filter(g => g.display_status === 'finished_winner' || g.display_status === 'finished_no_winner').length,
    totalPrize: allGames.reduce((sum, g) => sum + (g.prize_pool || 0), 0),
    totalPlayers: allGames.reduce((sum, g) => sum + (g.player_count || 0), 0),
  }

  const stuckGames = useMemo(() => {
    const now = Date.now()
    return allGames.filter((g) => {
      const status = String(g?.status || '')
      if (!['waiting', 'waiting_for_players', 'countdown', 'active'].includes(status)) return false

      const calledCount = Array.isArray(g.called_numbers) ? g.called_numbers.length : 0
      const hasLatest = !!g.latest_number
      const hasProgress = calledCount > 0 || hasLatest
      if (hasProgress) return false

      const createdAtMs = g.created_at ? new Date(g.created_at).getTime() : NaN
      const startedAtMs = g.started_at ? new Date(g.started_at).getTime() : NaN
      const base = Number.isFinite(startedAtMs) ? startedAtMs : Number.isFinite(createdAtMs) ? createdAtMs : now

      const minutes = (now - base) / 60000
      // If a game is active but hasn't progressed at all, mark stuck fast (3m)
      if (status === 'active') return minutes >= 3
      // For waiting/countdown with no progress, mark stuck after 5m
      return minutes >= 5
    })
  }, [allGames])

  const activeGames = useMemo(() => {
    return allGames.filter((g) => {
      if (g.status !== 'active') return false
      const pc = Number(g?.player_count || (Array.isArray(g.players) ? g.players.length : 0) || 0)
      if (pc <= 0) return false
      if (!g.started_at) return false
      const calledCount = Array.isArray(g.called_numbers) ? g.called_numbers.length : 0
      const hasLatest = !!g.latest_number
      return calledCount > 0 || hasLatest
    })
  }, [allGames])
  const waitingGames = useMemo(
    () => allGames.filter((g) => g.status === 'waiting' || g.status === 'countdown'),
    [allGames]
  )
  const completedGames = useMemo(
    () => allGames.filter((g) =>
      g.display_status === 'finished_winner' ||
      g.display_status === 'finished_no_winner' ||
      g.status === 'finished' ||
      g.status === 'cancelled'
    ),
    [allGames]
  )

  const tabGames = useMemo(() => {
    if (activeTab === 'active') return activeGames
    if (activeTab === 'waiting') return waitingGames
    if (activeTab === 'stuck') return stuckGames
    return completedGames
  }, [activeGames, waitingGames, stuckGames, completedGames, activeTab])

  const filteredRooms = useMemo(() => {
    const q = String(searchTerm || '').trim().toLowerCase()
    let list = rooms
    if (q) {
      list = list.filter((r: any) => {
        const id = String(r?.id || '').toLowerCase()
        const name = String(r?.name || '').toLowerCase()
        return id.includes(q) || name.includes(q)
      })
    }
    return list
  }, [rooms, searchTerm])

  const handleForceEnd = async (gameId: string) => {
    try {
      const { error: err1 } = await supabase
        .from('games')
        .update({ status: 'finished', ended_at: new Date().toISOString(), game_status: 'finished_no_winner', end_reason: 'admin_force_end' })
        .eq('id', gameId)
      if (err1) {
        await supabase
          .from('games')
          .update({ status: 'finished', ended_at: new Date().toISOString() })
          .eq('id', gameId)
      }
      await fetchGames()
    } catch (e) {
      console.error('Failed to force end game', gameId, e)
    }
  }

  const handleDeleteGame = (gameId: string) => {
    setConfirmConfig({
      title: 'Delete game session',
      message: `Delete game session ${String(gameId).slice(0, 8)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const { error } = await supabase.from('games').delete().eq('id', gameId)
            if (error) throw error
            showToast('success', 'Game session deleted')
            await fetchGames()
          } catch (e: any) {
            console.error('Failed to delete game session', e)
            showToast('error', e?.message || 'Failed to delete game session')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const roomOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; stake: number }>()
    for (const g of allGames) {
      const name = String(g?.rooms?.name || '').trim()
      if (!name) continue
      map.set(name, {
        id: name,
        name,
        stake: Number(g?.rooms?.stake || 0),
      })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allGames])

  const displayedGames = useMemo(() => {
    let list = tabGames

    // Room filter
    if (roomFilter !== 'all') {
      list = list.filter((g: any) => String(g?.rooms?.name || '') === roomFilter)
    }

    // Quick filter (status)
    if (filter !== 'all') {
      if (filter === 'finished') {
        list = list.filter((g: any) =>
          g.display_status === 'finished_winner' ||
          g.display_status === 'finished_no_winner' ||
          g.status === 'finished' ||
          g.status === 'cancelled'
        )
      } else if (filter === 'waiting' || filter === 'countdown' || filter === 'active') {
        list = list.filter((g: any) => g.status === filter)
      }
    }

    // Search
    const q = String(searchTerm || '').trim().toLowerCase()
    if (q) {
      list = list.filter((g: any) => {
        const id = String(g.id || '').toLowerCase()
        const room = String(g?.rooms?.name || '').toLowerCase()
        return id.includes(q) || room.includes(q)
      })
    }

    return list
  }, [tabGames, roomFilter, filter, searchTerm])

  return (
    <AdminShell title="Games">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <AdminConfirmModal
          open={confirmOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={confirmConfig.cancelLabel}
          variant={confirmConfig.variant}
          onConfirm={() => {
            setConfirmOpen(false)
            confirmConfig.onConfirm?.()
          }}
          onCancel={() => setConfirmOpen(false)}
        />

        {toast && (
          <div
            className={
              'fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm font-semibold ' +
              (toast.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                : 'bg-red-500/15 text-red-200 border-red-500/30')
            }
          >
            {toast.message}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl mt-3">Game Operations</h1>
            <p className="mt-1 text-[#A0A0A0]">Monitor live, waiting, and past game sessions in real-time.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#333333] bg-[#252525] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#2f2f2f] transition-colors"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d4af35] px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-[#bfa030] transition-colors"
              onClick={openCreateGame}
            >
              <Plus className="w-4 h-4" />
              Create Game
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0]">Active Games</p>
              <Gamepad2 className="w-5 h-5 text-[#d4af35]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{stats.active}</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0]">Players Online</p>
              <Users className="w-5 h-5 text-[#d4af35]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{stats.totalPlayers}</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#A0A0A0]">Total Volume</p>
              <span className="text-[#d4af35] font-bold">ETB</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{formatCurrency(stats.totalPrize)} ETB</span>
              <span className="text-xs font-medium text-[#A0A0A0]">24h</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#F39C12]/30 bg-[#F39C12]/5 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <AlertTriangle className="w-10 h-10 text-[#F39C12]" />
            </div>
            <div className="flex items-center justify-between relative z-10">
              <p className="text-sm font-medium text-[#F39C12]">Stuck Games</p>
              <AlertTriangle className="w-5 h-5 text-[#F39C12]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 relative z-10">
              <span className="text-2xl font-bold text-white">{stuckGames.length}</span>
              <span className="text-xs font-medium text-[#F39C12]">Needs Action</span>
            </div>
          </div>
        </div>

        <div className="border-b border-[#333333]">
          <nav aria-label="Tabs" className="-mb-px flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={
                activeTab === 'active'
                  ? 'group inline-flex items-center border-b-2 border-[#d4af35] py-4 px-1 text-sm font-bold text-[#d4af35]'
                  : 'group inline-flex items-center border-b-2 border-transparent py-4 px-1 text-sm font-medium text-[#A0A0A0] hover:border-[#A0A0A0] hover:text-white'
              }
            >
              <span className="mr-2 h-2 w-2 rounded-full bg-[#0bda1d]" />
              Active Games
              <span className="ml-3 hidden rounded-full bg-[#d4af35]/20 py-0.5 px-2.5 text-xs font-medium text-[#d4af35] md:inline-block">
                {activeGames.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('waiting')}
              className={
                activeTab === 'waiting'
                  ? 'group inline-flex items-center border-b-2 border-[#d4af35] py-4 px-1 text-sm font-bold text-[#d4af35]'
                  : 'group inline-flex items-center border-b-2 border-transparent py-4 px-1 text-sm font-medium text-[#A0A0A0] hover:border-[#A0A0A0] hover:text-white'
              }
            >
              <span className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
              Waiting Rooms
              <span className="ml-3 hidden rounded-full bg-[#252525] py-0.5 px-2.5 text-xs font-medium text-[#A0A0A0] md:inline-block">
                {waitingGames.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stuck')}
              className={
                activeTab === 'stuck'
                  ? 'group inline-flex items-center border-b-2 border-[#F39C12] py-4 px-1 text-sm font-bold text-[#F39C12]'
                  : 'group inline-flex items-center border-b-2 border-transparent py-4 px-1 text-sm font-medium text-[#A0A0A0] hover:border-[#F39C12] hover:text-[#F39C12]'
              }
            >
              <AlertTriangle className="mr-2 w-4 h-4" />
              Stuck Games
              <span className="ml-3 hidden rounded-full bg-[#F39C12]/20 py-0.5 px-2.5 text-xs font-medium text-[#F39C12] md:inline-block">
                {stuckGames.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={
                activeTab === 'completed'
                  ? 'group inline-flex items-center border-b-2 border-[#d4af35] py-4 px-1 text-sm font-bold text-[#d4af35]'
                  : 'group inline-flex items-center border-b-2 border-transparent py-4 px-1 text-sm font-medium text-[#A0A0A0] hover:border-[#A0A0A0] hover:text-white'
              }
            >
              Completed
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className={
                activeTab === 'rooms'
                  ? 'group inline-flex items-center border-b-2 border-[#d4af35] py-4 px-1 text-sm font-bold text-[#d4af35]'
                  : 'group inline-flex items-center border-b-2 border-transparent py-4 px-1 text-sm font-medium text-[#A0A0A0] hover:border-[#A0A0A0] hover:text-white'
              }
            >
              Rooms
              <span className="ml-3 hidden rounded-full bg-[#252525] py-0.5 px-2.5 text-xs font-medium text-[#A0A0A0] md:inline-block">
                {rooms.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{
            activeTab === 'rooms'
              ? 'Rooms'
              : activeTab === 'completed'
                ? 'Recent Games'
                : 'Live Sessions'
          }</h2>
          {!loading && activeTab !== 'rooms' && (
            <div className="text-xs text-[#A0A0A0]">
              Showing {Math.min(12, displayedGames.length) === 0 ? 0 : 1}-{Math.min(12, displayedGames.length)} of {displayedGames.length}
            </div>
          )}
          {activeTab === 'rooms' && (
            <div className="text-xs text-[#A0A0A0]">Showing {Math.min(12, filteredRooms.length) === 0 ? 0 : 1}-{Math.min(12, filteredRooms.length)} of {filteredRooms.length}</div>
          )}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0A0]" />
            <input
              className="h-9 w-64 rounded-lg border border-[#333333] bg-[#252525] py-2 pl-10 pr-4 text-sm text-white focus:border-[#d4af35] focus:outline-none focus:ring-1 focus:ring-[#d4af35] placeholder-[#A0A0A0]"
              placeholder={activeTab === 'rooms' ? 'Search Room...' : 'Search Game ID...'}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filtersOpen && (
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="w-full sm:w-auto text-sm text-[#A0A0A0]">Quick filter:</div>
              <div className="flex flex-wrap gap-2">
                {['all', 'waiting', 'countdown', 'active', 'finished'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={
                      filter === status
                        ? 'px-3 py-2 rounded-lg bg-[#d4af35]/20 text-[#d4af35] border border-[#d4af35]/30 text-sm font-semibold'
                        : 'px-3 py-2 rounded-lg bg-[#1C1C1C] text-[#A0A0A0] border border-[#333333] hover:bg-[#333] hover:text-white text-sm'
                    }
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#A0A0A0]">Room</span>
                <select
                  className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                >
                  <option value="all">All Rooms</option>
                  {rooms
                    .slice()
                    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                    .map((r) => (
                      <option key={String(r.id)} value={String(r.name)}>
                        {String(r.name)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#A0A0A0]">Search</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0A0]" />
                  <input
                    className="h-10 w-full rounded-lg border border-[#333333] bg-[#1C1C1C] py-2 pl-10 pr-4 text-sm text-white focus:border-[#d4af35] focus:outline-none focus:ring-1 focus:ring-[#d4af35] placeholder-[#A0A0A0]"
                    placeholder="Search by Game ID or Room..."
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-[#A0A0A0]">Need to edit rooms? Manage them here without leaving this page.</div>
              <button
                type="button"
                className="rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
                onClick={() => setManageRoomsOpen(true)}
              >
                Manage Rooms
              </button>
            </div>
          </div>
        )}

        {activeTab === 'rooms' ? (
          roomsLoading ? (
            <div className="rounded-xl border border-[#333333] bg-[#252525] p-10 text-center text-[#A0A0A0]">Loading...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="rounded-xl border border-[#333333] bg-[#252525] p-10 text-center text-[#A0A0A0]">No rooms found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRooms.slice(0, 12).map((room: any) => {
                const isActive = String(room?.status || 'active') === 'active'
                return (
                  <div
                    key={String(room.id)}
                    className="group relative flex flex-col justify-between rounded-xl border border-[#333333] bg-[#252525] p-5 shadow-lg transition-all hover:border-[#d4af35]/50 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium uppercase text-[#A0A0A0] tracking-wider">Room</span>
                        <h3 className="font-mono text-base font-bold text-white">{room.name || room.id}</h3>
                      </div>
                      <span
                        className={
                          'inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ring-1 ring-inset ' +
                          (isActive
                            ? 'bg-[#0bda1d]/15 text-[#0bda1d] ring-[#0bda1d]/20'
                            : 'bg-white/5 text-[#A0A0A0] ring-[#333333]')
                        }
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="my-6 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#A0A0A0]">Stake</span>
                        <span className="text-[#d4af35] font-bold">{formatCurrency(room.stake || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#A0A0A0]">Players</span>
                        <span className="text-white font-medium">{Number(room.current_players || 0)}/{Number(room.max_players || 0) || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#A0A0A0]">Level</span>
                        <span className="text-white font-medium">{room.game_level || room.default_level || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#333333] pt-4">
                      <div className="text-xs text-[#A0A0A0] truncate">ID: {String(room.id)}</div>
                      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-white/10 text-white"
                          title="Edit"
                          onClick={() => openEditRoom(room)}
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-white/10 text-white"
                          title={isActive ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleRoomStatus(room)}
                        >
                          {isActive ? <ToggleRight className="w-5 h-5 text-emerald-300" /> : <ToggleLeft className="w-5 h-5 text-[#A0A0A0]" />}
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-red-500/10 text-red-300"
                          title="Delete"
                          onClick={() => deleteRoom(room)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : loading ? (
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-10 text-center text-[#A0A0A0]">Loading...</div>
        ) : displayedGames.length === 0 ? (
          <div className="rounded-xl border border-[#333333] bg-[#252525] p-10 text-center text-[#A0A0A0]">No games found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedGames.slice(0, 12).map((game: any) => {
              const playerCount = typeof game.player_count === 'number' ? game.player_count : (Array.isArray(game.players) ? game.players.length : 0)
              const maxPlayers = Number(game?.rooms?.max_players || 0)
              const calledCount = Array.isArray(game.called_numbers) ? game.called_numbers.length : 0
              const isStuck = stuckGames.some((g) => g.id === game.id)
              const elapsedMs = (() => {
                if (!game.started_at) return 0
                const s = new Date(game.started_at).getTime()
                if (!Number.isFinite(s)) return 0
                if (game.ended_at) {
                  const e = new Date(game.ended_at).getTime()
                  if (Number.isFinite(e)) return Math.max(0, e - s)
                }
                return Math.max(0, nowTs - s)
              })()
              const elapsedMin = Math.floor(elapsedMs / 60000)
              const elapsedSec = Math.floor((elapsedMs % 60000) / 1000)
              const timerText = game.started_at ? `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}` : '—'
              const statusText = game.status === 'active' ? (calledCount > 0 ? `Live - Round ${Math.max(1, Math.ceil(calledCount / 15))}` : 'Dealing') : game.status === 'waiting' ? 'Waiting' : game.status === 'countdown' ? 'Countdown' : 'Completed'
              const typeLabel = game.wallet_source === 'bonus' ? 'Bonus' : 'Real Money'
              const typeClass = game.wallet_source === 'bonus' ? 'bg-purple-500/20 text-purple-300 ring-purple-500/30' : 'bg-[#d4af35]/20 text-[#d4af35] ring-[#d4af35]/30'
              const borderClass = isStuck ? 'border-[#F39C12]/60' : 'border-[#333333]'

              return (
                <div
                  key={game.id}
                  className={`group relative flex flex-col justify-between rounded-xl border ${borderClass} bg-[#252525] p-5 shadow-lg transition-all hover:border-[#d4af35]/50 hover:shadow-xl hover:-translate-y-1`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase text-[#A0A0A0] tracking-wider">{game.rooms?.name || 'Bingo'}</span>
                      <h3 className="font-mono text-base font-bold text-white">#{String(game.id).slice(0, 8)}</h3>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ring-1 ring-inset ${typeClass}`}>
                      {typeLabel}
                    </span>
                  </div>

                  <div className="my-6 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#A0A0A0]">Status</span>
                      <span className={`flex items-center gap-1.5 font-medium ${isStuck ? 'text-[#F39C12]' : 'text-[#0bda1d]'}`}>{statusText}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#A0A0A0]">Players</span>
                      <span className="text-white font-medium">{playerCount}{maxPlayers > 0 ? `/${maxPlayers}` : ''}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#A0A0A0]">Pot Size</span>
                      <span className="text-[#d4af35] font-bold">{formatCurrency(game.prize_pool || 0)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#333333] pt-4">
                    <div className="flex items-center gap-1 text-sm text-[#A0A0A0]">
                      <span>{timerText}</span>
                    </div>
                    <div className={'flex gap-2 transition-opacity ' + (isStuck ? '' : 'opacity-0 group-hover:opacity-100')}>
                      <Link
                        href={`/mgmt-portal-x7k9p2/games/${game.id}`}
                        className="rounded p-1.5 hover:bg-white/10 text-white"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                      {!isStuck && game.status === 'active' && (
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-[#F39C12]/20 text-[#F39C12]"
                          title="Force End"
                          onClick={() => void handleForceEnd(game.id)}
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </button>
                      )}
                      {isStuck && (
                        <>
                          {game.status === 'active' && (
                            <button
                              type="button"
                              className="rounded px-3 py-1.5 bg-[#F39C12]/15 border border-[#F39C12]/30 text-[#F39C12] text-xs font-bold hover:bg-[#F39C12]/25"
                              title="Force End"
                              onClick={() => void handleForceEnd(game.id)}
                            >
                              Force End
                            </button>
                          )}
                          <Link
                            href={`/mgmt-portal-x7k9p2/games/${game.id}?view=history`}
                            className="rounded px-3 py-1.5 bg-white/5 border border-[#333333] text-white text-xs font-bold hover:bg-white/10"
                            title="Logs"
                          >
                            Logs
                          </Link>
                          <button
                            type="button"
                            className="rounded px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-200 text-xs font-bold hover:bg-red-500/20"
                            title="Delete Session"
                            onClick={() => handleDeleteGame(game.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showRoomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-xl border border-[#333333] bg-[#252525] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#333333] px-5 py-4">
                <div>
                  <div className="text-lg font-bold text-white">{editingRoom ? 'Edit Room' : 'Create Room'}</div>
                  <div className="text-xs text-[#A0A0A0]">Manage room settings directly from Game Operations.</div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 hover:bg-white/10 text-[#A0A0A0] hover:text-white"
                  onClick={() => setShowRoomModal(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#A0A0A0]">Room ID</span>
                  <input
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.id}
                    disabled={!!editingRoom}
                    onChange={(e) => setRoomForm((p) => ({ ...p, id: e.target.value }))}
                    placeholder="e.g. room_10"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#A0A0A0]">Name</span>
                  <input
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.name}
                    onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Room name"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#A0A0A0]">Stake (ETB)</span>
                  <input
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.stake}
                    onChange={(e) => setRoomForm((p) => ({ ...p, stake: e.target.value }))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#A0A0A0]">Max Players</span>
                  <input
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.max_players}
                    onChange={(e) => setRoomForm((p) => ({ ...p, max_players: e.target.value }))}
                    placeholder="e.g. 100"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs text-[#A0A0A0]">Description</span>
                  <input
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.description}
                    onChange={(e) => setRoomForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#A0A0A0]">Level</span>
                  <select
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.default_level}
                    onChange={(e) => setRoomForm((p) => ({ ...p, default_level: e.target.value }))}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#A0A0A0]">Status</span>
                  <select
                    className="h-10 rounded-lg border border-[#333333] bg-[#1C1C1C] px-3 text-sm text-white"
                    value={roomForm.status}
                    onChange={(e) => setRoomForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#333333] px-5 py-4">
                <button
                  type="button"
                  className="rounded-lg border border-[#333333] bg-[#1C1C1C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
                  onClick={() => setShowRoomModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#d4af35] px-4 py-2 text-sm font-bold text-black hover:bg-[#bfa030]"
                  onClick={() => void saveRoom()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-[#333333] bg-[#252525] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#333333] px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Recent Games</h3>
            <Link href="/mgmt-portal-x7k9p2/games" className="text-sm font-medium text-[#d4af35] hover:text-[#bfa030]">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#A0A0A0]">
              <thead className="bg-[#1f1f1f] text-xs uppercase text-[#A0A0A0]">
                <tr>
                  <th className="px-6 py-3 font-medium" scope="col">Game ID</th>
                  <th className="px-6 py-3 font-medium" scope="col">Room</th>
                  <th className="px-6 py-3 font-medium" scope="col">Winner</th>
                  <th className="px-6 py-3 font-medium" scope="col">Amount</th>
                  <th className="px-6 py-3 font-medium" scope="col">Time Ended</th>
                  <th className="px-6 py-3 font-medium" scope="col">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333333]">
                {completedGames.slice(0, 30).map((g: any) => (
                  <tr key={g.id} className="hover:bg-white/5">
                    <td className="whitespace-nowrap px-6 py-4 font-mono font-medium text-white">#{String(g.id).slice(0, 8)}</td>
                    <td className="px-6 py-4">{g.rooms?.name || 'Bingo'}</td>
                    <td className="px-6 py-4">{g.winner_info?.username || '—'}</td>
                    <td className="px-6 py-4 font-medium text-[#0bda1d]">
                      {(() => {
                        const net = Number(g.net_prize || 0)
                        const pool = Number(g.prize_pool || 0)
                        const stake = Number(g.rooms?.stake || 0)
                        const pc = Number(g.player_count || (Array.isArray(g.players) ? g.players.length : 0) || 0)
                        const estimate = stake * pc
                        const amt = net > 0 ? net : pool > 0 ? pool : estimate
                        const label = formatCurrency(amt)
                        return amt > 0 ? `+${label}` : label
                      })()}
                    </td>
                    <td className="px-6 py-4">{g.ended_at ? new Date(g.ended_at).toLocaleString() : '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-green-900/30 px-2 py-1 text-xs font-medium text-green-400">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
