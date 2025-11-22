"use client"

import { useEffect, useState } from 'react'
import { Player } from '@lottiefiles/react-lottie-player'
import { LuTrophy, LuFlame, LuClock, LuArrowRight, LuMedal } from 'react-icons/lu'

export type LobbyTournamentStatus = 'upcoming' | 'live' | 'ended' | 'paused'
export type LobbyTournamentType = 'daily' | 'weekly' | 'custom'

export interface LobbyTournamentPreview {
  id: string
  name: string
  type: LobbyTournamentType
  status: LobbyTournamentStatus
  start_at: string
  end_at: string
  prize_summary: string
  eligibility_summary?: string
  topDepositors?: { username: string; valueLabel: string }[]
  topPlayers?: { username: string; valueLabel: string }[]
}

interface LobbyTournamentCardProps {
  tournament: LobbyTournamentPreview
  onViewDetails?: (id: string) => void
  onPlayNow?: () => void
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export default function LobbyTournamentCard({
  tournament,
  onViewDetails,
  onPlayNow,
}: LobbyTournamentCardProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  useEffect(() => {
    const now = Date.now()
    const start = new Date(tournament.start_at).getTime()
    const end = new Date(tournament.end_at).getTime()

    let initial: number
    if (tournament.status === 'upcoming') {
      initial = Math.max(0, Math.floor((start - now) / 1000))
    } else if (tournament.status === 'live') {
      initial = Math.max(0, Math.floor((end - now) / 1000))
    } else {
      initial = 0
    }
    setSecondsRemaining(initial)

    if (initial <= 0 || tournament.status === 'ended') return

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [tournament.id, tournament.status, tournament.start_at, tournament.end_at])

  const isLive = tournament.status === 'live'
  const isUpcoming = tournament.status === 'upcoming'

  const statusLabel = isLive
    ? 'Live Now'
    : isUpcoming
    ? 'Starting Soon'
    : tournament.status === 'ended'
    ? 'Finished'
    : 'Paused'

  const statusColor = isLive
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
    : isUpcoming
    ? 'bg-amber-500/15 text-amber-200 border-amber-400/40'
    : tournament.status === 'ended'
    ? 'bg-slate-700/60 text-slate-200 border-slate-500'
    : 'bg-purple-500/15 text-purple-200 border-purple-400/40'

  const typeLabel =
    tournament.type === 'daily'
      ? 'Daily Tournament'
      : tournament.type === 'weekly'
      ? 'Weekly Tournament'
      : 'Special Event'

  const countdownPrefix = isUpcoming ? 'Starts in' : isLive ? 'Ends in' : 'Ended'

  const topDepositors = tournament.topDepositors || []
  const topPlayers = tournament.topPlayers || []

  return (
    <div className="mb-4 sm:mb-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-lg">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/30 blur-3xl rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-blue-500/25 blur-3xl rounded-full" />
        </div>

        <div className="relative px-4 py-3 sm:px-5 sm:py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]">
                <Player
                  src="/lottie/trophy.json"
                  autoplay
                  loop
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300">
                  <LuFlame className="w-3 h-3 text-amber-400" />
                  <span>{typeLabel}</span>
                </div>
                <h2 className="text-sm sm:text-base font-semibold text-slate-50 leading-snug">
                  {tournament.name}
                </h2>
                {tournament.eligibility_summary ? (
                  <p className="text-[11px] text-slate-300 line-clamp-2">
                    {tournament.eligibility_summary}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Compete in this {typeLabel.toLowerCase()} for real cash rewards.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusColor}`}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {statusLabel}
              </span>
              {(isLive || isUpcoming) && secondsRemaining > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
                  <LuClock className="w-3.5 h-3.5 text-slate-300" />
                  <span className="font-mono text-[11px]">
                    {formatCountdown(secondsRemaining)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-200 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <span className="block uppercase tracking-[0.14em] text-[10px] text-slate-400">Prize</span>
              <span className="font-semibold text-emerald-300 truncate">
                {tournament.prize_summary || 'Configured by admin'}
              </span>
            </div>
            {(isLive || isUpcoming) && secondsRemaining > 0 && (
              <div className="ml-3 text-right flex-shrink-0">
                <span className="block uppercase tracking-[0.14em] text-[10px] text-slate-400">Time</span>
                <span className="font-mono text-[11px] text-slate-100">
                  {countdownPrefix === 'Starts in' ? 'Starts' : 'Ends'} {formatCountdown(secondsRemaining)}
                </span>
              </div>
            )}
          </div>

          {topDepositors.length === 0 && topPlayers.length === 0 && (
            <p className="text-[11px] text-slate-500">
              Leaderboard will appear once players start joining this tournament.
            </p>
          )}

          {(topDepositors.length > 0 || topPlayers.length > 0) && (
            <div className="space-y-1.5">
              {topDepositors.length > 0 && (
                <div className="text-[11px] sm:text-xs text-slate-200">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-slate-100">Top Depositors</span>
                  </div>
                  {topDepositors.slice(0, 2).map((p, idx) => (
                    <div
                      key={`${p.username}-${idx}`}
                      className="flex items-center justify-between py-0.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-200 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">@{p.username}</span>
                      </div>
                      <span className="ml-2 whitespace-nowrap font-semibold text-emerald-300">
                        {p.valueLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {topPlayers.length > 0 && (
                <div className="text-[11px] sm:text-xs text-slate-200">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-slate-100">Most Played</span>
                  </div>
                  {topPlayers.slice(0, 2).map((p, idx) => (
                    <div
                      key={`${p.username}-${idx}`}
                      className="flex items-center justify-between py-0.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-200 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate">@{p.username}</span>
                      </div>
                      <span className="ml-2 whitespace-nowrap font-semibold text-blue-300">
                        {p.valueLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
            <button
              type="button"
              onClick={() => onViewDetails && onViewDetails(tournament.id)}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs sm:text-sm font-semibold text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <span>View Tournament Details</span>
            </button>
            <button
              type="button"
              onClick={onPlayNow}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-xs sm:text-sm font-semibold text-slate-950 shadow-lg hover:from-emerald-600 hover:to-emerald-700 hover:shadow-xl transition-all"
            >
              <LuArrowRight className="w-4 h-4" />
              <span>Join Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
