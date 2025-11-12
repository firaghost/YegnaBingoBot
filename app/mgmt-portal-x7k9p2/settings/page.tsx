"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAllConfig, setConfig } from '@/lib/admin-config'

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    siteName: 'BingoX',
    maintenanceMode: false,
    maintenanceMessage: 'System under maintenance. Please try again later.',
    registrationEnabled: true,
    minWithdrawal: 100 as number | string,
    maxWithdrawal: 100000 as number | string,
    withdrawalFee: 0 as number | string,
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
  })

  // Keep track of original settings to detect changes
  const [originalSettings, setOriginalSettings] = useState(settings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      // First try to get from new admin_config table
      const config = await getAllConfig()
      
      if (Object.keys(config).length > 0) {
        // Map new config keys to old settings format
        const mappedSettings = {
          siteName: config.appName || 'BingoX',
          maintenanceMode: config.maintenanceMode || false,
          maintenanceMessage: config.maintenanceMessage || 'System under maintenance. Please try again later.',
          registrationEnabled: config.registrationEnabled ?? true,
          minWithdrawal: Number(config.minWithdrawalAmount) || 100,
          maxWithdrawal: Number(config.maxWithdrawalAmount) || 100000,
          withdrawalFee: Math.round((Number(config.withdrawalFeeRate) || 0) * 100 * 100) / 100, // Convert to percentage with proper rounding
          commissionRate: Math.round((Number(config.gameCommissionRate) || 0.1) * 100 * 100) / 100, // Convert to percentage with proper rounding
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
        }
        
        setSettings(prev => ({ ...prev, ...mappedSettings }))
        setOriginalSettings(prev => ({ ...prev, ...mappedSettings }))
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Detect only changed settings
      const changedSettings: { [key: string]: any } = {}
      
      if (settings.siteName !== originalSettings.siteName) changedSettings.app_name = settings.siteName
      if (Boolean(settings.maintenanceMode) !== Boolean(originalSettings.maintenanceMode)) changedSettings.maintenance_mode = Boolean(settings.maintenanceMode)
      if (settings.maintenanceMessage !== originalSettings.maintenanceMessage) changedSettings.maintenance_message = settings.maintenanceMessage
      if (Boolean(settings.registrationEnabled) !== Boolean(originalSettings.registrationEnabled)) changedSettings.registration_enabled = Boolean(settings.registrationEnabled)
      if (Number(settings.minWithdrawal) !== Number(originalSettings.minWithdrawal)) changedSettings.min_withdrawal_amount = Number(settings.minWithdrawal) || 0
      if (Number(settings.maxWithdrawal) !== Number(originalSettings.maxWithdrawal)) changedSettings.max_withdrawal_amount = Number(settings.maxWithdrawal) || 0
      if (Number(settings.withdrawalFee) !== Number(originalSettings.withdrawalFee)) changedSettings.withdrawal_fee_rate = (Number(settings.withdrawalFee) || 0) / 100
      if (Number(settings.commissionRate) !== Number(originalSettings.commissionRate)) changedSettings.game_commission_rate = (Number(settings.commissionRate) || 0) / 100
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

      const changedCount = Object.keys(changedSettings).length
      
      if (changedCount === 0) {
        alert('No changes detected!')
        return
      }

      console.log(`Saving ${changedCount} changed settings:`, changedSettings)
      
      // Save only changed settings
      const results = []
      for (const [key, value] of Object.entries(changedSettings)) {
        results.push(await setConfig(key, value))
      }
      
      console.log('Save results:', results)
      const failedSaves = results.filter(result => result === false)
      if (failedSaves.length > 0) {
        throw new Error(`${failedSaves.length} settings failed to save`)
      }

      // Update original settings to current settings
      setOriginalSettings({ ...settings })

      // Clear cache to force refresh
      await new Promise(resolve => setTimeout(resolve, 100))
      
      alert(`Successfully saved ${changedCount} setting${changedCount > 1 ? 's' : ''}!`)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      alert(`Failed to save settings: ${error.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/mgmt-portal-x7k9p2" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-white">System Settings</h1>
              <p className="text-gray-400 text-sm">Configure system-wide settings</p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-all disabled:bg-gray-600 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">General Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Site Name</label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings({...settings, siteName: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-white">Maintenance Mode</div>
                  <div className="text-sm text-gray-400">Disable site for maintenance</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {settings.maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Maintenance Message</label>
                  <textarea
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings({...settings, maintenanceMessage: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Enter message to show during maintenance..."
                  />
                  <p className="text-xs text-gray-400 mt-1">This message will be displayed to users during maintenance</p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-white">Registration Enabled</div>
                  <div className="text-sm text-gray-400">Allow new user registrations</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.registrationEnabled}
                    onChange={(e) => setSettings({...settings, registrationEnabled: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Payment Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">Payment Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Min Withdrawal (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.minWithdrawal}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, minWithdrawal: ''})
                    } else {
                      setSettings({...settings, minWithdrawal: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum amount users can withdraw (supports decimals like 0.5)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Withdrawal (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.maxWithdrawal}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, maxWithdrawal: ''})
                    } else {
                      setSettings({...settings, maxWithdrawal: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Maximum amount users can withdraw per transaction</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Withdrawal Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.withdrawalFee}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, withdrawalFee: ''})
                    } else {
                      setSettings({...settings, withdrawalFee: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Percentage fee charged on withdrawals (0 = free withdrawals)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Game Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.commissionRate}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, commissionRate: ''})
                    } else {
                      setSettings({...settings, commissionRate: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Commission deducted from prize pool before awarding winner</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-white">Auto-Approve Deposits</div>
                  <div className="text-sm text-gray-400">Automatically approve deposits</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoApproveDeposits}
                    onChange={(e) => setSettings({...settings, autoApproveDeposits: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-white">Auto-Approve Withdrawals</div>
                  <div className="text-sm text-gray-400">Automatically approve withdrawals</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoApproveWithdrawals}
                    onChange={(e) => setSettings({...settings, autoApproveWithdrawals: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Bonus Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">Bonus Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Welcome Bonus (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.welcomeBonus}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, welcomeBonus: ''})
                    } else {
                      setSettings({...settings, welcomeBonus: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Bonus amount given to new users upon registration (supports decimals)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Deposit Bonus (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.depositBonus}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, depositBonus: ''})
                    } else {
                      setSettings({...settings, depositBonus: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Percentage bonus on deposits (0 = no bonus, 10 = 10% bonus)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Referral Bonus (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.referralBonus}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, referralBonus: ''})
                    } else {
                      setSettings({...settings, referralBonus: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Amount given for successful referrals (supports decimals)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Daily Streak Bonus (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.dailyStreakBonus}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setSettings({...settings, dailyStreakBonus: ''})
                    } else {
                      setSettings({...settings, dailyStreakBonus: parseFloat(value) || 0})
                    }
                  }}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Amount given for completing daily streaks (supports decimals)</p>
              </div>
            </div>
          </div>

          {/* Support Contact Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">Support Contact Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="support@bingox.com"
                />
                <p className="text-xs text-gray-400 mt-1">Email address shown to users for support</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Support Telegram</label>
                <input
                  type="text"
                  value={settings.supportTelegram}
                  onChange={(e) => setSettings({...settings, supportTelegram: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="@bingox_support"
                />
                <p className="text-xs text-gray-400 mt-1">Telegram username for support (include @)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Support Phone</label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({...settings, supportPhone: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="+251 911 234 567"
                />
                <p className="text-xs text-gray-400 mt-1">Phone number for support contact</p>
              </div>
            </div>
          </div>

          {/* API Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">API Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Telegram Bot Token</label>
                <input
                  type="password"
                  value={settings.telegramBotToken}
                  onChange={(e) => setSettings({...settings, telegramBotToken: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Socket.IO URL</label>
                <input
                  type="text"
                  value={settings.socketUrl}
                  onChange={(e) => setSettings({...settings, socketUrl: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-6">Notification Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-white">Email Notifications</div>
                  <div className="text-sm text-gray-400">Send email notifications</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <div className="font-medium text-white">Telegram Notifications</div>
                  <div className="text-sm text-gray-400">Send Telegram notifications</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.telegramNotifications}
                    onChange={(e) => setSettings({...settings, telegramNotifications: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
