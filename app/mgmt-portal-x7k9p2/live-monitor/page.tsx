"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { formatCurrency } from '@/lib/utils'
import { PauseCircle, Search, Wifi, Eye, XCircle } from 'lucide-react'

type LiveGame = {
  id: string
  room_id: string
  status: string
  created_at: string | null
  started_at: string | null
  stake: number | null
  prize_pool: number | null
  players: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  winner_id: string | null
  is_paused?: boolean
  paused_at?: string | null
  rooms?: { id: string; name: string; stake: number | null; max_players: number | null } | null
}

type PlayerRow = {
  id: string
  username: string
  card: number[][] | null
  card_updated_at: string | null
}

function letterForNumber(n: number) {
  if (n <= 15) return 'B'
  if (n <= 30) return 'I'
  if (n <= 45) return 'N'
  if (n <= 60) return 'G'
  return 'O'
}

function formatMmSs(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function AdminLiveMonitorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const gameIdFromUrl = searchParams?.get('gameId') || ''
  const viewFromUrl = (searchParams?.get('view') || '').toLowerCase()

  const [liveGames, setLiveGames] = useState<LiveGame[]>([])
  const [completedGames, setCompletedGames] = useState<any[]>([])
  const [selectedGameId, setSelectedGameId] = useState('')
  const [game, setGame] = useState<LiveGame | null>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'near' | 'winners'>('all')
  const [playerSearch, setPlayerSearch] = useState('')
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [ending, setEnding] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [historyScope, setHistoryScope] = useState<'all' | 'room'>('all')
  const [historyScopeTouched, setHistoryScopeTouched] = useState(false)

  const isHistoryMode = viewFromUrl === 'history' || game?.status === 'finished' || game?.status === 'cancelled'

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!gameIdFromUrl) return
    if (String(selectedGameId) === String(gameIdFromUrl)) return
    setSelectedGameId(gameIdFromUrl)
    void fetchSelected(gameIdFromUrl)
  }, [gameIdFromUrl, selectedGameId])

  const navigateToGame = (id: string, mode: 'live' | 'history') => {
    const qs = new URLSearchParams({ gameId: String(id) })
    if (mode === 'history') qs.set('view', 'history')
    router.replace(`/mgmt-portal-x7k9p2/live-monitor?${qs.toString()}`)
  }

  const fetchLiveGames = async () => {
    const resp = await fetch('/api/admin/live-games')
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || 'Failed to load live games')
    const list = (json?.games || []) as any[]
    setLiveGames(list as LiveGame[])

    // Do not override an explicit gameId coming from URL (it may be a finished game)
    if (gameIdFromUrl) {
      if (!selectedGameId) setSelectedGameId(gameIdFromUrl)
      return
    }

    const preferred = selectedGameId
    const first = preferred && list.find((g) => String(g.id) === String(preferred)) ? preferred : (list[0]?.id || '')
    if (first && first !== selectedGameId) setSelectedGameId(first)
  }

  const fetchCompletedGames = async () => {
    const resp = await fetch('/api/admin/completed-games')
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || 'Failed to load completed games')
    setCompletedGames((json?.games || []) as any[])
  }

  const fetchSelected = async (id: string) => {
    if (!id) {
      setGame(null)
      setPlayers([])
      return
    }

    const resp = await fetch(`/api/games/${id}`)
    const json = await resp.json()
    if (!resp.ok) throw new Error(json?.error || 'Failed to load game')

    setGame(json.game as LiveGame)
    setPlayers((json.players || []) as PlayerRow[])
  }

  const selectAndLoadGame = (id: string, mode: 'live' | 'history') => {
    setSelectedGameId(id)
    navigateToGame(id, mode)
    void fetchSelected(id)
  }

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        setLoading(true)
        await Promise.all([fetchLiveGames(), fetchCompletedGames()])
        if (!mounted) return
        if (selectedGameId) await fetchSelected(selectedGameId)
      } catch (e) {
        console.error('Failed to load live monitor data', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let stopped = false
    if (!selectedGameId) return

    void fetchSelected(selectedGameId)

    const refreshMs = isHistoryMode ? 15000 : 3000
    const t = setInterval(() => {
      void (async () => {
        try {
          await Promise.all([fetchLiveGames(), fetchCompletedGames()])
          if (stopped) return
          await fetchSelected(selectedGameId)
        } catch (e) {
          // ignore intermittent errors
        }
      })()
    }, refreshMs)

    return () => {
      stopped = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId, isHistoryMode])

  useEffect(() => {
    // Default behavior:
    // - show all rooms until you select a game
    // - once a game is selected, default to filtering by that room
    // - if the admin manually toggles the filter, keep their choice
    if (historyScopeTouched) return
    if (!game?.room_id) {
      setHistoryScope('all')
      return
    }
    setHistoryScope('room')
  }, [game?.room_id, historyScopeTouched])

  const computedPlayers = useMemo(() => {
    const called = new Set<number>((game?.called_numbers || []) as number[])
    const q = playerSearch.trim().toLowerCase()

    const winnerId = String((game as any)?.winner_id || '')
    const winnerCard = (game as any)?.winner_card as any

    const basePlayers = (() => {
      if (!isHistoryMode) return players

      // For history mode:
      // - show only players with a saved card (so progress is meaningful)
      // - ensure winner is included using winner_card fallback if needed
      const withCard = players.filter((p) => Array.isArray(p.card) && p.card.length === 5)
      const hasWinnerRow = !!winnerId && withCard.some((p) => String(p.id) === String(winnerId))
      if (hasWinnerRow) return withCard
      if (winnerId && Array.isArray(winnerCard) && winnerCard.length === 5) {
        const winnerUsername = players.find((p) => String(p.id) === String(winnerId))?.username || (game as any)?.winner?.username || ''
        return [
          {
            id: winnerId,
            username: winnerUsername,
            card: winnerCard,
            card_updated_at: null,
          } as PlayerRow,
          ...withCard,
        ]
      }
      return withCard
    })()

    const list = basePlayers
      .map((p) => {
        const card = p.card
        let matched = 0
        let total = 25
        if (Array.isArray(card) && card.length === 5) {
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              const v = Number(card[r]?.[c] ?? 0)
              if (r === 2 && c === 2) {
                matched += 1
                continue
              }
              if (v > 0 && called.has(v)) matched += 1
            }
          }
        } else {
          total = 0
          matched = 0
        }
        const toGo = total > 0 ? Math.max(0, total - matched) : null
        return {
          ...p,
          matched,
          total,
          toGo,
          percent: total > 0 ? Math.round((matched / total) * 100) : 0,
          isWinner: !!game?.winner_id && String(game.winner_id) === String(p.id),
        }
      })
      .filter((p) => {
        if (!q) return true
        return String(p.username || '').toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q)
      })

    if (tab === 'near') return list.filter((p) => p.toGo === 1)
    if (tab === 'winners') return list.filter((p) => p.isWinner)
    return list
  }, [players, game?.called_numbers, game?.winner_id, (game as any)?.winner_card, (game as any)?.winner?.username, playerSearch, tab, isHistoryMode])

  const potValue = useMemo(() => {
    if (!game) return 0
    const stake = Number(game.stake || game.rooms?.stake || 0)
    const playerCount = Array.isArray(game.players) ? game.players.length : 0
    return stake * playerCount
  }, [game])

  const timerSeconds = useMemo(() => {
    if (!game) return 0
    const startedAt = game.started_at || game.created_at
    if (!startedAt) return 0

    const startedMs = new Date(startedAt).getTime()
    if (!Number.isFinite(startedMs)) return 0

    const endedAt = (game as any)?.ended_at as string | null | undefined
    if (endedAt) {
      const endedMs = new Date(endedAt).getTime()
      if (Number.isFinite(endedMs)) {
        return Math.max(0, Math.floor((endedMs - startedMs) / 1000))
      }
    }

    return Math.max(0, Math.floor((nowTs - startedMs) / 1000))
  }, [game, nowTs])

  const durationSeconds = useMemo(() => {
    if (!game) return 0
    const started = game.started_at || game.created_at
    const ended = (game as any)?.ended_at as string | null | undefined
    if (!started || !ended) return 0
    const s = new Date(started).getTime()
    const e = new Date(ended).getTime()
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 0
    return Math.max(0, Math.floor((e - s) / 1000))
  }, [game])

  const endedAtLabel = useMemo(() => {
    const endedAt = (game as any)?.ended_at as string | null | undefined
    if (!endedAt) return ''
    const ms = new Date(endedAt).getTime()
    if (!Number.isFinite(ms)) return ''
    return new Date(ms).toLocaleString()
  }, [game])

  const gameOptions = useMemo(() => {
    const base = liveGames || []
    if (!game) return base
    const exists = base.some((g) => String(g.id) === String(game.id))
    if (exists) return base
    return [game as any, ...base]
  }, [liveGames, game])

  const completedGamesForCards = useMemo(() => {
    const playedOnly = (completedGames || []).filter((g: any) => {
      const started = !!g?.started_at
      const calledCount = Array.isArray(g?.called_numbers) ? g.called_numbers.length : 0
      return started && calledCount > 0
    })

    if (historyScope !== 'room') return playedOnly
    if (!game?.room_id) return playedOnly
    return playedOnly.filter((g: any) => String(g?.room_id) === String(game.room_id))
  }, [completedGames, historyScope, game?.room_id])

  const finalStandings = useMemo(() => {
    if (!isHistoryMode) return [] as typeof computedPlayers
    const list = [...computedPlayers].filter((p: any) => Number(p.total || 0) > 0)
    list.sort((a: any, b: any) => {
      const aw = a.isWinner ? 1 : 0
      const bw = b.isWinner ? 1 : 0
      if (aw !== bw) return bw - aw
      const am = Number(a.matched || 0)
      const bm = Number(b.matched || 0)
      if (am !== bm) return bm - am
      return String(a.username || '').localeCompare(String(b.username || ''))
    })
    return list
  }, [computedPlayers, isHistoryMode])

  const currentDraw = useMemo(() => {
    if (!game?.latest_number) return null
    return game.latest_number
  }, [game?.latest_number])

  const previousDraws = useMemo(() => {
    const nums = (game?.called_numbers || []) as number[]
    const tail = nums.slice(-6, -1)
    return tail.reverse().map((n) => `${letterForNumber(n)}-${n}`)
  }, [game?.called_numbers])

  const forceEnd = async () => {
    if (!game?.id || ending) return
    try {
      setEnding(true)
      await fetch('/api/admin/games/force-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id }),
      })
      await fetchLiveGames()
      if (selectedGameId) await fetchSelected(selectedGameId)
    } catch (e) {
      console.error('Failed to force end game', e)
    } finally {
      setEnding(false)
    }
  }

  const togglePause = async () => {
    if (!game?.id || pausing) return
    try {
      setPausing(true)
      const nextPaused = !Boolean(game.is_paused)
      const resp = await fetch('/api/admin/games/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, paused: nextPaused }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Failed to update pause state')
      await fetchLiveGames()
      if (selectedGameId) await fetchSelected(selectedGameId)
    } catch (e) {
      console.error('Failed to toggle pause', e)
    } finally {
      setPausing(false)
    }
  }

  return (
    <AdminShell title="Live Monitor">
      <div className="h-full w-full overflow-hidden">
        <div className="max-w-[1600px] mx-auto p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-white text-lg font-bold tracking-wide">Live Monitor</div>
              <select
                value={selectedGameId}
                onChange={(e) => {
                  const id = e.target.value
                  const picked = gameOptions.find((g) => String(g.id) === String(id))
                  const isFinished = String(picked?.status || '').toLowerCase() === 'finished' || String(picked?.status || '').toLowerCase() === 'cancelled'
                  selectAndLoadGame(id, isFinished ? 'history' : 'live')
                }}
                className="bg-[#252525] border border-[#333333] text-white text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#d4af35]"
              >
                {gameOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.rooms?.name ? `${g.rooms.name} · ` : ''}#{String(g.id).slice(0, 6)} · {g.status}
                  </option>
                ))}
              </select>
              {game?.status === 'active' && (
                <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-[#b6b1a0] bg-[#252525] px-3 py-1.5 rounded-lg border border-[#333333]">
                <Wifi className="w-4 h-4" />
                Server Latency: 12ms
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-[#b6b1a0]">Loading...</div>
          ) : !game ? (
            <div className="text-[#b6b1a0]">No live games found.</div>
          ) : (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                {!isHistoryMode ? (
                  <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 relative overflow-hidden shadow-lg shadow-black/20">
                    <h2 className="text-[#b6b1a0] text-xs font-bold uppercase tracking-widest mb-6">Current Draw</h2>
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="size-40 rounded-full bg-gradient-to-br from-[#d4af35] via-[#b08d2b] to-[#7a5e10] flex items-center justify-center shadow-[0_0_40px_rgba(212,175,53,0.3)] border-4 border-[#4a3e18] relative mb-6">
                        <div className="absolute inset-2 rounded-full border border-white/20"></div>
                        <div className="text-center">
                          <div className="text-white/90 text-sm font-bold uppercase tracking-wider">Ball</div>
                          <div className="text-white text-6xl font-display font-bold tracking-tighter">
                            {currentDraw ? `${currentDraw.letter}-${currentDraw.number}` : '--'}
                          </div>
                        </div>
                      </div>

                      <div className="w-full">
                        <div className="text-center text-[#b6b1a0] text-xs mb-3">Previous Draws</div>
                        <div className="flex justify-center gap-3 flex-wrap">
                          {previousDraws.map((x, idx) => (
                            <div
                              key={x + idx}
                              className={
                                'size-10 rounded-full bg-[#333] border border-[#444] flex items-center justify-center text-gray-400 font-bold text-sm' +
                                (idx >= 3 ? ' opacity-50' : '')
                              }
                            >
                              {x}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#252525] rounded-xl border border-[#333333] p-6 shadow-lg shadow-black/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white text-lg font-bold">Game Summary</div>
                        <div className="text-xs text-[#b6b1a0]">{game.rooms?.name || 'Room'} · #{String(game.id).slice(0, 8)}</div>
                      </div>
                      <div className="text-xs font-bold px-2.5 py-1 rounded-full border border-[#444] bg-[#1d1d1d] text-[#b6b1a0] uppercase">
                        {String(game.status)}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#333333] bg-[#1d1d1d] p-3">
                        <div className="text-[11px] text-[#b6b1a0]">Final Ball</div>
                        <div className="text-white text-xl font-bold">{currentDraw ? `${currentDraw.letter}-${currentDraw.number}` : '—'}</div>
                      </div>
                      <div className="rounded-lg border border-[#333333] bg-[#1d1d1d] p-3">
                        <div className="text-[11px] text-[#b6b1a0]">Duration</div>
                        <div className="text-white text-xl font-bold">{formatMmSs(durationSeconds)}</div>
                      </div>
                      <div className="rounded-lg border border-[#333333] bg-[#1d1d1d] p-3">
                        <div className="text-[11px] text-[#b6b1a0]">Total Called</div>
                        <div className="text-white text-xl font-bold">{(game.called_numbers || []).length}/75</div>
                      </div>
                      <div className="rounded-lg border border-[#333333] bg-[#1d1d1d] p-3">
                        <div className="text-[11px] text-[#b6b1a0]">Players</div>
                        <div className="text-white text-xl font-bold">{Array.isArray(game.players) ? game.players.length : 0}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#d4af35]/20 bg-gradient-to-br from-[#2a2510] to-[#1d1d1d] p-4">
                      <div className="text-[11px] text-[#b6b1a0] uppercase font-bold tracking-widest">Winner</div>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white text-base font-bold">{(game as any)?.winner?.username || (game as any)?.winner_id || '—'}</div>
                          <div className="text-xs text-[#b6b1a0]">Ended: {endedAtLabel || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-[#b6b1a0] uppercase font-bold tracking-widest">Pattern</div>
                          <div className="text-white font-bold">{String((game as any)?.winner_pattern || '—')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#252525] p-4 rounded-xl border border-[#333333]">
                    <div className="text-[#b6b1a0] text-xs font-medium mb-1">Total Pot</div>
                    <div className="text-white text-2xl font-bold font-display tracking-tight text-[#d4af35]">{formatCurrency(potValue)}</div>
                  </div>
                  <div className="bg-[#252525] p-4 rounded-xl border border-[#333333]">
                    <div className="text-[#b6b1a0] text-xs font-medium mb-1">Round</div>
                    <div className="text-white text-2xl font-bold font-display tracking-tight">{(game.called_numbers || []).length} <span className="text-sm font-normal text-gray-500">/ 75</span></div>
                  </div>
                  <div className="bg-[#252525] p-4 rounded-xl border border-[#333333]">
                    <div className="text-[#b6b1a0] text-xs font-medium mb-1">Time Elapsed</div>
                    <div className="text-white text-2xl font-bold font-display tracking-tight">{formatMmSs(timerSeconds)}</div>
                  </div>
                  <div className="bg-[#252525] p-4 rounded-xl border border-[#333333]">
                    <div className="text-[#b6b1a0] text-xs font-medium mb-1">Active Players</div>
                    <div className="text-white text-2xl font-bold font-display tracking-tight">{Array.isArray(game.players) ? game.players.length : 0}</div>
                  </div>
                </div>

                {!isHistoryMode && (
                  <div className="bg-[#252525] rounded-xl border border-[#333333] p-5">
                    <h3 className="text-white text-sm font-bold mb-4 flex items-center gap-2">
                      Admin Controls
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#F39C12]/10 border border-[#F39C12]/30 text-[#F39C12] hover:bg-[#F39C12] hover:text-black transition-all font-medium text-sm"
                        onClick={togglePause}
                        disabled={pausing}
                      >
                        <PauseCircle className="w-5 h-5" />
                        {pausing ? 'Updating…' : game.is_paused ? 'Resume Game Sequence' : 'Pause Game Sequence'}
                      </button>
                      <button
                        type="button"
                        onClick={forceEnd}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all font-medium text-sm"
                        disabled={ending}
                      >
                        <XCircle className="w-5 h-5" />
                        {ending ? 'Ending…' : 'Force End Game'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-[#252525] rounded-xl border border-[#333333] p-6">
                  <h2 className="text-[#b6b1a0] text-xs font-bold uppercase tracking-widest mb-4">Called Numbers</h2>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {((game.called_numbers || []) as number[])
                      .slice()
                      .reverse()
                      .map((n, idx) => (
                        <div
                          key={`${n}-${idx}`}
                          className={
                            'px-2 py-1 rounded-full text-xs font-bold border ' +
                            (idx === 0
                              ? 'bg-[#d4af35] text-black border-[#d4af35]'
                              : 'bg-[#333] text-gray-200 border-[#444]')
                          }
                        >
                          {letterForNumber(n)}-{n}
                        </div>
                      ))}
                    {(game.called_numbers || []).length === 0 && <div className="text-[#b6b1a0] text-sm">No numbers called yet.</div>}
                  </div>
                </div>

                {isHistoryMode && Array.isArray((game as any)?.winner_card) && (
                  <div className="bg-[#252525] rounded-xl border border-[#333333] p-6">
                    <h2 className="text-[#b6b1a0] text-xs font-bold uppercase tracking-widest mb-4">Winner Card</h2>
                    <div className="grid grid-cols-5 gap-1">
                      {((game as any).winner_card as any[]).flatMap((row: any[], r: number) =>
                        row.map((cell: any, c: number) => {
                          const v = Number(cell)
                          const isFree = r === 2 && c === 2
                          const called = new Set<number>((game?.called_numbers || []) as number[])
                          const isCalled = !isFree && v > 0 && called.has(v)
                          return (
                            <div
                              key={`${r}-${c}`}
                              className={
                                'h-10 rounded-lg flex items-center justify-center text-xs font-bold border ' +
                                (isFree
                                  ? 'bg-[#333] border-[#444] text-gray-200'
                                  : isCalled
                                    ? 'bg-[#d4af35] border-[#d4af35] text-black'
                                    : 'bg-[#1f1f1f] border-[#333] text-gray-200')
                              }
                            >
                              {isFree ? 'FREE' : v}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!isHistoryMode ? (
                <div className="col-span-12 lg:col-span-8 flex flex-col h-full bg-[#252525] rounded-xl border border-[#333333] overflow-hidden">
                  <div className="border-b border-[#333333] bg-[#1d1d1d] p-4 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-white text-lg font-bold">Player Leaderboard</h2>
                    <div className="flex bg-[#2a2a2a] p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTab('all')}
                        className={
                          'px-4 py-1.5 rounded-md text-sm font-medium transition-all ' +
                          (tab === 'all' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-[#b6b1a0] hover:text-white')
                        }
                      >
                        All Players
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('near')}
                        className={
                          'px-4 py-1.5 rounded-md text-sm font-medium transition-all ' +
                          (tab === 'near' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-[#b6b1a0] hover:text-white')
                        }
                      >
                        Near Win (1-to-go)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab('winners')}
                        className={
                          'px-4 py-1.5 rounded-md text-sm font-medium transition-all ' +
                          (tab === 'winners' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-[#b6b1a0] hover:text-white')
                        }
                      >
                        Winners
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        className="bg-[#2a2a2a] border-none text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:ring-1 focus:ring-[#d4af35] w-56 placeholder-gray-600"
                        placeholder="Search user..."
                        type="text"
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-[#222] border-b border-[#333333] text-xs font-bold text-[#b6b1a0] uppercase tracking-wider">
                    <div className="col-span-3">User</div>
                    <div className="col-span-4">Card Status (Match Progress)</div>
                    <div className="col-span-2 text-center">Numbers To Go</div>
                    <div className="col-span-2 text-center">Wager</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    {computedPlayers.map((p) => {
                      const initials = String(p.username || p.id).slice(0, 2).toUpperCase()
                      const near = p.toGo === 1
                      return (
                        <div
                          key={p.id}
                          className={
                            'grid grid-cols-12 gap-4 px-4 py-4 mb-2 items-center rounded-lg border transition-colors group ' +
                            (near
                              ? 'bg-gradient-to-r from-[#2a2510] to-[#252525] border-[#d4af35]/30'
                              : 'bg-transparent border-transparent hover:bg-[#2a2a2a]')
                          }
                        >
                          <div className="col-span-3 flex items-center gap-3">
                            <div className={
                              'size-8 rounded-full flex items-center justify-center font-bold text-xs ' +
                              (near ? 'bg-[#d4af35]/20 text-[#d4af35]' : 'bg-[#333] text-gray-400')
                            }>
                              {initials}
                            </div>
                            <div>
                              <div className="text-white font-medium text-sm">{p.username || p.id}</div>
                              <div className={"text-xs " + (near ? 'text-[#d4af35]' : 'text-gray-500')}>{near ? 'Potential Winner' : `ID: ${String(p.id).slice(0, 6)}`}</div>
                            </div>
                          </div>

                          <div className="col-span-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-400">{p.card ? 'Card' : 'No Card'}</span>
                              <span className={"text-xs " + (near ? 'text-[#d4af35] font-bold' : 'text-gray-300')}>{p.total ? `${p.matched}/${p.total} Matched` : '—'}</span>
                            </div>
                            <div className="w-full bg-[#333] h-2 rounded-full overflow-hidden">
                              <div
                                className={
                                  (near ? 'bg-[#d4af35]' : 'bg-green-600') +
                                  ' h-full rounded-full'
                                }
                                style={{ width: `${Math.min(100, Math.max(0, p.percent))}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="col-span-2 text-center">
                            <span className={
                              'inline-flex items-center justify-center size-8 rounded-full font-bold text-sm ' +
                              (near ? 'bg-[#d4af35] text-black' : 'bg-[#333] text-white font-medium')
                            }>
                              {p.toGo == null ? '—' : p.toGo}
                            </span>
                          </div>

                          <div className="col-span-2 text-center text-white font-mono">{formatCurrency(Number(game.stake || game.rooms?.stake || 0))}</div>
                          <div className="col-span-1 text-right">
                            <button type="button" className="text-gray-400 hover:text-white" title="View">
                              <Eye className="w-4 h-4 inline-block" />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {computedPlayers.length === 0 && (
                      <div className="text-center text-[#b6b1a0] py-10">No players to show.</div>
                    )}
                  </div>

                  <div className="border-t border-[#333333] p-3 flex justify-between items-center bg-[#1d1d1d] text-xs text-[#b6b1a0]">
                    <span>Showing 1-{computedPlayers.length} of {computedPlayers.length} players</span>
                    <div className="flex gap-2">
                      <button type="button" className="px-2 py-1 bg-[#252525] rounded hover:text-white disabled:opacity-50" disabled>
                        Previous
                      </button>
                      <button type="button" className="px-2 py-1 bg-[#252525] rounded hover:text-white" disabled>
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="col-span-12 lg:col-span-8 flex flex-col h-full bg-[#252525] rounded-xl border border-[#333333] overflow-hidden">
                  <div className="border-b border-[#333333] bg-[#1d1d1d] px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-white text-lg font-bold">Final Standings</div>
                      <div className="text-xs text-[#b6b1a0]">Ordered by winner then progress</div>
                    </div>
                    <div className="text-xs text-[#b6b1a0]">{finalStandings.length} players</div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {finalStandings.map((p: any, idx: number) => {
                      const initials = String(p.username || p.id).slice(0, 2).toUpperCase()
                      const rank = idx + 1
                      return (
                        <div
                          key={p.id}
                          className={
                            'rounded-xl border p-4 ' +
                            (p.isWinner
                              ? 'border-[#d4af35]/50 bg-gradient-to-br from-[#2a2510] to-[#1f1f1f]'
                              : 'border-[#333333] bg-[#1f1f1f]')
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={
                                'size-9 rounded-full flex items-center justify-center font-bold text-xs border ' +
                                (p.isWinner ? 'bg-[#d4af35] text-black border-[#d4af35]' : 'bg-[#2a2a2a] text-gray-200 border-[#333]')
                              }>
                                {initials}
                              </div>
                              <div>
                                <div className="text-white font-semibold">
                                  #{rank} {p.username || p.id}
                                </div>
                                <div className="text-xs text-[#b6b1a0]">{p.isWinner ? 'Winner' : `To go: ${p.toGo == null ? '—' : p.toGo}`}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-[#b6b1a0]">Progress</div>
                              <div className="text-white font-bold">{p.total ? `${p.matched}/${p.total}` : '—'}</div>
                            </div>
                          </div>

                          <div className="mt-3 w-full bg-[#333] h-2.5 rounded-full overflow-hidden">
                            <div
                              className={(p.isWinner ? 'bg-[#d4af35]' : 'bg-green-600') + ' h-full rounded-full'}
                              style={{ width: `${Math.min(100, Math.max(0, Number(p.percent || 0)))}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}

                    {finalStandings.length === 0 && (
                      <div className="text-center text-[#b6b1a0] py-10">No standings available.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="col-span-12">
                <div className="bg-[#252525] rounded-xl border border-[#333333] overflow-hidden">
                  <div className="border-b border-[#333333] bg-[#1d1d1d] px-6 py-4 flex items-center justify-between">
                    <div className="text-white font-bold">Completed Games</div>
                    <div className="flex items-center gap-3">
                      <div className="flex bg-[#2a2a2a] p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryScopeTouched(true)
                            setHistoryScope('all')
                          }}
                          className={
                            'px-3 py-1 rounded-md text-xs font-bold transition-all ' +
                            (historyScope === 'all' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-[#b6b1a0] hover:text-white')
                          }
                        >
                          All Rooms
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryScopeTouched(true)
                            setHistoryScope('room')
                          }}
                          disabled={!game?.room_id}
                          className={
                            'px-3 py-1 rounded-md text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ' +
                            (historyScope === 'room' ? 'bg-[#3a3a3a] text-white shadow-sm' : 'text-[#b6b1a0] hover:text-white')
                          }
                        >
                          This Room
                        </button>
                      </div>
                      <div className="text-xs text-[#b6b1a0]">Latest 40</div>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {(completedGamesForCards || []).map((g: any) => {
                      const winnerName = g?.winner?.username || ''
                      const ended = g?.ended_at ? new Date(g.ended_at).toLocaleString() : ''
                      const calledCount = Array.isArray(g?.called_numbers) ? g.called_numbers.length : 0
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            const id = String(g.id)
                            selectAndLoadGame(id, 'history')
                          }}
                          className={
                            'text-left rounded-xl border p-4 transition-colors ' +
                            (String(g.id) === String(selectedGameId)
                              ? 'border-[#d4af35]/60 bg-[#2a2510]'
                              : 'border-[#333333] bg-[#1f1f1f] hover:bg-[#242424]')
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs text-[#b6b1a0]">{g.rooms?.name || 'Room'}</div>
                              <div className="text-white font-mono font-bold">#{String(g.id).slice(0, 8)}</div>
                            </div>
                            <div className="text-xs font-bold text-[#b6b1a0]">{calledCount}/75</div>
                          </div>
                          <div className="mt-3 text-xs text-[#b6b1a0]">
                            <div className="truncate">Winner: <span className="text-white">{winnerName || '—'}</span></div>
                            <div className="truncate">Pattern: <span className="text-white">{String(g?.winner_pattern || '—')}</span></div>
                            <div className="truncate">Ended: <span className="text-white">{ended || '—'}</span></div>
                          </div>
                        </button>
                      )
                    })}
                    {(completedGamesForCards || []).length === 0 && (
                      <div className="text-[#b6b1a0] text-sm">No completed games yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
