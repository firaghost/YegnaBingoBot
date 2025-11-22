"use client"

import { useEffect, useState } from 'react'
import { Player } from '@lottiefiles/react-lottie-player'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/app/components/BottomNav'
import { LuCopy, LuLink2 } from 'react-icons/lu'

export default function BonusPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading } = useAuth()
  const [invitedFriends, setInvitedFriends] = useState<any[]>([])
  const [referralBalance, setReferralBalance] = useState(0)
  const [referralReward, setReferralReward] = useState<number | null>(null)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [claimFeedback, setClaimFeedback] = useState('')
  const [totalReferralEarnings, setTotalReferralEarnings] = useState(0)
  const [totalReferrals, setTotalReferrals] = useState(0)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [loading, isAuthenticated, router])

  // Fetch referral reward amount from admin_config via Supabase client
  useEffect(() => {
    const loadReferralReward = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('config_value')
          .eq('config_key', 'referral_bonus')
          .eq('is_active', true)
          .maybeSingle()

        if (error) {
          console.error('Error fetching referral bonus:', error)
          setReferralReward(0)
          return
        }

        let value: any = data?.config_value
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value)
          } catch {
            // keep as string
          }
        }

        const num = Number(value)
        setReferralReward(Number.isFinite(num) ? num : 0)
      } catch (error) {
        console.error('Error fetching referral bonus:', error)
        setReferralReward(0)
      }
    }

    loadReferralReward()
  }, [])

  // Fetch invited friends and referral pending balance
  useEffect(() => {
    if (!user?.id) return

    const fetchReferralData = async () => {
      try {
        setLoadingFriends(true)

        // Always fetch the freshest referral_pending value from Supabase
        const { data: userRow, error: userError } = await supabase
          .from('users')
          .select('referral_pending, referral_claimed, total_referrals')
          .eq('id', user.id)
          .maybeSingle()

        if (userError) {
          console.error('Error fetching referral user row:', userError)
        }

        const pending = Number((userRow as any)?.referral_pending ?? (user as any)?.referral_pending ?? 0)
        setReferralBalance(Number.isFinite(pending) ? pending : 0)

        const earned = Number((userRow as any)?.referral_claimed ?? (user as any)?.referral_claimed ?? 0)
        setTotalReferralEarnings(Number.isFinite(earned) ? earned : 0)

        const totalRefsNumber = Number((userRow as any)?.total_referrals ?? (user as any)?.total_referrals ?? 0)
        setTotalReferrals(Number.isFinite(totalRefsNumber) ? totalRefsNumber : 0)

        // Fetch invited friends from users table (those who have referrer_id = user.id)
        const { data: friendsData, error: friendsError } = await supabase
          .from('users')
          .select('id, username, created_at')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false })

        if (friendsError) {
          console.error('Error fetching invited friends:', friendsError)
        }

        let friendsList = friendsData || []

        // If we know there are referrals but user rows are missing referrer_id,
        // fall back to the referrals table so the list is still populated.
        if ((!friendsList || friendsList.length === 0) && Number.isFinite(totalRefsNumber) && totalRefsNumber > 0) {
          try {
            const { data: referralsData, error: referralsError } = await supabase
              .from('referrals')
              .select('id, created_at')
              .eq('referrer_id', user.id)
              .order('created_at', { ascending: false })

            if (referralsError) {
              console.error('Error fetching referrals fallback list:', referralsError)
            } else if (referralsData && referralsData.length > 0) {
              friendsList = referralsData.map((row: any) => ({
                id: row.id,
                username: null,
                created_at: row.created_at,
              }))
            }
          } catch (refErr) {
            console.error('Unexpected error fetching referrals fallback list:', refErr)
          }
        }

        // Absolute fallback: if we still have no rows but totalRefsNumber > 0,
        // create simple placeholder entries so the list is not empty.
        if ((!friendsList || friendsList.length === 0) && Number.isFinite(totalRefsNumber) && totalRefsNumber > 0) {
          friendsList = Array.from({ length: Math.min(totalRefsNumber, 50) }, (_v, idx) => ({
            id: `placeholder-${idx}`,
            username: null,
            created_at: new Date().toISOString(),
          }))
        }

        setInvitedFriends(friendsList)
      } catch (error) {
        console.error('Error fetching referral data:', error)
      } finally {
        setLoadingFriends(false)
      }
    }

    fetchReferralData()
  }, [user?.id])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Build referral link like inline bot: https://t.me/{botUsername}?start=ref_{telegramId}
  // Fallback to known bot username if env is not set (useful in local/dev)
  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME || 'BingoXOfficialBot').replace(/^@+/, '')
  const referralCode = (user as any).referral_code || user.telegram_id
  const inviteLink = botUsername
    ? `https://t.me/${botUsername}?start=ref_${referralCode}`
    : ''

  const handleCopyLink = () => {
    if (!inviteLink) {
      setCopyFeedback('Invite link not available')
      setTimeout(() => setCopyFeedback(''), 2000)
      return
    }

    // Primary: modern clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(inviteLink)
        .then(() => {
          setCopyFeedback('INVITE LINK COPIED!')
          setTimeout(() => setCopyFeedback(''), 2000)
        })
        .catch(() => {
          // Fallback: use a hidden textarea + execCommand
          try {
            const textarea = document.createElement('textarea')
            textarea.value = inviteLink
            textarea.style.position = 'fixed'
            textarea.style.left = '-9999px'
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopyFeedback('INVITE LINK COPIED!')
          } catch {
            setCopyFeedback('Unable to copy link')
          } finally {
            setTimeout(() => setCopyFeedback(''), 2000)
          }
        })
      return
    }

    // Older environments: textarea fallback only
    try {
      const textarea = document.createElement('textarea')
      textarea.value = inviteLink
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopyFeedback('INVITE LINK COPIED!')
    } catch {
      setCopyFeedback('Unable to copy link')
    } finally {
      setTimeout(() => setCopyFeedback(''), 2000)
    }
  }

  const handleInviteFriend = () => {
    // Preferred behaviour: open Telegram share sheet using inline mode
    if (typeof window !== 'undefined') {
      const tg: any = (window as any).Telegram?.WebApp
      if (tg?.switchInlineQuery) {
        // 'invite' query text matches our bot's inline handler; choose_chat=true opens chat picker
        tg.switchInlineQuery('invite', true)
        return
      }
    }

    // Fallback: just copy the link
    handleCopyLink()
  }

  const handleClaimReward = async () => {
    if (!user?.id) return

    if (referralBalance <= 0) {
      setClaimFeedback('Nothing to claim yet')
      setTimeout(() => setClaimFeedback(''), 2500)
      return
    }

    try {
      setClaimFeedback('Claiming your invite rewards...')
      const { data, error } = await supabase.rpc('claim_referral_pending', {
        p_user_id: user.id,
      })

      if (error) {
        console.error('Error claiming referral pending:', error)
        setClaimFeedback('Unable to claim right now. Please try again later.')
      } else if (data === false) {
        // Function returned false -> nothing pending
        setClaimFeedback('Nothing to claim yet')
      } else {
        setClaimFeedback('Invite rewards moved to your wallet')
        // Refresh pending balance after claim
        try {
          const { data: refreshed, error: refreshError } = await supabase
            .from('users')
            .select('referral_pending, referral_claimed, total_referrals')
            .eq('id', user.id)
            .maybeSingle()

          if (!refreshError && refreshed) {
            const pending = Number((refreshed as any)?.referral_pending ?? 0)
            setReferralBalance(Number.isFinite(pending) ? pending : 0)

            const earned = Number((refreshed as any)?.referral_claimed ?? 0)
            setTotalReferralEarnings(Number.isFinite(earned) ? earned : 0)

            const totalRefs = Number((refreshed as any)?.total_referrals ?? 0)
            setTotalReferrals(Number.isFinite(totalRefs) ? totalRefs : 0)
          }
        } catch (refreshErr) {
          console.error('Error refreshing referral pending after claim:', refreshErr)
        }
      }
    } catch (err) {
      console.error('Unexpected error claiming referral rewards:', err)
      setClaimFeedback('Unable to claim right now. Please try again later.')
    } finally {
      setTimeout(() => setClaimFeedback(''), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-50">
      {copyFeedback && (
        <div className="fixed top-3 left-3 right-3 z-50">
          <div className="bg-emerald-500 text-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <span className="text-sm font-semibold tracking-wide">{copyFeedback}</span>
          </div>
        </div>
      )}

      {/* Simple Header */}
      <div
        className="bg-slate-950 border-b border-slate-800"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 20px)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuLink2 className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-50">Invite</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Invite Header animation (sparkles) - centered, smaller */}
        <div className="mb-6 flex justify-center">
          <Player
            src="/lottie/Invite.json"
            autoplay
            loop
            style={{ width: 190, height: 95 }}
          />
        </div>

        {/* Invite Friends Section */}
        <div className="bg-slate-900 rounded-2xl p-5 mb-6 text-white">
          {/* Reward Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg">💰</span>
            </div>
            <div>
              <p className="font-semibold text-white">
                +{referralReward !== null ? formatCurrency(referralReward) : '...'} Per Friend
              </p>
              <p className="text-xs text-slate-200">
                You'll receive {referralReward !== null ? formatCurrency(referralReward) : '...'} per friend.
              </p>
            </div>
          </div>

          {/* Invite and Copy buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleInviteFriend}
              className="flex-1 bg-yellow-400 text-slate-900 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
            >
              Invite a friend
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-11 h-11 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
              aria-label="Copy invite link"
            >
              <LuCopy className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Balance Section with Money-fly Animation - dark card */}
        <div className="bg-slate-900 rounded-2xl p-5 mb-6 text-white">
          <h3 className="text-xs font-semibold text-slate-400 mb-3 tracking-[0.16em]">BALANCE</h3>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10">
                <Player
                  src="/lottie/Money-fly.json"
                  autoplay
                  loop
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div>
                <p className="text-xs text-slate-300">Pending from invites</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(referralBalance)}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Total earned: {formatCurrency(totalReferralEarnings)} • Pending: {formatCurrency(referralBalance)}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleClaimReward}
            className="w-full bg-amber-500 text-slate-900 py-3 rounded-full font-semibold hover:bg-amber-400 transition-colors"
          >
            Claim reward
          </button>

          {claimFeedback && (
            <p className="mt-2 text-xs text-slate-300 text-center">{claimFeedback}</p>
          )}
        </div>

        {/* Friends Section - dark card */}
        <div className="bg-slate-900 rounded-2xl text-slate-100">
          <div className="px-6 py-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-400">
              FRIENDS ({totalReferrals} INVITED)
            </h3>
          </div>

          {loadingFriends ? (
            <div className="flex justify-center items-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : totalReferrals === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              <p>You haven't invited any friends yet</p>
            </div>
          ) : invitedFriends.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              <p>Your invited friends will appear here soon</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {invitedFriends.slice(0, 3).map((friend) => (
                <div key={friend.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {friend.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{friend.username || 'Friend'}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(friend.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-100">+{referralReward !== null ? formatCurrency(referralReward) : '...'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}