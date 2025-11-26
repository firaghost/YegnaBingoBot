"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Player } from '@lottiefiles/react-lottie-player'
import { LuArrowLeft, LuTrophy, LuClock, LuUsers, LuCoins, LuMedal, LuCalendar } from 'react-icons/lu'

interface TournamentDetail {
    id: string
    name: string
    type: string
    status: string
    start_at: string
    end_at: string
    prize_summary: string
    eligibility_summary: string
    prize_mode: string
    prize_config: any
    settings: any
    metrics_summary: {
        total_deposits: number
        participants: number
    }
    topDepositors: Array<{ username: string; valueLabel: string }>
    topPlayers: Array<{ username: string; valueLabel: string }>
}

export default function TournamentDetailPage() {
    const params = useParams()
    const router = useRouter()
    const tournamentId = params?.id as string

    const [tournament, setTournament] = useState<TournamentDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [secondsRemaining, setSecondsRemaining] = useState(0)

    useEffect(() => {
        if (!tournamentId) return

        const fetchTournament = async () => {
            try {
                setLoading(true)
                const res = await fetch('/api/tournaments')
                if (!res.ok) throw new Error('Failed to fetch tournaments')

                const json = await res.json()
                const tournaments = json?.tournaments || []
                const found = tournaments.find((t: any) => t.id === tournamentId)

                if (!found) {
                    setError('Tournament not found')
                    return
                }

                setTournament(found)
            } catch (err) {
                console.error('Error fetching tournament:', err)
                setError('Failed to load tournament')
            } finally {
                setLoading(false)
            }
        }

        fetchTournament()
    }, [tournamentId])

    useEffect(() => {
        if (!tournament) return

        const now = Date.now()
        const end = new Date(tournament.end_at).getTime()
        const initial = Math.max(0, Math.floor((end - now) / 1000))
        setSecondsRemaining(initial)

        if (initial <= 0 || tournament.status === 'ended') return

        const interval = setInterval(() => {
            setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0))
        }, 1000)

        return () => clearInterval(interval)
    }, [tournament])

    const formatCountdown = (totalSeconds: number): string => {
        if (totalSeconds <= 0) return '00:00:00'
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (error || !tournament) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LuTrophy className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-50 mb-2">{error || 'Tournament Not Found'}</h2>
                    <p className="text-slate-400 mb-6">The tournament you're looking for doesn't exist or has been removed.</p>
                    <button
                        onClick={() => router.push('/lobby')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
                    >
                        <LuArrowLeft className="w-5 h-5" />
                        Back to Lobby
                    </button>
                </div>
            </div>
        )
    }

    const isLive = tournament.status === 'live'
    const statusColor = isLive
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
        : tournament.status === 'upcoming'
            ? 'bg-amber-500/15 text-amber-200 border-amber-400/40'
            : 'bg-slate-700/60 text-slate-200 border-slate-500'

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-slate-950 border-b border-slate-800 z-40 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button
                        onClick={() => router.push('/lobby')}
                        className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors"
                    >
                        <LuArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-slate-50">Tournament Details</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Tournament Header Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-lg">
                    <div className="absolute inset-0 opacity-40 pointer-events-none">
                        <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/30 blur-3xl rounded-full" />
                        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-blue-500/25 blur-3xl rounded-full" />
                    </div>

                    <div className="relative p-6 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 flex-shrink-0 drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]">
                                <Player
                                    src="/lottie/trophy.json"
                                    autoplay
                                    loop
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-medium uppercase tracking-wider text-slate-300">
                                        {tournament.type}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-50">{tournament.name}</h2>
                                {tournament.eligibility_summary && (
                                    <p className="text-sm text-slate-300">{tournament.eligibility_summary}</p>
                                )}
                            </div>
                        </div>

                        {/* Countdown */}
                        {isLive && secondsRemaining > 0 && (
                            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3">
                                <LuClock className="w-5 h-5 text-emerald-400" />
                                <div className="flex-1">
                                    <p className="text-xs text-slate-400 uppercase tracking-wide">Time Remaining</p>
                                    <p className="text-lg font-mono font-bold text-emerald-300">{formatCountdown(secondsRemaining)}</p>
                                </div>
                            </div>
                        )}

                        {/* Prize Info */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                                <LuCoins className="w-5 h-5 text-amber-400" />
                                <p className="text-xs text-slate-400 uppercase tracking-wide">Prize Pool</p>
                            </div>
                            <p className="text-lg font-semibold text-amber-300">{tournament.prize_summary || 'To be announced'}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <LuUsers className="w-5 h-5 text-blue-400" />
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Participants</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-50">{tournament.metrics_summary.participants}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <LuCoins className="w-5 h-5 text-amber-400" />
                            <p className="text-xs text-slate-400 uppercase tracking-wide">Total Deposits</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-50">{tournament.metrics_summary.total_deposits.toLocaleString()} ETB</p>
                    </div>
                </div>

                {/* Tournament Dates */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-slate-50 flex items-center gap-2">
                        <LuCalendar className="w-5 h-5 text-slate-400" />
                        Tournament Schedule
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-slate-400 mb-1">Starts</p>
                            <p className="text-sm text-slate-200">{formatDate(tournament.start_at)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 mb-1">Ends</p>
                            <p className="text-sm text-slate-200">{formatDate(tournament.end_at)}</p>
                        </div>
                    </div>
                </div>

                {/* Leaderboards */}
                {(tournament.topDepositors.length > 0 || tournament.topPlayers.length > 0) && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-50 flex items-center gap-2">
                            <LuMedal className="w-6 h-6 text-amber-400" />
                            Leaderboards
                        </h3>

                        {tournament.topDepositors.length > 0 && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <h4 className="font-semibold text-slate-50 mb-4">Top Depositors</h4>
                                <div className="space-y-2">
                                    {tournament.topDepositors.map((player, idx) => (
                                        <div
                                            key={`depositor-${idx}`}
                                            className="flex items-center justify-between py-2 px-3 bg-slate-950/50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${idx === 0 ? 'bg-amber-500 text-slate-900' :
                                                        idx === 1 ? 'bg-slate-400 text-slate-900' :
                                                            idx === 2 ? 'bg-amber-700 text-white' :
                                                                'bg-slate-700 text-slate-200'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-slate-200">@{player.username}</span>
                                            </div>
                                            <span className="font-semibold text-emerald-300">{player.valueLabel}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {tournament.topPlayers.length > 0 && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                <h4 className="font-semibold text-slate-50 mb-4">Most Played</h4>
                                <div className="space-y-2">
                                    {tournament.topPlayers.map((player, idx) => (
                                        <div
                                            key={`player-${idx}`}
                                            className="flex items-center justify-between py-2 px-3 bg-slate-950/50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${idx === 0 ? 'bg-amber-500 text-slate-900' :
                                                        idx === 1 ? 'bg-slate-400 text-slate-900' :
                                                            idx === 2 ? 'bg-amber-700 text-white' :
                                                                'bg-slate-700 text-slate-200'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-slate-200">@{player.username}</span>
                                            </div>
                                            <span className="font-semibold text-blue-300">{player.valueLabel}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Call to Action */}
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-6 text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Ready to Compete?</h3>
                    <p className="text-emerald-50 mb-4">Join a game now to participate in this tournament!</p>
                    <button
                        onClick={() => router.push('/lobby')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transition-colors"
                    >
                        <LuTrophy className="w-5 h-5" />
                        Go to Lobby
                    </button>
                </div>
            </div>
        </div>
    )
}
