"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAllConfig, setConfig } from '@/lib/admin-config'

type TabType = 'system' | 'financial' | 'bonuses' | 'notifications' | 'support' | 'security'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('system')
  const [settings, setSettings] = useState({
    siteName: 'BingoX',
    maintenanceMode: false,
    maintenanceMessage: 'System under maintenance. Please try again later.',
    registrationEnabled: true,
    minWithdrawal: 100 as number | string,
    maxWithdrawal: 100000 as number | string,
    withdrawalFee: 0 as number | string,
    minRequiredDeposit: 50 as number | string,
    dailyWithdrawalLimit: 5000 as number | string,
    weeklyWithdrawalLimit: 2000 as number | string,
    commissionRate: 10 as number | string,
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

  const [originalSettings, setOriginalSettings] = useState(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

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
          minWithdrawal: Number(config.minWithdrawalAmount) || 100,
          maxWithdrawal: Number(config.maxWithdrawalAmount) || 100000,
          withdrawalFee: Math.round((Number(config.withdrawalFeeRate) || 0) * 100 * 100) / 100,
          commissionRate: Math.round((Number(config.gameCommissionRate) || 0.1) * 100 * 100) / 100,
          minRequiredDeposit: Number(config.minRequiredDeposit) || 50,
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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const changedSettings: { [key: string]: any } = {}
      
      if (settings.siteName !== originalSettings.siteName) changedSettings.app_name = settings.siteName
      if (Boolean(settings.maintenanceMode) !== Boolean(originalSettings.maintenanceMode)) changedSettings.maintenance_mode = Boolean(settings.maintenanceMode)
      if (settings.maintenanceMessage !== originalSettings.maintenanceMessage) changedSettings.maintenance_message = settings.maintenanceMessage
      if (Boolean(settings.registrationEnabled) !== Boolean(originalSettings.registrationEnabled)) changedSettings.registration_enabled = Boolean(settings.registrationEnabled)
      if (Number(settings.minWithdrawal) !== Number(originalSettings.minWithdrawal)) changedSettings.min_withdrawal_amount = Number(settings.minWithdrawal) || 0
      if (Number(settings.maxWithdrawal) !== Number(originalSettings.maxWithdrawal)) changedSettings.max_withdrawal_amount = Number(settings.maxWithdrawal) || 0
      if (Number(settings.withdrawalFee) !== Number(originalSettings.withdrawalFee)) changedSettings.withdrawal_fee_rate = (Number(settings.withdrawalFee) || 0) / 100
      if (Number(settings.commissionRate) !== Number(originalSettings.commissionRate)) changedSettings.game_commission_rate = (Number(settings.commissionRate) || 0) / 100
      if (Number(settings.minRequiredDeposit) !== Number(originalSettings.minRequiredDeposit)) changedSettings.min_required_deposit = Number(settings.minRequiredDeposit) || 0
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

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'system', label: 'System', icon: '⚙️' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'bonuses', label: 'Bonuses', icon: '🎁' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'support', label: 'Support', icon: '👥' },
    { id: 'security', label: 'Security', icon: '🔒' },
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
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-slate-400 text-sm mt-1">Configure system, financial, and security settings</p>
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
                disabled={!hasChanges || isSaving}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  hasChanges && !isSaving
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? '💾 Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-6 sm:mb-8 bg-slate-800/50 backdrop-blur-md rounded-lg border border-slate-700/50 p-1 sm:p-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-base ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
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
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Security Settings</h2>
              </div>
              <SettingToggle
                label="Require OTP on Withdrawal"
                value={settings.requireOtpOnWithdrawal}
                onChange={(value: boolean) => setSettings({ ...settings, requireOtpOnWithdrawal: value })}
                description="Require one-time password for withdrawals"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-700">
                <SettingInput
                  label="Max Withdrawals Per Minute (Per IP)"
                  value={settings.ipWithdrawMaxPerMin}
                  onChange={(e: any) => setSettings({ ...settings, ipWithdrawMaxPerMin: e.target.value })}
                  type="number"
                  description="Rate limit for withdrawals"
                />
                <SettingInput
                  label="Rate Limit Window (Seconds)"
                  value={settings.ipWithdrawWindowSeconds}
                  onChange={(e: any) => setSettings({ ...settings, ipWithdrawWindowSeconds: e.target.value })}
                  type="number"
                  description="Time window for rate limiting"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
