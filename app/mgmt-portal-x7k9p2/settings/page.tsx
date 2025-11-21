"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAllConfig, getConfig, setConfig } from '@/lib/admin-config'
import { useLocalStorage } from '@/lib/hooks/usePageState'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { Settings, DollarSign, Gift, Bell, Users, Lock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { SecurityTab } from './security-tab'

type TabType = 'system' | 'financial' | 'bonuses' | 'notifications' | 'support' | 'security'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useLocalStorage<TabType>('settings_active_tab', 'system')
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

  // Load admins when opening Security tab
  useEffect(() => {
    if (activeTab === 'security' && isSuperAdmin) {
      loadAdmins()
    }
  }, [activeTab, isSuperAdmin])

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

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'system', label: 'System', icon: Settings },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'bonuses', label: 'Bonuses', icon: Gift },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'support', label: 'Support', icon: Users },
    { id: 'security', label: 'Security', icon: Lock },
  ]

  const SettingInput = ({ label, value, onChange, type = 'text', description }: any) => (
    <div>
      <label className="block text-slate-300 text-sm font-medium mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full bg-slate-700/50 border border-slate-600 text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors"
      />
      {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
    </div>
  )

  const SettingToggle = ({ label, value, onChange, description }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg border border-slate-700">
      <div>
        <p className="text-slate-300 font-medium">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-emerald-600' : 'bg-slate-600'
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  )

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

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Loading…</div>
  if (!isAuthenticated || !canView) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">403 - Forbidden</h1>
          <p className="text-slate-400">You do not have permission to access Settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 animate-in fade-in slide-in-from-top ${
          notification.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link href="/mgmt-portal-x7k9p2" className="flex items-center justify-center w-10 h-10 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-all hover:scale-110">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">Settings</h1>
                <p className="text-slate-400 text-sm mt-1">Configure system, financial, and security settings</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              {hasChanges && (
                <button
                  onClick={() => {
                    setSettings(originalSettings)
                    showNotification('error', 'Changes discarded')
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-6 py-2.5 rounded-lg font-semibold transition-colors"
                >
                  Discard
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || !canManage}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  hasChanges && !isSaving && canManage
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
                title={!canManage ? 'You do not have permission to modify settings' : ''}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-6 sm:mb-8 bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-1 sm:p-2 overflow-x-auto">
          {tabs.map((tab) => {
            const IconComponent = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-base ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-6 sm:p-8">
          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">System Settings</h2>
              </div>
              <SettingInput
                label="Site Name"
                value={settings.siteName}
                onChange={(e: any) => setSettings({ ...settings, siteName: e.target.value })}
                description="Your application name"
              />
              <SettingToggle
                label="Maintenance Mode"
                value={settings.maintenanceMode}
                onChange={(value: boolean) => setSettings({ ...settings, maintenanceMode: value })}
                description="Disable user access to the platform"
              />
              {settings.maintenanceMode && (
                <SettingInput
                  label="Maintenance Message"
                  value={settings.maintenanceMessage}
                  onChange={(e: any) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  description="Message shown to users during maintenance"
                />
              )}
              <SettingToggle
                label="Registration Enabled"
                value={settings.registrationEnabled}
                onChange={(value: boolean) => setSettings({ ...settings, registrationEnabled: value })}
                description="Allow new users to register"
              />
              <SettingToggle
                label="Require Telegram Channel Join"
                value={settings.requireChannelJoin}
                onChange={(value: boolean) => setSettings({ ...settings, requireChannelJoin: value })}
                description="Ask users to join your Telegram channel before playing (ignored in development)"
              />
              <SettingInput
                label="Socket URL"
                value={settings.socketUrl}
                onChange={(e: any) => setSettings({ ...settings, socketUrl: e.target.value })}
                description="WebSocket server URL for real-time updates"
              />
              <SettingInput
                label="Telegram Bot Token"
                value={settings.telegramBotToken}
                onChange={(e: any) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                type="password"
                description="Your Telegram bot token (keep secret)"
              />
              {/* Game Rules Editor */}
              <div className="mt-8 pt-6 border-t border-slate-700 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Game Rules (Lobby Modal)</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Edit the rules shown to players when they tap the <span className="font-semibold">Rules</span> button in the lobby.
                      Value must be JSON: an array of objects with <code className="font-mono">title</code> and <code className="font-mono">body</code>.
                    </p>
                  </div>
                  {rulesLoading && (
                    <span className="text-[11px] text-slate-400">Loading…</span>
                  )}
                </div>
                <textarea
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  className="w-full h-48 bg-slate-900/40 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60"
                  spellCheck={false}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveRules}
                    disabled={rulesSaving || rulesLoading || !canManage}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                      rulesSaving || rulesLoading || !canManage
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {rulesSaving ? 'Saving Rules…' : 'Save Rules'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Financial Settings */}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Financial Settings</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SettingInput
                  label="Min Withdrawal (ETB)"
                  value={settings.minWithdrawal}
                  onChange={(e: any) => setSettings({ ...settings, minWithdrawal: e.target.value })}
                  type="number"
                  description="Minimum withdrawal amount"
                />
                <SettingInput
                  label="Max Withdrawal (ETB)"
                  value={settings.maxWithdrawal}
                  onChange={(e: any) => setSettings({ ...settings, maxWithdrawal: e.target.value })}
                  type="number"
                  description="Maximum withdrawal amount"
                />
                <SettingInput
                  label="Withdrawal Fee (%)"
                  value={settings.withdrawalFee}
                  onChange={(e: any) => setSettings({ ...settings, withdrawalFee: e.target.value })}
                  type="number"
                  description="Fee charged on withdrawals"
                />
                <SettingInput
                  label="Min Deposit (ETB)"
                  value={settings.minRequiredDeposit}
                  onChange={(e: any) => setSettings({ ...settings, minRequiredDeposit: e.target.value })}
                  type="number"
                  description="Minimum deposit amount"
                />
                <SettingInput
                  label="Min Deposit to Unlock Bonus Wins (ETB)"
                  value={settings.minDepositToUnlock}
                  onChange={(e: any) => setSettings({ ...settings, minDepositToUnlock: e.target.value })}
                  type="number"
                  description="Minimum first deposit required before locked bonus winnings convert to real balance. 0 = unlock on any first deposit."
                />
                <SettingInput
                  label="Max Deposit (ETB)"
                  value={settings.depositMax}
                  onChange={(e: any) => setSettings({ ...settings, depositMax: e.target.value })}
                  type="number"
                  description="Maximum deposit amount"
                />
                <SettingInput
                  label="Daily Withdrawal Limit (ETB)"
                  value={settings.dailyWithdrawalLimit}
                  onChange={(e: any) => setSettings({ ...settings, dailyWithdrawalLimit: e.target.value })}
                  type="number"
                  description="Max withdrawal per day"
                />
                <SettingInput
                  label="Weekly Withdrawal Limit (ETB)"
                  value={settings.weeklyWithdrawalLimit}
                  onChange={(e: any) => setSettings({ ...settings, weeklyWithdrawalLimit: e.target.value })}
                  type="number"
                  description="Max withdrawal per week"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-700">
                <SettingInput
                  label="Commission Rate (%)"
                  value={settings.commissionRate}
                  onChange={(e: any) => setSettings({ ...settings, commissionRate: e.target.value })}
                  type="number"
                  description="Platform commission on games"
                />
                <SettingInput
                  label="Deposit Fee (%)"
                  value={settings.depositFee}
                  onChange={(e: any) => setSettings({ ...settings, depositFee: e.target.value })}
                  type="number"
                  description="Fee applied to deposits (for reporting/charges)"
                />
              </div>
              {/* Payment Methods Management */}
              <div className="pt-6 border-t border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-lg">Payment Methods</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadPaymentMethods}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
                      disabled={pmLoading}
                    >
                      {pmLoading ? 'Loading…' : 'Reload'}
                    </button>
                    <button
                      onClick={savePaymentMethods}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                      disabled={pmLoading}
                    >
                      Save Methods
                    </button>
                  </div>
                </div>
                {paymentMethods.length === 0 ? (
                  <div className="text-slate-400 text-sm">No methods configured.</div>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((pm, idx) => (
                      <div key={pm.id || pm.name || idx} className="p-4 rounded-lg border border-slate-700 bg-slate-800/40">
                        <div className="flex items-center justify-between">
                          <div className="text-white font-semibold">{pm.name}</div>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-xs">Enabled</span>
                            <button
                              onClick={() => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, enabled: !m.enabled } : m))}
                              className={`relative w-12 h-6 rounded-full transition-colors ${pm.enabled ? 'bg-emerald-600' : 'bg-slate-600'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${pm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-slate-400 text-xs mb-1">Min Amount (ETB)</label>
                            <input
                              type="number"
                              className="w-full bg-slate-900/50 border border-slate-700 text-white px-3 py-2 rounded-md focus:outline-none focus:border-emerald-500/50"
                              value={pm.min_amount ?? ''}
                              onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, min_amount: Number(e.target.value) } : m))}
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1">Max Amount (ETB)</label>
                            <input
                              type="number"
                              className="w-full bg-slate-900/50 border border-slate-700 text-white px-3 py-2 rounded-md focus:outline-none focus:border-emerald-500/50"
                              value={pm.max_amount ?? ''}
                              onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, max_amount: Number(e.target.value) } : m))}
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1">Fee Rate (%)</label>
                            <input
                              type="number"
                              className="w-full bg-slate-900/50 border border-slate-700 text-white px-3 py-2 rounded-md focus:outline-none focus:border-emerald-500/50"
                              value={pm.fee_rate ?? ''}
                              onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, fee_rate: Number(e.target.value) } : m))}
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-slate-400 text-xs mb-1">Instructions (Manual only)</label>
                          <textarea
                            className="w-full bg-slate-900/50 border border-slate-700 text-white px-3 py-2 rounded-md focus:outline-none focus:border-emerald-500/50 min-h-[70px]"
                            value={pm.instructions || ''}
                            onChange={(e) => setPaymentMethods(ms => ms.map(m => m === pm ? { ...m, instructions: e.target.value } : m))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-700">
                <SettingToggle
                  label="Auto-Approve Deposits"
                  value={settings.autoApproveDeposits}
                  onChange={(value: boolean) => setSettings({ ...settings, autoApproveDeposits: value })}
                  description="Automatically approve deposit requests"
                />
                <SettingToggle
                  label="Auto-Approve Withdrawals"
                  value={settings.autoApproveWithdrawals}
                  onChange={(value: boolean) => setSettings({ ...settings, autoApproveWithdrawals: value })}
                  description="Automatically approve withdrawal requests"
                />
              </div>
            </div>
          )}

          {/* Bonuses */}
          {activeTab === 'bonuses' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Bonus Settings</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SettingInput
                  label="Welcome Bonus (ETB)"
                  value={settings.welcomeBonus}
                  onChange={(e: any) => setSettings({ ...settings, welcomeBonus: e.target.value })}
                  type="number"
                  description="Bonus for new registrations"
                />
                <SettingInput
                  label="Deposit Bonus (%)"
                  value={settings.depositBonus}
                  onChange={(e: any) => setSettings({ ...settings, depositBonus: e.target.value })}
                  type="number"
                  description="Bonus percentage on deposits"
                />
                <SettingInput
                  label="Referral Bonus (ETB)"
                  value={settings.referralBonus}
                  onChange={(e: any) => setSettings({ ...settings, referralBonus: e.target.value })}
                  type="number"
                  description="Bonus for successful referrals"
                />
                <SettingInput
                  label="Daily Streak Bonus (ETB)"
                  value={settings.dailyStreakBonus}
                  onChange={(e: any) => setSettings({ ...settings, dailyStreakBonus: e.target.value })}
                  type="number"
                  description="Bonus for daily login streaks"
                />
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Notification Settings</h2>
              </div>
              <SettingToggle
                label="Email Notifications"
                value={settings.emailNotifications}
                onChange={(value: boolean) => setSettings({ ...settings, emailNotifications: value })}
                description="Send email notifications to users"
              />
              <SettingToggle
                label="Telegram Notifications"
                value={settings.telegramNotifications}
                onChange={(value: boolean) => setSettings({ ...settings, telegramNotifications: value })}
                description="Send Telegram notifications to users"
              />
            </div>
          )}

          {/* Support */}
          {activeTab === 'support' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Support Settings</h2>
              </div>
              <SettingInput
                label="Support Email"
                value={settings.supportEmail}
                onChange={(e: any) => setSettings({ ...settings, supportEmail: e.target.value })}
                type="email"
                description="Email for support inquiries"
              />
              <SettingInput
                label="Support Telegram"
                value={settings.supportTelegram}
                onChange={(e: any) => setSettings({ ...settings, supportTelegram: e.target.value })}
                description="Telegram handle for support (@username)"
              />
              <SettingInput
                label="Support Phone"
                value={settings.supportPhone}
                onChange={(e: any) => setSettings({ ...settings, supportPhone: e.target.value })}
                type="tel"
                description="Phone number for support"
              />
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <>
              {/* Withdrawal Security Controls */}
              <div className="space-y-6 mb-6">
                <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 sm:p-8 shadow-xl">
                  <h3 className="text-2xl font-bold text-white mb-2">Withdrawal Security</h3>
                  <p className="text-slate-400 mb-6">Protect withdrawals with OTP and per-IP rate limits.</p>
                  <div className="space-y-6">
                    <SettingToggle
                      label="Require OTP On Withdrawal"
                      value={settings.requireOtpOnWithdrawal}
                      onChange={(value: boolean) => setSettings({ ...settings, requireOtpOnWithdrawal: value })}
                      description="When enabled, users must verify an OTP code to submit a withdrawal."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <SettingInput
                        label="IP Withdraw Max Requests / Minute"
                        value={settings.ipWithdrawMaxPerMin}
                        onChange={(e: any) => setSettings({ ...settings, ipWithdrawMaxPerMin: e.target.value })}
                        type="number"
                        description="Maximum number of withdrawal requests allowed per IP within the window."
                      />
                      <SettingInput
                        label="IP Withdraw Window (seconds)"
                        value={settings.ipWithdrawWindowSeconds}
                        onChange={(e: any) => setSettings({ ...settings, ipWithdrawWindowSeconds: e.target.value })}
                        type="number"
                        description="Time window used for per-IP withdrawal throttling."
                      />
                    </div>
                    <p className="text-xs text-slate-500">Use the Save Changes button at the top to persist these settings.</p>
                  </div>
                </div>
              </div>

              {/* Existing Security Sections */}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
