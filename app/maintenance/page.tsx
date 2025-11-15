"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getConfig } from '@/lib/admin-config'
import { supabase } from '@/lib/supabase'

export default function MaintenancePage() {
  const router = useRouter()
  const [maintenanceMessage, setMaintenanceMessage] = useState('System under maintenance. Please try again later.')
  const [appName, setAppName] = useState('BingoX')
  const [supportEmail, setSupportEmail] = useState('support@bingox.com')
  const [supportTelegram, setSupportTelegram] = useState('@bingox_support')
  const [isRedirecting, setIsRedirecting] = useState(false)

  const checkMaintenanceStatus = async () => {
    try {
      const maintenanceMode = await getConfig('maintenance_mode')
      
      // If maintenance mode is disabled, redirect user
      if (!maintenanceMode || maintenanceMode === false) {
        console.log('Maintenance mode disabled, redirecting user...')
        setIsRedirecting(true)
        
        // Small delay for smooth transition
        setTimeout(async () => {
          // Check if user is logged in
          const { data: { user } } = await supabase.auth.getUser()
          
          if (user) {
            // User is logged in, redirect to lobby
            router.push('/lobby')
          } else {
            // User is not logged in, redirect to home page
            router.push('/')
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Error checking maintenance status:', error)
    }
  }

  const fetchConfig = async () => {
    try {
      const message = await getConfig('maintenance_message')
      const name = await getConfig('app_name')
      const email = await getConfig('support_email')
      const telegram = await getConfig('telegram_support')
      
      if (message) setMaintenanceMessage(message)
      if (name) setAppName(name)
      if (email) setSupportEmail(email)
      if (telegram) setSupportTelegram(telegram)
    } catch (error) {
      console.error('Error fetching maintenance config:', error)
    }
  }

  useEffect(() => {
    // Initial config fetch
    fetchConfig()
    
    // Initial maintenance check
    checkMaintenanceStatus()
    
    // Set up interval to check maintenance status every 10 seconds
    const maintenanceCheckInterval = setInterval(checkMaintenanceStatus, 10000)
    
    // Set up interval to refresh config every 30 seconds
    const configRefreshInterval = setInterval(fetchConfig, 30000)
    
    // Cleanup intervals on component unmount
    return () => {
      clearInterval(maintenanceCheckInterval)
      clearInterval(configRefreshInterval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>

        {/* App Name */}
        <h1 className="text-3xl font-bold text-white mb-4">{appName}</h1>

        {/* Maintenance Icon */}
        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Maintenance Message */}
        <h2 className="text-2xl font-bold text-white mb-4">Under Maintenance</h2>
        <h2 className="text-2xl font-bold text-white mb-4">በ ጥገና ላይ</h2>
        <p className="text-gray-300 mb-8 leading-relaxed">
          {maintenanceMessage}
        </p>

        {/* Animated Loading */}
        <div className="flex justify-center items-center gap-2 mb-4">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {/* Auto-refresh indicator */}
        <div className="text-xs text-gray-400 mb-8 flex items-center justify-center gap-2">
          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{isRedirecting ? 'Redirecting you...' : 'Checking for updates...'}</span>
        </div>

        {/* Redirecting message */}
        {isRedirecting && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-300 font-medium">Maintenance completed! Taking you back...</span>
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Need Help?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-center gap-2 text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{supportEmail}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{supportTelegram}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
