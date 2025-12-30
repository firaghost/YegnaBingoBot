"use client"

import { useMemo, useState, useEffect, type FormEvent } from 'react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { AdminConfirmModal } from '@/app/components/AdminConfirmModal'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { ArrowLeftRight, Download, Filter, Plus, RefreshCw } from 'lucide-react'

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useLocalStorage('rooms_search', '')
  const [currentPage, setCurrentPage] = useLocalStorage('rooms_page', 1)
  const [pageSize, setPageSize] = useLocalStorage('rooms_pageSize', 10)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [liveGamesByRoom, setLiveGamesByRoom] = useState<Record<string, any>>({})
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [liveStats, setLiveStats] = useState({ activeRooms: 0, playersOnline: 0, totalPotValue: 0, avgGameTimeSeconds: 0 })
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    stake: '',
    max_players: '',
    description: '',
    color: 'from-blue-500 to-blue-700',
    default_level: 'medium'
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

  useEffect(() => {
    fetchRooms()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('stake', { ascending: true })

      if (error) throw error
      setRooms(data || [])
      await fetchLiveGames(data || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLiveGames = async (roomsList: any[]) => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('id, room_id, status, created_at, started_at, stake, players')
        .in('status', ['waiting', 'countdown', 'active'])
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error

      const byRoom: Record<string, any> = {}
      for (const g of data || []) {
        const roomId = String(g.room_id || '')
        if (!roomId) continue
        if (!byRoom[roomId]) byRoom[roomId] = g
      }
      setLiveGamesByRoom(byRoom)

      const activeGames = (data || []).filter((g: any) => g.status === 'active' || g.status === 'countdown' || g.status === 'waiting')
      const activeRoomIds = new Set(activeGames.map((g: any) => String(g.room_id || '')).filter(Boolean))

      const playersOnline = activeGames.reduce((sum: number, g: any) => {
        const count = Array.isArray(g.players) ? g.players.length : 0
        return sum + count
      }, 0)

      const totalPotValue = activeGames.reduce((sum: number, g: any) => {
        const stake = Number(g.stake || 0)
        const players = Array.isArray(g.players) ? g.players.length : 0
        return sum + stake * players
      }, 0)

      const activeTimed = activeGames.filter((g: any) => (g.status === 'active' || g.status === 'countdown') && (g.started_at || g.created_at))
      const avgGameTimeSeconds = activeTimed.length
        ? Math.round(
            activeTimed.reduce((sum: number, g: any) => {
              const t0 = new Date(g.started_at || g.created_at).getTime()
              return sum + Math.max(0, Math.floor((Date.now() - t0) / 1000))
            }, 0) / activeTimed.length,
          )
        : 0

      setLiveStats({
        activeRooms: activeRoomIds.size,
        playersOnline,
        totalPotValue,
        avgGameTimeSeconds,
      })
    } catch (e) {
      console.error('Error fetching live games:', e)
      setLiveGamesByRoom({})
      setLiveStats({ activeRooms: 0, playersOnline: 0, totalPotValue: 0, avgGameTimeSeconds: 0 })
    }
  }

  const formatDuration = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}m ${String(r).padStart(2, '0')}s`
  }

  const formatMmSs = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }

  const forceEndGame = async (gameId: string, reason: string) => {
    const patch = { status: 'finished', ended_at: new Date().toISOString(), game_status: 'finished_no_winner', end_reason: reason }
    const { error: err1 } = await supabase.from('games').update(patch as any).eq('id', gameId)
    if (err1) {
      await supabase.from('games').update({ status: 'finished', ended_at: new Date().toISOString() } as any).eq('id', gameId)
    }
  }

  const handleActionReset = (room: any) => {
    setConfirmConfig({
      title: 'Reset room',
      message: `Reset room "${room?.name || room?.id}"? This will end the current live game (if any) and create a fresh waiting game session.`,
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
      variant: 'default',
      onConfirm: () => {
        void (async () => {
          try {
            const live = liveGamesByRoom[String(room.id)]
            if (live?.id) {
              await forceEndGame(String(live.id), 'admin_reset')
            }
            const stake = Number(room.stake || 0)
            const { error } = await supabase
              .from('games')
              .insert({
                room_id: room.id,
                status: 'waiting',
                countdown_time: 10,
                players: [],
                bots: [],
                called_numbers: [],
                stake,
                prize_pool: 0,
                started_at: new Date().toISOString(),
              } as any)
            if (error) throw error
            showNotification('success', 'Room reset and new game created')
            await fetchRooms()
          } catch (e: any) {
            console.error('Failed to reset room', e)
            showNotification('error', e?.message || 'Failed to reset room')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const handleActionForceStop = (room: any) => {
    setConfirmConfig({
      title: 'Force stop game',
      message: `Force stop the current game in "${room?.name || room?.id}" (if any)?`,
      confirmLabel: 'Force Stop',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const live = liveGamesByRoom[String(room.id)]
            if (!live?.id) {
              showNotification('error', 'No active game found for this room')
              return
            }
            await forceEndGame(String(live.id), 'admin_force_end')
            showNotification('success', 'Game force stopped')
            await fetchRooms()
          } catch (e: any) {
            console.error('Failed to force stop game', e)
            showNotification('error', e?.message || 'Failed to force stop game')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const handleActionClose = (room: any) => {
    setConfirmConfig({
      title: 'Close room',
      message: `Close room "${room?.name || room?.id}"? This will disable the room and end the current game (if any).`,
      confirmLabel: 'Close',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            const live = liveGamesByRoom[String(room.id)]
            if (live?.id) {
              await forceEndGame(String(live.id), 'admin_close_room')
            }
            const { error } = await supabase.from('rooms').update({ status: 'inactive' } as any).eq('id', room.id)
            if (error) throw error
            showNotification('success', 'Room closed')
            await fetchRooms()
          } catch (e: any) {
            console.error('Failed to close room', e)
            showNotification('error', e?.message || 'Failed to close room')
          }
        })()
      },
    })
    setConfirmOpen(true)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const toggleRoomStatus = async (roomId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      const { error } = await supabase
        .from('rooms')
        .update({ status: newStatus })
        .eq('id', roomId)

      if (error) throw error
      
      showNotification('success', `Room ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`)
      fetchRooms()
    } catch (error) {
      console.error('Error updating room:', error)
      showNotification('error', 'Failed to update room status')
    }
  }

  

  const handleCreateRoom = () => {
    setEditingRoom(null)
    setFormData({
      id: '',
      name: '',
      stake: '',
      max_players: '',
      description: '',
      color: 'from-blue-500 to-blue-700',
      default_level: 'medium'
    })
    setShowCreateModal(true)
  }

  const handleEditRoom = (room: any) => {
    setEditingRoom(room)
    setFormData({
      id: room.id,
      name: room.name,
      stake: room.stake.toString(),
      max_players: room.max_players.toString(),
      description: room.description || '',
      color: room.color || 'from-blue-500 to-blue-700',
      default_level: room.default_level || 'medium'
    })
    setShowCreateModal(true)
  }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    try {
      const roomData = {
        name: formData.name,
        stake: parseFloat(formData.stake),
        max_players: parseInt(formData.max_players),
        description: formData.description,
        color: formData.color,
        prize_pool: 0, // Set to 0 - will be calculated dynamically
        default_level: formData.default_level,
        game_level: formData.default_level, // Also set game_level
        status: 'active',
        current_players: 0
      }

      if (editingRoom) {

        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id)
        
        if (error) throw error
        alert('Room updated successfully!')
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert({
            ...roomData,
            id: formData.id
          })
        
        if (error) throw error
        alert('Room created successfully!')
      }

      setShowCreateModal(false)
      fetchRooms()
    } catch (error) {
      console.error('Error saving room:', error)
      alert('Failed to save room')
    }
  }

  const doDeleteRoom = async (roomId: string) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)

      if (error) {
        console.error('Error deleting room:', error)

        if ((error as any).code === '23503') {
          showNotification(
            'error',
            'Cannot delete room due to foreign key constraints. Please run the SQL fix script in Supabase first.',
          )
        } else {
          showNotification('error', `Failed to delete room: ${error.message}`)
        }
        return
      }

      showNotification('success', 'Room deleted successfully!')
      fetchRooms()
    } catch (error: any) {
      console.error('Error deleting room:', error)
      showNotification('error', `Failed to delete room: ${error?.message || 'Unknown error'}`)
    }
  }

  const handleDeleteRoom = (roomId: string) => {
    const message =
      `Are you sure you want to delete room "${roomId}"?` +
      '\n\nThis will permanently delete the room and all associated games, players, and data.' +
      '\n\nThis action cannot be undone.'

    setConfirmConfig({
      title: 'Delete room',
      message,
      confirmLabel: 'Delete room',
      cancelLabel: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        void doDeleteRoom(roomId)
      },
    })
    setConfirmOpen(true)
  }

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, setCurrentPage])

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / pageSize))
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRooms.slice(start, start + pageSize)
  }, [filteredRooms, currentPage, pageSize])

  const showingFrom = filteredRooms.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingTo = Math.min(currentPage * pageSize, filteredRooms.length)

  const exportCsv = () => {
    const rows = filteredRooms.map((r: any) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      stake: Number(r.stake || 0),
      max_players: Number(r.max_players || 0),
      current_players: Number(r.current_players || 0),
      created_at: r.created_at || '',
    }))

    const headers = ['id', 'name', 'status', 'stake', 'max_players', 'current_players', 'created_at']
    const escape = (v: any) => {
      const s = String(v ?? '')
      if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const csv = [headers.join(',')]
      .concat(rows.map(r => headers.map(h => escape((r as any)[h])).join(',')))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rooms-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell title="Rooms Overview">
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

      {notification && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top ${
          notification.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-white tracking-tight">Live Rooms</h1>
            <p className="text-[#b6b1a0]">Manage active game sessions, lobby configurations, and monitor real-time statuses.</p>
          </div>
          <button
            onClick={handleCreateRoom}
            className="flex items-center justify-center gap-2 rounded-lg h-10 px-5 bg-[#d4af35] hover:bg-[#b5952b] text-[#1C1C1C] text-sm font-bold shadow-[0_0_20px_rgba(212,175,53,0.2)] transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create New Room
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#252525] rounded-lg p-5 border border-white/5 shadow-sm relative overflow-hidden">
            <span className="text-[#b6b1a0] text-sm font-medium">Active Rooms</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{liveStats.activeRooms}</span>
            </div>
          </div>
          <div className="bg-[#252525] rounded-lg p-5 border border-white/5 shadow-sm relative overflow-hidden">
            <span className="text-[#b6b1a0] text-sm font-medium">Players Online</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{liveStats.playersOnline}</span>
            </div>
          </div>
          <div className="bg-[#252525] rounded-lg p-5 border border-white/5 shadow-sm relative overflow-hidden">
            <span className="text-[#b6b1a0] text-sm font-medium">Total Pot Value</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{formatCurrency(liveStats.totalPotValue)}</span>
            </div>
          </div>
          <div className="bg-[#252525] rounded-lg p-5 border border-white/5 shadow-sm relative overflow-hidden">
            <span className="text-[#b6b1a0] text-sm font-medium">Avg Game Time</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{formatDuration(liveStats.avgGameTimeSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col bg-[#252525] rounded-lg border border-white/5 shadow-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-[#333333] bg-[#222]">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 bg-[#2f2f2f] hover:bg-[#383838] rounded-lg text-sm font-medium text-white transition-colors border border-transparent hover:border-white/10"
              >
                <Filter className="w-5 h-5" />
                Filter
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 bg-[#2f2f2f] hover:bg-[#383838] rounded-lg text-sm font-medium text-white transition-colors border border-transparent hover:border-white/10"
              >
                <ArrowLeftRight className="w-5 h-5" />
                Sort
              </button>
              <div className="h-6 w-px bg-[#333333] mx-1" />
              <span className="text-[#b6b1a0] text-sm">Showing {showingFrom}-{showingTo} of {filteredRooms.length} rooms</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex relative">
                <input
                  className="block w-64 bg-[#252525] border border-transparent focus:border-[#d4af35]/50 text-white text-sm rounded-lg px-4 py-2 placeholder-[#b6b1a0] focus:ring-0 focus:bg-[#2a2a2a] transition-all"
                  placeholder="Search rooms..."
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => fetchRooms()}
                className="flex items-center justify-center size-9 rounded-lg hover:bg-[#383838] text-[#b6b1a0] hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center justify-center size-9 rounded-lg hover:bg-[#383838] text-[#b6b1a0] hover:text-white transition-colors"
                title="Export"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="md:hidden px-4 py-3 border-b border-[#333333] bg-[#222]">
            <input
              className="w-full bg-[#252525] border border-transparent focus:border-[#d4af35]/50 text-white text-sm rounded-lg px-4 py-2 placeholder-[#b6b1a0] focus:ring-0 focus:bg-[#2a2a2a] transition-all"
              placeholder="Search rooms..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#2a2a2a] text-xs uppercase text-[#b6b1a0] font-semibold tracking-wider border-b border-[#333333]">
                  <th className="px-6 py-4">Room ID</th>
                  <th className="px-6 py-4">Players</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Timer</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333333]">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-[#b6b1a0]" colSpan={6}>Loading rooms...</td>
                  </tr>
                ) : paginatedRooms.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-[#b6b1a0]" colSpan={6}>{searchTerm ? 'No rooms match your search' : 'No rooms found'}</td>
                  </tr>
                ) : (
                  paginatedRooms.map((room) => {
                    const live = liveGamesByRoom[String(room.id)]
                    const playersFromGame = live && Array.isArray(live.players) ? live.players.length : null
                    const currentPlayers = typeof playersFromGame === 'number' ? playersFromGame : (Number(room.current_players) || 0)
                    const maxPlayers = Number(room.max_players) || 0
                    const fillPct = maxPlayers > 0 ? Math.min(100, Math.round((currentPlayers / maxPlayers) * 100)) : 0
                    const liveStatus = String(live?.status || '')
                    const isLive = liveStatus === 'active' || liveStatus === 'countdown'
                    const isWaiting = liveStatus === 'waiting'
                    const isActive = isLive || isWaiting
                    const createdAt = room.created_at ? new Date(room.created_at) : null
                    const timerSeconds = live && (live.started_at || live.created_at)
                      ? Math.max(0, Math.floor((nowTs - new Date(live.started_at || live.created_at).getTime()) / 1000))
                      : 0
                    return (
                      <tr key={room.id} className={`${isActive ? '' : 'opacity-60'} hover:bg-[#2a2a2a] transition-colors group`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`size-8 rounded bg-[#1C1C1C] flex items-center justify-center border border-white/5 ${isActive ? 'text-[#d4af35]' : 'text-[#b6b1a0]'}`}>
                              <span className="font-mono text-xs">RM</span>
                            </div>
                            <span className={`font-mono font-medium tracking-wide ${isActive ? 'text-[#d4af35]' : 'text-white'}`}>#{room.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {maxPlayers > 0 ? (
                            <div className="flex flex-col gap-1 w-24">
                              <div className={`flex justify-between text-xs ${isActive ? 'text-white' : 'text-[#b6b1a0]'}`}>
                                <span>{currentPlayers}</span>
                                <span className="text-[#b6b1a0]">/ {maxPlayers}</span>
                              </div>
                              <div className="h-1.5 w-full bg-[#1C1C1C] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${currentPlayers >= maxPlayers ? 'bg-green-500' : 'bg-[#d4af35]'}`}
                                  style={{ width: `${fillPct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-[#b6b1a0]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isLive ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                              <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs font-medium text-green-500">Live</span>
                            </div>
                          ) : isWaiting ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d4af35]/10 border border-[#d4af35]/20">
                              <div className="size-1.5 rounded-full bg-[#d4af35]" />
                              <span className="text-xs font-medium text-[#d4af35]">Waiting</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                              <div className="size-1.5 rounded-full bg-[#b6b1a0]" />
                              <span className="text-xs font-medium text-[#b6b1a0]">Closed</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-mono text-sm ${isActive ? 'text-white' : 'text-[#b6b1a0]'}`}>{isLive ? formatMmSs(timerSeconds) : '--:--'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${isActive ? 'text-[#b6b1a0]' : 'text-[#b6b1a0]/70'}`}>
                            {createdAt ? createdAt.toLocaleString() : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => handleActionReset(room)} className="p-1.5 hover:bg-[#383838] rounded text-[#b6b1a0] hover:text-white transition-colors" title="Reset Room">↻</button>
                            <button type="button" onClick={() => handleActionForceStop(room)} className="p-1.5 hover:bg-[#F39C12]/10 rounded text-[#b6b1a0] hover:text-[#F39C12] transition-colors" title="Force Stop">⛔</button>
                            <button type="button" onClick={() => handleActionClose(room)} className="p-1.5 hover:bg-red-500/10 rounded text-[#b6b1a0] hover:text-red-500 transition-colors" title="Close Room">✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-[#333333] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium text-[#b6b1a0] hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                ‹ Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).slice(0, 12).map((_, idx) => {
                  const page = idx + 1
                  if (totalPages > 12 && page === 6) {
                    return (
                      <span key="ellipsis" className="text-[#b6b1a0] px-2">…</span>
                    )
                  }
                  if (totalPages > 12 && page > 6 && page < totalPages) return null

                  const effectivePage = totalPages > 12 && page === 12 ? totalPages : page
                  const isActive = effectivePage === currentPage
                  return (
                    <button
                      key={effectivePage}
                      type="button"
                      onClick={() => setCurrentPage(effectivePage)}
                      className={
                        isActive
                          ? 'size-8 rounded flex items-center justify-center bg-[#d4af35] text-[#1C1C1C] text-sm font-bold'
                          : 'size-8 rounded flex items-center justify-center hover:bg-[#383838] text-[#b6b1a0] text-sm font-medium transition-colors'
                      }
                    >
                      {effectivePage}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium text-[#b6b1a0] hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1">
              {editingRoom ? 'Edit Room' : 'Create New Room'}
            </h2>
            <p className="text-[#b6b1a0] text-sm mb-6">Manage room settings and configurations</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[#b6b1a0] text-sm font-medium mb-2">Room ID</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({...formData, id: e.target.value})}
                  className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35]/50 transition-colors"
                  placeholder="speed-bingo"
                  disabled={!!editingRoom}
                  required={!editingRoom}
                />
                <p className="text-xs text-[#b6b1a0] mt-1">Unique identifier (cannot be changed)</p>
              </div>
              <div>
                <label className="block text-[#b6b1a0] text-sm font-medium mb-2">Room Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35]/50 transition-colors"
                  placeholder="Speed Bingo"
                  required
                />
              </div>
              <div>
                <label className="block text-[#b6b1a0] text-sm font-medium mb-2">Entry Fee (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stake}
                  onChange={(e) => setFormData({...formData, stake: e.target.value})}
                  className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35]/50 transition-colors"
                  placeholder="5.00"
                  required
                />
              </div>
              <div>
                <label className="block text-[#b6b1a0] text-sm font-medium mb-2">Max Players</label>
                <input
                  type="number"
                  value={formData.max_players}
                  onChange={(e) => setFormData({...formData, max_players: e.target.value})}
                  className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35]/50 transition-colors"
                  placeholder="200"
                  required
                />
              </div>
              <div className="bg-[#d4af35]/10 border border-[#d4af35]/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#d4af35]">ℹ</span>
                  <label className="text-[#d4af35] font-medium text-sm">Prize Pool</label>
                </div>
                <p className="text-[#b6b1a0] text-xs">
                  Calculated dynamically: Entry Fee × Waiting Players × 90%
                </p>
              </div>
              <div>
                <label className="block text-[#b6b1a0] text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35]/50 transition-colors"
                  placeholder="Fast-paced action! Numbers called every 2 seconds."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-[#b6b1a0] text-sm font-medium mb-2">Default Difficulty</label>
                <select
                  value={formData.default_level}
                  onChange={(e) => setFormData({...formData, default_level: e.target.value})}
                  className="w-full bg-[#1C1C1C] border border-[#333333] text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#d4af35]/50 transition-colors"
                >
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
                <p className="text-[#b6b1a0] text-xs mt-1">Players can choose their preferred difficulty when joining</p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#333333]">
                <button
                  type="submit"
                  className="flex-1 bg-[#d4af35] hover:bg-[#b5952b] text-[#1C1C1C] py-2.5 rounded-lg font-semibold transition-colors"
                >
                  {editingRoom ? 'Update Room' : 'Create Room'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-[#1C1C1C] hover:bg-[#2f2f2f] text-[#b6b1a0] py-2.5 rounded-lg font-semibold transition-colors border border-[#333333]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
