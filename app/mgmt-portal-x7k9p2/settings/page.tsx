"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getAllConfig, getConfig, setConfig } from '@/lib/admin-config'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { AdminShell } from '@/app/mgmt-portal-x7k9p2/components/AdminShell'
import { AlertCircle, Bell, CheckCircle, Dice5, Gift, Lock, Search, Shield, Trophy, UserCog, Wallet, XCircle } from 'lucide-react'
import { SecurityTab } from './security-tab'

export default function AdminSettings() {
  const [searchQuery, setSearchQuery] = useLocalStorage('settings_search', '')
  const { admin, isSuperAdmin, isAuthenticated, loading: authLoading } = useAdminAuth()

  const hasPerm = (key: string) => admin?.role === 'super_admin' || Boolean((admin?.permissions || {})[key])
  const canView = hasPerm('settings_view') || hasPerm('settings_manage')
  const canManage = hasPerm('settings_manage')
  const [settings, setSettings] = useState({
    siteName: 'BingoX',
    maintenanceMode: false,
    maintenanceMessage: 'System under maintenance. Please try again later.',
    registrationEnabled: true,
    requireChannelJoin: true,
    minWithdrawal: 100 as number | string,
    maxWithdrawal: 100000 as number | string,
    withdrawalFee: 0 as number | string,
    minRequiredDeposit: 50 as number | string,
    depositMax: 100000 as number | string,
    depositFee: 0 as number | string,
    dailyWithdrawalLimit: 5000 as number | string,
    weeklyWithdrawalLimit: 2000 as number | string,
    commissionRate: 10 as number | string,
    minDepositToUnlock: 0 as number | string,
    welcomeBonus: 5 as number | string,
    depositBonus: 10 as number | string,
    referralBonus: 50 as number | string,
    dailyStreakBonus: 20 as number | string,
    telegramBotToken: '',
    socketUrl: '',
    emailNotifications: true,
    telegramNotifications: true,
    autoApproveDeposits: true,
    autoApproveWithdrawals: false,
    supportEmail: 'support@bingox.com',
    supportTelegram: '@bingox_support',
    supportPhone: '+251 911 234 567',
    requireOtpOnWithdrawal: false,
    ipWithdrawMaxPerMin: 5 as number | string,
    ipWithdrawWindowSeconds: 60 as number | string,

    cryptoDepositsEnabled: false,
    autoApproveSmallWithdrawals: false,
    strictKycEnforcement: false,
    liveDealerGames: false,
    publicRtpStats: false,
    autoKickIdlePlayers: false,
    welcomeBonusEnabled: false,
    wageringOnFreeSpins: false,
    allowBonusStacking: false,
    require2faForAdmins: false,
    blockRestrictedJurisdictions: false,
    suspiciousActivityAlerts: false,
    globalLeaderboard: false,
    allowLateRegistration: false,
    moderatorsCanBanUsers: false,
    supportCanViewWallets: false,
  })

  const [rulesText, setRulesText] = useState('')
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesSaving, setRulesSaving] = useState(false)

  const [originalSettings, setOriginalSettings] = useState(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isEnforcing, setIsEnforcing] = useState(false)
  // Payment methods state (Chapa / Manual)
  const [pmLoading, setPmLoading] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  // Admin management
  const [admins, setAdmins] = useState<any[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', role: 'admin', telegram_id: '', permissions: {} as Record<string, boolean> })
  const [bypassEnabled, setBypassEnabled] = useState<boolean | null>(null)
  // Maintenance whitelist
  const [wlUserIds, setWlUserIds] = useState<string[]>([])
  const [wlTgIds, setWlTgIds] = useState<string[]>([])
  const [wlUsernames, setWlUsernames] = useState<string[]>([])
  const [wlSearchTerm, setWlSearchTerm] = useState('')
  const [wlResults, setWlResults] = useState<any[]>([])
  const [wlSaving, setWlSaving] = useState(false)
  const [securityTab, setSecurityTab] = useState<'bypass' | 'whitelist' | 'admins'>('bypass')

  useEffect(() => {
    fetchSettings()
  }, [])

  // Load game_rules config for rules editor
  useEffect(() => {
    const loadGameRules = async () => {
      try {
        setRulesLoading(true)
        const value = await getConfig('game_rules')

        const defaultRules = [
          { title: 'Match 5 Numbers', body: 'Get 5 numbers in a row horizontally, vertically, or diagonally to win the game.' },
          { title: 'Free Center Cell', body: 'The center cell is always FREE – it counts as filled for every pattern.' },
          { title: 'First to BINGO Wins', body: 'The first player to correctly claim BINGO wins the full prize for this room.' },
          { title: 'Fair & Secure Randomness', body: 'All numbers are generated using cryptographically secure randomness for fair play.' },
          { title: 'Prize Pool & Commission', body: 'The winner receives the net prize pool after the platform commission is deducted.' },
        ]

        if (!value) {
          setRulesText(JSON.stringify(defaultRules, null, 2))
          return
        }

        let raw: any = value
        // getConfig already parses JSON if possible, but handle both shapes
        const items = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
            ? raw.items
            : null

        if (!items) {
          setRulesText(JSON.stringify(defaultRules, null, 2))
          return
        }

        setRulesText(JSON.stringify(items, null, 2))
      } catch (e) {
        console.warn('Failed to load game_rules config, using defaults')
      } finally {
        setRulesLoading(false)
      }
    }

    loadGameRules()
  }, [])

  // Load admins for permissions management
  useEffect(() => {
    if (isSuperAdmin) {
      loadAdmins()
    }
  }, [isSuperAdmin])

  // Whitelist helpers
  async function searchWhitelistUsers() {
    try {
      setWlResults([])
      const q = wlSearchTerm.trim()
      if (!q) return
      // Search by username ilike OR telegram_id equals
      const { data, error } = await supabase
        .from('users')
        .select('id, username, telegram_id')
        .or(`username.ilike.%${q}%,telegram_id.eq.${q}`)
        .limit(20)
      if (error) throw error
      setWlResults(data || [])
    } catch (e) {
      setWlResults([])
    }
  }

  function addToWhitelist(u: any) {
    const uid = String(u.id || '').trim()
    const tgid = u.telegram_id ? String(u.telegram_id).trim() : ''
    const uname = u.username ? String(u.username).trim() : ''
    if (uid && !wlUserIds.includes(uid)) setWlUserIds(prev => [...prev, uid])
    if (tgid && !wlTgIds.includes(tgid)) setWlTgIds(prev => [...prev, tgid])
    if (uname && !wlUsernames.includes(uname)) setWlUsernames(prev => [...prev, uname])
  }

  function removeFromWhitelist(type: 'uid' | 'tgid' | 'uname', value: string) {
    if (type === 'uid') setWlUserIds(prev => prev.filter(v => v !== value))
    if (type === 'tgid') setWlTgIds(prev => prev.filter(v => v !== value))
    if (type === 'uname') setWlUsernames(prev => prev.filter(v => v !== value))
  }

  async function saveWhitelist() {
    try {
      setWlSaving(true)
      await setConfig('maintenance_bypass_user_ids', wlUserIds)
      await setConfig('maintenance_bypass_telegram_ids', wlTgIds)
      await setConfig('maintenance_bypass_usernames', wlUsernames)
      showNotification('success', 'Whitelist saved')
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to save whitelist')
    } finally {
      setWlSaving(false)
    }
  }

  useEffect(() => {
    setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings))
  }, [settings, originalSettings])

  const fetchSettings = async () => {
    try {
      const config = await getAllConfig()
      if (Object.keys(config).length > 0) {
        const mappedSettings = {
          siteName: config.appName || 'BingoX',
          maintenanceMode: config.maintenanceMode || false,
          maintenanceMessage: config.maintenanceMessage || 'System under maintenance. Please try again later.',
          registrationEnabled: config.registrationEnabled ?? true,
          requireChannelJoin: (config as any).requireChannelJoin ?? true,
          minWithdrawal: Number(config.minWithdrawalAmount) || 100,
          maxWithdrawal: Number(config.maxWithdrawalAmount) || 100000,
          withdrawalFee: Math.round((Number(config.withdrawalFeeRate) || 0) * 100 * 100) / 100,
          commissionRate: Math.round((Number(config.gameCommissionRate) || 0.1) * 100 * 100) / 100,
          minRequiredDeposit: Number(config.minRequiredDeposit) || 50,
          minDepositToUnlock: Number((config as any).minDepositToUnlock) || 0,
          depositMax: Number((config as any).depositMax) || 100000,
          depositFee: Math.round((Number((config as any).depositFee) || 0) * 100 * 100) / 100,
          dailyWithdrawalLimit: Number(config.dailyWithdrawalLimit) || 5000,
          weeklyWithdrawalLimit: Number(config.weeklyWithdrawalLimit) || 20000,
          welcomeBonus: Number(config.welcomeBonus) || 5,
          depositBonus: Number(config.depositBonus) || 10,
          referralBonus: Number(config.referralBonus) || 50,
          dailyStreakBonus: Number(config.dailyStreakBonus) || 20,
          telegramBotToken: config.telegramBotToken || '',
          socketUrl: config.socketUrl || '',
          emailNotifications: config.emailNotifications ?? true,
          telegramNotifications: config.telegramNotifications ?? true,
          autoApproveDeposits: config.autoApproveDeposits ?? false,
          autoApproveWithdrawals: config.autoApproveWithdrawals ?? false,
          supportEmail: config.supportEmail || 'support@bingox.com',
          supportTelegram: config.telegramSupport || '@bingox_support',
          supportPhone: config.supportPhone || '+251 911 234 567',
          requireOtpOnWithdrawal: Boolean(config.requireOtpOnWithdrawal),
          ipWithdrawMaxPerMin: Number(config.ipWithdrawMaxPerMin) || 5,
          ipWithdrawWindowSeconds: Number(config.ipWithdrawWindowSeconds) || 60,

          cryptoDepositsEnabled: Boolean((config as any).cryptoDepositsEnabled),
          autoApproveSmallWithdrawals: Boolean((config as any).autoApproveSmallWithdrawals),
          strictKycEnforcement: Boolean((config as any).strictKycEnforcement),
          liveDealerGames: Boolean((config as any).liveDealerGames),
          publicRtpStats: Boolean((config as any).publicRtpStats),
          autoKickIdlePlayers: Boolean((config as any).autoKickIdlePlayers),
          welcomeBonusEnabled: Boolean((config as any).welcomeBonusEnabled),
          wageringOnFreeSpins: Boolean((config as any).wageringOnFreeSpins),
          allowBonusStacking: Boolean((config as any).allowBonusStacking),
          require2faForAdmins: Boolean((config as any).require2faForAdmins),
          blockRestrictedJurisdictions: Boolean((config as any).blockRestrictedJurisdictions),
          suspiciousActivityAlerts: Boolean((config as any).suspiciousActivityAlerts),
          globalLeaderboard: Boolean((config as any).globalLeaderboard),
          allowLateRegistration: Boolean((config as any).allowLateRegistration),
          moderatorsCanBanUsers: Boolean((config as any).moderatorsCanBanUsers),
          supportCanViewWallets: Boolean((config as any).supportCanViewWallets),
        }
        setSettings(prev => ({ ...prev, ...mappedSettings }))
        setOriginalSettings(prev => ({ ...prev, ...mappedSettings }))
        // Load maintenance whitelist arrays
        try {
          const c: any = config
          setWlUserIds(Array.isArray(c.maintenanceBypassUserIds) ? c.maintenanceBypassUserIds.map(String) : [])
          setWlTgIds(Array.isArray(c.maintenanceBypassTelegramIds) ? c.maintenanceBypassTelegramIds.map(String) : [])
          setWlUsernames(Array.isArray(c.maintenanceBypassUsernames) ? c.maintenanceBypassUsernames.map(String) : [])
        } catch {}
        // Load payment methods after settings
        try { await loadPaymentMethods() } catch {}
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      showNotification('error', 'Failed to load settings')
    }
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  async function loadPaymentMethods() {
    if (!admin) return
    try {
      setPmLoading(true)
      const res = await fetch('/api/admin/payment-methods', { headers: { 'x-admin-id': admin.id } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load payment methods')
      setPaymentMethods(Array.isArray(data.data) ? data.data : [])
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to load payment methods')
    } finally {
      setPmLoading(false)
    }
  }

  async function savePaymentMethods() {
    if (!admin) return showNotification('error', 'Admin session missing')
    try {
      setPmLoading(true)
      const payload = paymentMethods.map(pm => ({
        id: pm.id,
        name: pm.name,
        enabled: !!pm.enabled,
        instructions: pm.instructions ?? null,
        min_amount: pm.min_amount != null ? Number(pm.min_amount) : null,
        max_amount: pm.max_amount != null ? Number(pm.max_amount) : null,
        fee_rate: pm.fee_rate != null ? Number(pm.fee_rate) : null,
        bonus_percent: pm.bonus_percent != null ? Number(pm.bonus_percent) : null
      }))
      const res = await fetch('/api/admin/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save payment methods')
      setPaymentMethods(Array.isArray(data.data) ? data.data : [])
      showNotification('success', 'Payment methods saved')
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to save payment methods')
    } finally {
      setPmLoading(false)
    }
  }

  async function loadAdmins() {
    try {
      setLoadingAdmins(true)
      const res = await fetch('/api/admin/users', {
        headers: { 'x-admin-id': admin?.id || '' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load admins')
      setAdmins(data.data || [])
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to load admins')
    } finally {
      setLoadingAdmins(false)
    }
  }

  async function createAdmin() {
    try {
      if (!newAdmin.username || !newAdmin.password) return showNotification('error', 'Username and password required')
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin?.id || '' },
        body: JSON.stringify(newAdmin)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create admin')
      setNewAdmin({ username: '', password: '', role: 'admin', telegram_id: '', permissions: {} })
      await loadAdmins()
      showNotification('success', 'Admin created')
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to create admin')
    }
  }

  async function updateAdmin(a: any) {
    try {
      const payload: any = { id: a.id }
      if (a.username !== undefined) payload.username = a.username
      if (a.role !== undefined) payload.role = a.role
      if (a.new_password) payload.new_password = a.new_password
      if (a.old_password) payload.old_password = a.old_password
      if (a.confirm_password) payload.confirm_password = a.confirm_password
      if (a.permissions && typeof a.permissions === 'object') payload.permissions = a.permissions
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin?.id || '' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update admin')
      await loadAdmins()
      showNotification('success', 'Admin updated')
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to update admin')
    }
  }

  async function setBypass(action: 'enable' | 'disable') {
    try {
      const res = await fetch('/api/maintenance/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': admin?.id || '' },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set maintenance bypass')
      setBypassEnabled(action === 'enable')
      showNotification('success', `Bypass ${action === 'enable' ? 'enabled' : 'disabled'} for this browser`)
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to set bypass')
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const changedSettings: { [key: string]: any } = {}
      
      if (settings.siteName !== originalSettings.siteName) changedSettings.app_name = settings.siteName
      if (Boolean(settings.maintenanceMode) !== Boolean(originalSettings.maintenanceMode)) changedSettings.maintenance_mode = Boolean(settings.maintenanceMode)
      if (settings.maintenanceMessage !== originalSettings.maintenanceMessage) changedSettings.maintenance_message = settings.maintenanceMessage
      if (Boolean(settings.registrationEnabled) !== Boolean(originalSettings.registrationEnabled)) changedSettings.registration_enabled = Boolean(settings.registrationEnabled)
      if (Boolean(settings.requireChannelJoin) !== Boolean(originalSettings.requireChannelJoin)) changedSettings.require_channel_join = Boolean(settings.requireChannelJoin)
      if (Number(settings.minWithdrawal) !== Number(originalSettings.minWithdrawal)) changedSettings.min_withdrawal_amount = Number(settings.minWithdrawal) || 0
      if (Number(settings.maxWithdrawal) !== Number(originalSettings.maxWithdrawal)) changedSettings.max_withdrawal_amount = Number(settings.maxWithdrawal) || 0
      if (Number(settings.withdrawalFee) !== Number(originalSettings.withdrawalFee)) changedSettings.withdrawal_fee_rate = (Number(settings.withdrawalFee) || 0) / 100
      if (Number(settings.commissionRate) !== Number(originalSettings.commissionRate)) changedSettings.game_commission_rate = (Number(settings.commissionRate) || 0) / 100
      if (Number(settings.minRequiredDeposit) !== Number(originalSettings.minRequiredDeposit)) changedSettings.min_required_deposit = Number(settings.minRequiredDeposit) || 0
      if (Number(settings.minDepositToUnlock) !== Number(originalSettings.minDepositToUnlock)) changedSettings.min_deposit_to_unlock = Number(settings.minDepositToUnlock) || 0
      if (Number(settings.depositMax) !== Number(originalSettings.depositMax)) changedSettings.deposit_max = Number(settings.depositMax) || 0
      if (Number(settings.depositFee) !== Number(originalSettings.depositFee)) changedSettings.deposit_fee = (Number(settings.depositFee) || 0) / 100
      if (Number(settings.dailyWithdrawalLimit) !== Number(originalSettings.dailyWithdrawalLimit)) changedSettings.daily_withdrawal_limit = Number(settings.dailyWithdrawalLimit) || 0
      if (Number(settings.weeklyWithdrawalLimit) !== Number(originalSettings.weeklyWithdrawalLimit)) changedSettings.weekly_withdrawal_limit = Number(settings.weeklyWithdrawalLimit) || 0
      if (Boolean(settings.autoApproveDeposits) !== Boolean(originalSettings.autoApproveDeposits)) changedSettings.auto_approve_deposits = Boolean(settings.autoApproveDeposits)
      if (Boolean(settings.autoApproveWithdrawals) !== Boolean(originalSettings.autoApproveWithdrawals)) changedSettings.auto_approve_withdrawals = Boolean(settings.autoApproveWithdrawals)
      if (Number(settings.welcomeBonus) !== Number(originalSettings.welcomeBonus)) changedSettings.welcome_bonus = Number(settings.welcomeBonus) || 0
      if (Number(settings.referralBonus) !== Number(originalSettings.referralBonus)) changedSettings.referral_bonus = Number(settings.referralBonus) || 0
      if (Number(settings.depositBonus) !== Number(originalSettings.depositBonus)) changedSettings.deposit_bonus = Number(settings.depositBonus) || 0
      if (Number(settings.dailyStreakBonus) !== Number(originalSettings.dailyStreakBonus)) changedSettings.daily_streak_bonus = Number(settings.dailyStreakBonus) || 0
      if (settings.supportEmail !== originalSettings.supportEmail) changedSettings.support_email = settings.supportEmail
      if (settings.supportTelegram !== originalSettings.supportTelegram) changedSettings.telegram_support = settings.supportTelegram
      if (settings.supportPhone !== originalSettings.supportPhone) changedSettings.support_phone = settings.supportPhone
      if (settings.telegramBotToken !== originalSettings.telegramBotToken) changedSettings.telegram_bot_token = settings.telegramBotToken
      if (settings.socketUrl !== originalSettings.socketUrl) changedSettings.socket_url = settings.socketUrl
      if (Boolean(settings.emailNotifications) !== Boolean(originalSettings.emailNotifications)) changedSettings.email_notifications = Boolean(settings.emailNotifications)
      if (Boolean(settings.telegramNotifications) !== Boolean(originalSettings.telegramNotifications)) changedSettings.telegram_notifications = Boolean(settings.telegramNotifications)
      if (Boolean(settings.requireOtpOnWithdrawal) !== Boolean(originalSettings.requireOtpOnWithdrawal)) changedSettings.require_otp_on_withdrawal = Boolean(settings.requireOtpOnWithdrawal)
      if (Number(settings.ipWithdrawMaxPerMin) !== Number(originalSettings.ipWithdrawMaxPerMin)) changedSettings.ip_withdraw_max_per_min = Number(settings.ipWithdrawMaxPerMin) || 0
      if (Number(settings.ipWithdrawWindowSeconds) !== Number(originalSettings.ipWithdrawWindowSeconds)) changedSettings.ip_withdraw_window_seconds = Number(settings.ipWithdrawWindowSeconds) || 0

      if (Boolean(settings.cryptoDepositsEnabled) !== Boolean(originalSettings.cryptoDepositsEnabled)) changedSettings.crypto_deposits_enabled = Boolean(settings.cryptoDepositsEnabled)
      if (Boolean(settings.autoApproveSmallWithdrawals) !== Boolean(originalSettings.autoApproveSmallWithdrawals)) changedSettings.auto_approve_small_withdrawals = Boolean(settings.autoApproveSmallWithdrawals)
      if (Boolean(settings.strictKycEnforcement) !== Boolean(originalSettings.strictKycEnforcement)) changedSettings.strict_kyc_enforcement = Boolean(settings.strictKycEnforcement)
      if (Boolean(settings.liveDealerGames) !== Boolean(originalSettings.liveDealerGames)) changedSettings.live_dealer_games = Boolean(settings.liveDealerGames)
      if (Boolean(settings.publicRtpStats) !== Boolean(originalSettings.publicRtpStats)) changedSettings.public_rtp_stats = Boolean(settings.publicRtpStats)
      if (Boolean(settings.autoKickIdlePlayers) !== Boolean(originalSettings.autoKickIdlePlayers)) changedSettings.auto_kick_idle_players = Boolean(settings.autoKickIdlePlayers)
      if (Boolean(settings.welcomeBonusEnabled) !== Boolean(originalSettings.welcomeBonusEnabled)) changedSettings.welcome_bonus_enabled = Boolean(settings.welcomeBonusEnabled)
      if (Boolean(settings.wageringOnFreeSpins) !== Boolean(originalSettings.wageringOnFreeSpins)) changedSettings.wagering_on_free_spins = Boolean(settings.wageringOnFreeSpins)
      if (Boolean(settings.allowBonusStacking) !== Boolean(originalSettings.allowBonusStacking)) changedSettings.allow_bonus_stacking = Boolean(settings.allowBonusStacking)
      if (Boolean(settings.require2faForAdmins) !== Boolean(originalSettings.require2faForAdmins)) changedSettings.require_2fa_for_admins = Boolean(settings.require2faForAdmins)
      if (Boolean(settings.blockRestrictedJurisdictions) !== Boolean(originalSettings.blockRestrictedJurisdictions)) changedSettings.block_restricted_jurisdictions = Boolean(settings.blockRestrictedJurisdictions)
      if (Boolean(settings.suspiciousActivityAlerts) !== Boolean(originalSettings.suspiciousActivityAlerts)) changedSettings.suspicious_activity_alerts = Boolean(settings.suspiciousActivityAlerts)
      if (Boolean(settings.globalLeaderboard) !== Boolean(originalSettings.globalLeaderboard)) changedSettings.global_leaderboard = Boolean(settings.globalLeaderboard)
      if (Boolean(settings.allowLateRegistration) !== Boolean(originalSettings.allowLateRegistration)) changedSettings.allow_late_registration = Boolean(settings.allowLateRegistration)
      if (Boolean(settings.moderatorsCanBanUsers) !== Boolean(originalSettings.moderatorsCanBanUsers)) changedSettings.moderators_can_ban_users = Boolean(settings.moderatorsCanBanUsers)
      if (Boolean(settings.supportCanViewWallets) !== Boolean(originalSettings.supportCanViewWallets)) changedSettings.support_can_view_wallets = Boolean(settings.supportCanViewWallets)

      if (Object.keys(changedSettings).length === 0) {
        showNotification('error', 'No changes to save')
        return
      }

      for (const [key, value] of Object.entries(changedSettings)) {
        await setConfig(key, value)
      }
      
      setOriginalSettings({ ...settings })
      showNotification('success', `${Object.keys(changedSettings).length} settings saved successfully!`)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      showNotification('error', error.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  // Run retroactive enforcement to reject pending withdrawals from users
  // with no deposits, convert real->bonus, and notify users.
  async function enforceBonusRules() {
    try {
      setIsEnforcing(true)
      const res = await fetch('/api/admin/withdrawals/enforce', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to enforce rules')
      showNotification('success', `Processed ${data.processed} withdrawal(s) using bonus rules`)
    } catch (e: any) {
      showNotification('error', e.message || 'Failed to enforce rules')
    } finally {
      setIsEnforcing(false)
    }
  }

  const q = (searchQuery || '').trim().toLowerCase()
  const match = (...parts: (string | undefined | null)[]) => {
    if (!q) return true
    const hay = parts.filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  }

  const ToggleRow = ({ label, value, onChange, description, disabled }: any) => {
    if (!match(label, description)) return null
    return (
      <div className="flex items-center justify-between p-4 rounded-lg hover:bg-[#2C2C2C] transition-colors">
        <div className="flex flex-col gap-1 pr-4">
          <span className="text-white text-sm font-bold">{label}</span>
          {description && <span className="text-[#A1A1AA] text-xs">{description}</span>}
        </div>
        <label className={`relative inline-flex items-center ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <div className="w-11 h-6 bg-[#3f3f46] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-[#A1A1AA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d4af35]"></div>
        </label>
      </div>
    )
  }

  const InputRow = ({ label, value, onChange, type = 'text', description, placeholder, disabled }: any) => {
    if (!match(label, description)) return null
    return (
      <label className="flex flex-col gap-2">
        <span className="text-white text-sm font-medium">{label}</span>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg bg-[#1a1a1a] border border-[#333333] text-white text-sm px-4 py-3 focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35] placeholder-[#A1A1AA]/50 disabled:opacity-60"
        />
        {description && <span className="text-[#A1A1AA] text-xs">{description}</span>}
      </label>
    )
  }

  const SettingInput = InputRow
  const SettingToggle = ToggleRow

  const handleSaveRules = async () => {
    if (!canManage) {
      showNotification('error', 'You do not have permission to manage settings')
      return
    }
    try {
      setRulesSaving(true)
      let parsed: any
      try {
        parsed = JSON.parse(rulesText || '[]')
      } catch (e: any) {
        showNotification('error', 'Rules JSON is invalid. Please fix and try again.')
        return
      }

      const items = Array.isArray(parsed) ? parsed : parsed?.items
      if (!Array.isArray(items) || items.length === 0) {
        showNotification('error', 'Rules must be a non-empty array or an object with an "items" array.')
        return
      }

      const cleaned = items
        .map((r: any) => ({
          id: r.id ?? undefined,
          title: String(r.title || '').trim(),
          body: String(r.body || '').trim(),
        }))
        .filter((r: any) => r.title && r.body)

      if (cleaned.length === 0) {
        showNotification('error', 'Each rule must have both a title and body.')
        return
      }

      const ok = await setConfig('game_rules', { items: cleaned }, admin?.id)
      if (!ok) {
        showNotification('error', 'Failed to save game rules')
        return
      }

      setRulesText(JSON.stringify(cleaned, null, 2))
      showNotification('success', 'Game rules saved')
    } catch (e: any) {
      showNotification('error', e?.message || 'Failed to save game rules')
    } finally {
      setRulesSaving(false)
    }
  }

  const toastClassName =
    notification?.type === 'success'
      ? 'fixed top-20 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top border shadow-lg text-sm flex items-center gap-2 bg-[#d4af35]/15 text-[#d4af35] border-[#d4af35]/30'
      : 'fixed top-20 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top border shadow-lg text-sm flex items-center gap-2 bg-red-500/20 text-red-300 border-red-500/30'

  if (authLoading) return <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center text-[#A1A1AA]">Loading…</div>
  if (!isAuthenticated || !canView) {
    return (
      <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center">
        <div className="bg-[#252525] border border-[#333333] rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">403 - Forbidden</h1>
          <p className="text-[#A1A1AA]">You do not have permission to access Settings.</p>
        </div>
      </div>
    )
  }

  return (
    <AdminShell title="Platform Settings">
      {notification && (
        <div className={toastClassName}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-white text-3xl font-black leading-tight tracking-tight">Platform Settings</h2>
            <p className="text-[#A1A1AA] text-base font-normal">Configure global system rules, permissions, and game mechanics.</p>
          </div>

          <div className="w-full lg:w-[420px]">
            <div className="flex w-full items-center rounded-xl bg-[#252525] border border-[#333333] focus-within:border-[#d4af35] focus-within:ring-1 focus-within:ring-[#d4af35] transition-all h-12 overflow-hidden shadow-sm">
              <div className="pl-4 pr-2 text-[#666666]">
                <Search className="w-5 h-5" />
              </div>
              <input
                className="w-full bg-transparent border-none text-white placeholder-[#A1A1AA] focus:ring-0 text-sm h-full font-medium"
                placeholder="Search specific rules (e.g. 'Bonus', 'Crypto')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {hasChanges && (
            <button
              type="button"
              onClick={() => {
                setSettings(originalSettings)
                showNotification('error', 'Changes discarded')
              }}
              className="bg-[#252525] hover:bg-[#2a2a2a] text-[#A1A1AA] hover:text-white transition-colors text-sm font-bold tracking-wide border border-[#333333] rounded-lg h-11 px-5"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !canManage}
            className={`rounded-lg h-11 px-5 text-sm font-bold tracking-wide border transition-colors ${
              hasChanges && !isSaving && canManage
                ? 'bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] border-[#d4af35]'
                : 'bg-[#252525] text-[#666666] border-[#333333] cursor-not-allowed'
            }`}
            title={!canManage ? 'You do not have permission to modify settings' : ''}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">Wallet &amp; Transactions</h3>
                <p className="text-xs text-[#A1A1AA]">Deposit methods and withdrawal limits</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <ToggleRow
                label="Cryptocurrency Deposits"
                value={settings.cryptoDepositsEnabled}
                onChange={(v: boolean) => setSettings({ ...settings, cryptoDepositsEnabled: v })}
                description="Allow users to deposit using BTC, ETH, and USDT."
              />
              <ToggleRow
                label="Auto-Approve Small Withdrawals"
                value={settings.autoApproveSmallWithdrawals}
                onChange={(v: boolean) => setSettings({ ...settings, autoApproveSmallWithdrawals: v })}
                description="Instantly process withdrawals under $500."
              />
              <ToggleRow
                label="Strict KYC Enforcement"
                value={settings.strictKycEnforcement}
                onChange={(v: boolean) => setSettings({ ...settings, strictKycEnforcement: v })}
                description="Prevent any withdrawal without verified ID."
              />

              <details className="px-4 pb-4 pt-2 border-t border-[#333333]">
                <summary className="cursor-pointer text-sm font-bold text-[#A1A1AA] select-none">Advanced</summary>
                <div className="mt-4 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputRow label="Min Withdrawal (ETB)" value={settings.minWithdrawal} onChange={(e: any) => setSettings({ ...settings, minWithdrawal: e.target.value })} type="number" description="Minimum withdrawal amount" />
                    <InputRow label="Max Withdrawal (ETB)" value={settings.maxWithdrawal} onChange={(e: any) => setSettings({ ...settings, maxWithdrawal: e.target.value })} type="number" description="Maximum withdrawal amount" />
                    <InputRow label="Withdrawal Fee (%)" value={settings.withdrawalFee} onChange={(e: any) => setSettings({ ...settings, withdrawalFee: e.target.value })} type="number" description="Fee charged on withdrawals" />
                    <InputRow label="Daily Withdrawal Limit (ETB)" value={settings.dailyWithdrawalLimit} onChange={(e: any) => setSettings({ ...settings, dailyWithdrawalLimit: e.target.value })} type="number" description="Max withdrawal per day" />
                    <InputRow label="Weekly Withdrawal Limit (ETB)" value={settings.weeklyWithdrawalLimit} onChange={(e: any) => setSettings({ ...settings, weeklyWithdrawalLimit: e.target.value })} type="number" description="Max withdrawal per week" />
                    <InputRow label="Min Deposit (ETB)" value={settings.minRequiredDeposit} onChange={(e: any) => setSettings({ ...settings, minRequiredDeposit: e.target.value })} type="number" description="Minimum deposit amount" />
                    <InputRow label="Max Deposit (ETB)" value={settings.depositMax} onChange={(e: any) => setSettings({ ...settings, depositMax: e.target.value })} type="number" description="Maximum deposit amount" />
                    <InputRow label="Min Deposit to Unlock Bonus Wins (ETB)" value={settings.minDepositToUnlock} onChange={(e: any) => setSettings({ ...settings, minDepositToUnlock: e.target.value })} type="number" description="Minimum first deposit required before locked bonus winnings convert to real balance." />
                    <InputRow label="Deposit Fee (%)" value={settings.depositFee} onChange={(e: any) => setSettings({ ...settings, depositFee: e.target.value })} type="number" description="Fee applied to deposits" />
                    <InputRow label="Commission Rate (%)" value={settings.commissionRate} onChange={(e: any) => setSettings({ ...settings, commissionRate: e.target.value })} type="number" description="Platform commission on games" />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-white font-bold">Auto Approvals</h4>
                    <ToggleRow label="Auto-Approve Deposits" value={settings.autoApproveDeposits} onChange={(v: boolean) => setSettings({ ...settings, autoApproveDeposits: v })} description="Automatically approve deposit requests" />
                    <ToggleRow label="Auto-Approve Withdrawals" value={settings.autoApproveWithdrawals} onChange={(v: boolean) => setSettings({ ...settings, autoApproveWithdrawals: v })} description="Automatically approve withdrawal requests" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-bold">Payment Methods</h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={loadPaymentMethods}
                          className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#A1A1AA] hover:text-white hover:bg-[#2a2a2a] text-xs font-bold"
                          disabled={pmLoading}
                        >
                          {pmLoading ? 'Loading…' : 'Reload'}
                        </button>
                        <button
                          onClick={savePaymentMethods}
                          className="px-3 py-2 rounded-lg bg-[#d4af35] border border-[#d4af35] text-[#1C1C1C] hover:bg-[#c29d2b] text-xs font-bold"
                          disabled={pmLoading}
                        >
                          Save Methods
                        </button>
                      </div>
                    </div>

                    {paymentMethods.length === 0 ? (
                      <div className="text-[#A1A1AA] text-sm">No methods configured.</div>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((pm, idx) => (
                          <div key={pm.id || pm.name || idx} className="p-4 rounded-lg border border-[#333333] bg-[#1a1a1a]">
                            <div className="flex items-center justify-between">
                              <div className="text-white font-bold">{pm.name}</div>
                              <div className="flex items-center gap-3">
                                <span className="text-[#A1A1AA] text-xs">Enabled</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    className="sr-only peer"
                                    type="checkbox"
                                    checked={!!pm.enabled}
                                    onChange={() => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, enabled: !m.enabled } : m))}
                                  />
                                  <div className="w-11 h-6 bg-[#3f3f46] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-[#A1A1AA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d4af35]"></div>
                                </label>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[#A1A1AA] text-xs mb-1">Min Amount (ETB)</label>
                                <input
                                  type="number"
                                  className="w-full bg-[#141414] border border-[#333333] text-white px-3 py-2 rounded-md focus:outline-none focus:border-[#d4af35]/60"
                                  value={pm.min_amount ?? ''}
                                  onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, min_amount: Number(e.target.value) } : m))}
                                />
                              </div>
                              <div>
                                <label className="block text-[#A1A1AA] text-xs mb-1">Max Amount (ETB)</label>
                                <input
                                  type="number"
                                  className="w-full bg-[#141414] border border-[#333333] text-white px-3 py-2 rounded-md focus:outline-none focus:border-[#d4af35]/60"
                                  value={pm.max_amount ?? ''}
                                  onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, max_amount: Number(e.target.value) } : m))}
                                />
                              </div>
                              <div>
                                <label className="block text-[#A1A1AA] text-xs mb-1">Fee Rate (%)</label>
                                <input
                                  type="number"
                                  className="w-full bg-[#141414] border border-[#333333] text-white px-3 py-2 rounded-md focus:outline-none focus:border-[#d4af35]/60"
                                  value={pm.fee_rate ?? ''}
                                  onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, fee_rate: Number(e.target.value) } : m))}
                                />
                              </div>
                            </div>
                            <div className="mt-3">
                              <label className="block text-[#A1A1AA] text-xs mb-1">Instructions (Manual only)</label>
                              <textarea
                                className="w-full bg-[#141414] border border-[#333333] text-white px-3 py-2 rounded-md focus:outline-none focus:border-[#d4af35]/60 min-h-[70px]"
                                value={pm.instructions || ''}
                                onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, instructions: e.target.value } : m))}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Dice5 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">Game Configuration</h3>
                <p className="text-xs text-[#A1A1AA]">Gameplay mechanics and integrity settings</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <ToggleRow
                label="Live Dealer Games"
                value={settings.liveDealerGames}
                onChange={(v: boolean) => setSettings({ ...settings, liveDealerGames: v })}
                description="Enable real-time video streaming tables."
              />
              <ToggleRow
                label="Public RTP Stats"
                value={settings.publicRtpStats}
                onChange={(v: boolean) => setSettings({ ...settings, publicRtpStats: v })}
                description={"Show \"Return to Player\" percentages on game cards."}
              />
              <ToggleRow
                label="Auto-Kick Idle Players"
                value={settings.autoKickIdlePlayers}
                onChange={(v: boolean) => setSettings({ ...settings, autoKickIdlePlayers: v })}
                description={"Remove players inactive for >15 mins to save server load."}
              />
            </div>
          </div>

          {/* Bonuses */}
          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">Bonus &amp; Promotions</h3>
                <p className="text-xs text-[#A1A1AA]">Wagering and reward distribution logic</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <ToggleRow
                label="Enable Welcome Bonus"
                value={settings.welcomeBonusEnabled}
                onChange={(v: boolean) => setSettings({ ...settings, welcomeBonusEnabled: v })}
                description="Grant 100% match on first deposit up to $200."
              />
              <ToggleRow
                label="Wagering on Free Spins"
                value={settings.wageringOnFreeSpins}
                onChange={(v: boolean) => setSettings({ ...settings, wageringOnFreeSpins: v })}
                description="Winnings from free spins must be wagered 30x."
              />
              <ToggleRow
                label="Allow Bonus Stacking"
                value={settings.allowBonusStacking}
                onChange={(v: boolean) => setSettings({ ...settings, allowBonusStacking: v })}
                description="Users can activate multiple promo codes simultaneously."
              />
              <details className="px-4 pb-4 pt-2 border-t border-[#333333]">
                <summary className="cursor-pointer text-sm font-bold text-[#A1A1AA] select-none">Advanced</summary>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="Welcome Bonus (ETB)" value={settings.welcomeBonus} onChange={(e: any) => setSettings({ ...settings, welcomeBonus: e.target.value })} type="number" description="Bonus for new registrations" />
                  <InputRow label="Deposit Bonus (%)" value={settings.depositBonus} onChange={(e: any) => setSettings({ ...settings, depositBonus: e.target.value })} type="number" description="Bonus percentage on deposits" />
                  <InputRow label="Referral Bonus (ETB)" value={settings.referralBonus} onChange={(e: any) => setSettings({ ...settings, referralBonus: e.target.value })} type="number" description="Bonus for successful referrals" />
                  <InputRow label="Daily Streak Bonus (ETB)" value={settings.dailyStreakBonus} onChange={(e: any) => setSettings({ ...settings, dailyStreakBonus: e.target.value })} type="number" description="Bonus for daily login streaks" />
                </div>
              </details>
            </div>
          </div>

          {/* Security */}
          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">Security &amp; Access</h3>
                <p className="text-xs text-[#A1A1AA]">Platform integrity and geo-blocking</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <ToggleRow
                label="Require 2FA for Admins"
                value={settings.require2faForAdmins}
                onChange={(v: boolean) => setSettings({ ...settings, require2faForAdmins: v })}
                description="Mandatory two-factor auth for dashboard access."
              />
              <ToggleRow
                label="Block Restricted Jurisdictions"
                value={settings.blockRestrictedJurisdictions}
                onChange={(v: boolean) => setSettings({ ...settings, blockRestrictedJurisdictions: v })}
                description="Auto-ban IPs from US, FR, and NL based on GeoIP."
              />
              <ToggleRow
                label="Suspicious Activity Alerts"
                value={settings.suspiciousActivityAlerts}
                onChange={(v: boolean) => setSettings({ ...settings, suspiciousActivityAlerts: v })}
                description="Email admins on high-risk withdrawal patterns."
              />

              <details className="px-4 pb-4 pt-2 border-t border-[#333333]">
                <summary className="cursor-pointer text-sm font-bold text-[#A1A1AA] select-none">Advanced</summary>
                <div className="mt-4 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-white font-bold">Notifications</h4>
                    <ToggleRow
                      label="Email Notifications"
                      value={settings.emailNotifications}
                      onChange={(v: boolean) => setSettings({ ...settings, emailNotifications: v })}
                      description="Send email notifications to users"
                    />
                    <ToggleRow
                      label="Telegram Notifications"
                      value={settings.telegramNotifications}
                      onChange={(v: boolean) => setSettings({ ...settings, telegramNotifications: v })}
                      description="Send Telegram notifications to users"
                    />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-white font-bold">Support</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputRow label="Support Email" value={settings.supportEmail} onChange={(e: any) => setSettings({ ...settings, supportEmail: e.target.value })} type="email" description="Email for support inquiries" />
                      <InputRow label="Support Telegram" value={settings.supportTelegram} onChange={(e: any) => setSettings({ ...settings, supportTelegram: e.target.value })} description="Telegram handle for support (@username)" />
                      <InputRow label="Support Phone" value={settings.supportPhone} onChange={(e: any) => setSettings({ ...settings, supportPhone: e.target.value })} type="tel" description="Phone number for support" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-white font-bold">Withdrawal Security</h4>
                    <ToggleRow
                      label="Require OTP On Withdrawal"
                      value={settings.requireOtpOnWithdrawal}
                      onChange={(v: boolean) => setSettings({ ...settings, requireOtpOnWithdrawal: v })}
                      description="When enabled, users must verify an OTP code to submit a withdrawal."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputRow label="IP Withdraw Max Requests / Minute" value={settings.ipWithdrawMaxPerMin} onChange={(e: any) => setSettings({ ...settings, ipWithdrawMaxPerMin: e.target.value })} type="number" description="Maximum number of withdrawal requests allowed per IP within the window." />
                      <InputRow label="IP Withdraw Window (seconds)" value={settings.ipWithdrawWindowSeconds} onChange={(e: any) => setSettings({ ...settings, ipWithdrawWindowSeconds: e.target.value })} type="number" description="Time window used for per-IP withdrawal throttling." />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-white font-bold">Admin &amp; Whitelist</h4>
                    <SecurityTab
                      isSuperAdmin={isSuperAdmin}
                      bypassEnabled={bypassEnabled}
                      setBypass={setBypass}
                      wlUserIds={wlUserIds}
                      wlTgIds={wlTgIds}
                      wlUsernames={wlUsernames}
                      wlSearchTerm={wlSearchTerm}
                      setWlSearchTerm={setWlSearchTerm}
                      wlResults={wlResults}
                      searchWhitelistUsers={searchWhitelistUsers}
                      addToWhitelist={addToWhitelist}
                      removeFromWhitelist={removeFromWhitelist}
                      saveWhitelist={saveWhitelist}
                      wlSaving={wlSaving}
                      admins={admins}
                      loadingAdmins={loadingAdmins}
                      newAdmin={newAdmin}
                      setNewAdmin={setNewAdmin}
                      setAdmins={setAdmins}
                      createAdmin={createAdmin}
                      updateAdmin={updateAdmin}
                      admin={admin}
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* System Settings */}
          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">System Settings</h3>
                <p className="text-xs text-[#A1A1AA]">Core platform options and integrations</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <InputRow
                label="Site Name"
                value={settings.siteName}
                onChange={(e: any) => setSettings({ ...settings, siteName: e.target.value })}
                description="Your application name"
              />
              <ToggleRow
                label="Maintenance Mode"
                value={settings.maintenanceMode}
                onChange={(v: boolean) => setSettings({ ...settings, maintenanceMode: v })}
                description="Disable user access to the platform"
              />
              {settings.maintenanceMode && (
                <InputRow
                  label="Maintenance Message"
                  value={settings.maintenanceMessage}
                  onChange={(e: any) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  description="Message shown to users during maintenance"
                />
              )}
              <ToggleRow
                label="Registration Enabled"
                value={settings.registrationEnabled}
                onChange={(v: boolean) => setSettings({ ...settings, registrationEnabled: v })}
                description="Allow new users to register"
              />
              <ToggleRow
                label="Require Telegram Channel Join"
                value={settings.requireChannelJoin}
                onChange={(v: boolean) => setSettings({ ...settings, requireChannelJoin: v })}
                description="Ask users to join your Telegram channel before playing (ignored in development)"
              />
              <details className="px-4 pb-4 pt-2 border-t border-[#333333]">
                <summary className="cursor-pointer text-sm font-bold text-[#A1A1AA] select-none">Advanced</summary>
                <div className="mt-4 space-y-4">
                  <InputRow
                    label="Socket URL"
                    value={settings.socketUrl}
                    onChange={(e: any) => setSettings({ ...settings, socketUrl: e.target.value })}
                    description="WebSocket server URL for real-time updates"
                  />
                  <InputRow
                    label="Telegram Bot Token"
                    value={settings.telegramBotToken}
                    onChange={(e: any) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                    type="password"
                    description="Your Telegram bot token (keep secret)"
                  />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-white font-bold">Game Rules (Lobby Modal)</h4>
                        <p className="text-xs text-[#A1A1AA] mt-1">
                          Value must be JSON: an array of objects with <code className="font-mono">title</code> and <code className="font-mono">body</code>.
                        </p>
                      </div>
                      {rulesLoading && (
                        <span className="text-[11px] text-[#A1A1AA]">Loading…</span>
                      )}
                    </div>
                    <textarea
                      value={rulesText}
                      onChange={(e) => setRulesText(e.target.value)}
                      className="w-full h-48 bg-[#141414] border border-[#333333] rounded-lg p-3 text-xs text-white font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[#d4af35] focus:border-[#d4af35]"
                      spellCheck={false}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveRules}
                        disabled={rulesSaving || rulesLoading || !canManage}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                          rulesSaving || rulesLoading || !canManage
                            ? 'bg-[#252525] text-[#666666] border-[#333333] cursor-not-allowed'
                            : 'bg-[#d4af35] hover:bg-[#c29d2b] text-[#1C1C1C] border-[#d4af35]'
                        }`}
                      >
                        {rulesSaving ? 'Saving Rules…' : 'Save Rules'}
                      </button>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Tournament Engine */}
          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">Tournament Engine</h3>
                <p className="text-xs text-[#A1A1AA]">Competition structure and logic</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <ToggleRow
                label="Global Leaderboard"
                value={settings.globalLeaderboard}
                onChange={(v: boolean) => setSettings({ ...settings, globalLeaderboard: v })}
                description="Display top 100 players across all games."
              />
              <ToggleRow
                label="Allow Late Registration"
                value={settings.allowLateRegistration}
                onChange={(v: boolean) => setSettings({ ...settings, allowLateRegistration: v })}
                description="Players can join up to 15 mins after start."
              />
            </div>
          </div>

          {/* Admin Permissions */}
          <div className="bg-[#252525] rounded-xl border border-[#333333] shadow-lg overflow-hidden group">
            <div className="p-6 border-b border-[#333333] flex items-center gap-3 bg-[#2a2a2a]">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-lg font-bold">Admin Permissions</h3>
                <p className="text-xs text-[#A1A1AA]">Sub-admin and moderator capabilities</p>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <ToggleRow
                label="Moderators Can Ban Users"
                value={settings.moderatorsCanBanUsers}
                onChange={(v: boolean) => setSettings({ ...settings, moderatorsCanBanUsers: v })}
                description="Allow Level 2 moderators to issue permabans."
              />
              <ToggleRow
                label="Support Can View Wallets"
                value={settings.supportCanViewWallets}
                onChange={(v: boolean) => setSettings({ ...settings, supportCanViewWallets: v })}
                description="Allow support staff to see user balances."
              />
            </div>
          </div>
        </div>
      </div>
  
    </AdminShell>
  
  )

}
