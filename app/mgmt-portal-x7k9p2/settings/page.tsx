"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    siteName: 'Bingo Royale',
    maintenanceMode: false,
    registrationEnabled: true,
    minWithdrawal: 100,
    maxWithdrawal: 100000,
    withdrawalFee: 0,
    commissionRate: 10,
    depositBonus: 10,
    referralBonus: 50,
    dailyStreakBonus: 20,
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

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')

      if (error) throw error

      const settingsObj: any = {}
      data?.forEach((setting) => {
        let value = setting.value
        // Parse boolean values
        if (value === 'true') value = true
        if (value === 'false') value = false
        // Parse numbers
        if (!isNaN(value) && value !== '') value = parseFloat(value)
        settingsObj[setting.key] = value
      })
      
      setSettings(prev => ({ ...prev, ...settingsObj }))
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Update each setting in the database
      for (const [key, value] of Object.entries(settings)) {
        await supabase
          .from('system_settings')
          .upsert({ 
            key, 
            value: String(value),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          })
      }

      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
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
              <h1 className="text-2xl font-bold text-white">⚙️ System Settings</h1>
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
                <>💾 Save Changes</>
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
                  value={settings.minWithdrawal}
                  onChange={(e) => setSettings({...settings, minWithdrawal: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Withdrawal (ETB)</label>
                <input
                  type="number"
                  value={settings.maxWithdrawal}
                  onChange={(e) => setSettings({...settings, maxWithdrawal: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Withdrawal Fee (%)</label>
                <input
                  type="number"
                  value={settings.withdrawalFee}
                  onChange={(e) => setSettings({...settings, withdrawalFee: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Game Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.commissionRate}
                  onChange={(e) => setSettings({...settings, commissionRate: parseFloat(e.target.value)})}
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Deposit Bonus (%)</label>
                <input
                  type="number"
                  value={settings.depositBonus}
                  onChange={(e) => setSettings({...settings, depositBonus: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Referral Bonus (ETB)</label>
                <input
                  type="number"
                  value={settings.referralBonus}
                  onChange={(e) => setSettings({...settings, referralBonus: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Daily Streak Bonus (ETB)</label>
                <input
                  type="number"
                  value={settings.dailyStreakBonus}
                  onChange={(e) => setSettings({...settings, dailyStreakBonus: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Support Contact Settings */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-bold text-white mb-6">📧 Support Contact Information</h2>
            
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
