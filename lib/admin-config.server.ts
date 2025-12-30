import { supabase } from './supabase.js'

// Cache for configuration values to avoid repeated DB calls
const configCache = new Map<string, { value: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export interface AdminConfig {
  // Game Configuration
  gameCommissionRate: number
  gameMinPlayers: number
  gameMaxPlayersEasy: number
  gameMaxPlayersMedium: number
  gameMaxPlayersHard: number
  gameWaitingTime: number
  gameCountdownTime: number
  gameCallIntervalEasy: number
  gameCallIntervalMedium: number
  gameCallIntervalHard: number

  // Stakes
  stakeEasy: number
  stakeMedium: number
  stakeHard: number
  prizePoolEasy: number
  prizePoolMedium: number
  prizePoolHard: number

  // Financial
  minDepositAmount: number
  maxDepositAmount: number
  minWithdrawalAmount: number
  maxWithdrawalAmount: number
  withdrawalFeeRate: number
  dailyWithdrawalLimit: number
  weeklyWithdrawalLimit: number
  minRequiredDeposit: number

  // Contact
  supportEmail: string
  supportPhone: string
  telegramSupport: string
  websiteUrl: string

  // App
  appName: string
  appVersion: string
  maintenanceMode: boolean
  maintenanceMessage: string
  welcomeBonus: number
  referralBonus: number

  // Bonus Settings
  depositBonus: number
  dailyStreakBonus: number
  dailyStreakDays: number

  // System Settings
  registrationEnabled: boolean
  autoApproveDeposits: boolean
  autoApproveWithdrawals: boolean
  emailNotifications: boolean
  telegramNotifications: boolean

  // API Settings
  telegramBotToken: string
  socketUrl: string

  // Rooms
  roomColors: Record<string, string>
  roomDescriptions: Record<string, string>

  // Anti-abuse / Security
  requireOtpOnWithdrawal?: boolean
  ipWithdrawMaxPerMin?: number
  ipWithdrawWindowSeconds?: number
}

/**
 * Get a single configuration value
 */
export async function getConfig(key: string): Promise<any> {
  // Check cache first
  const cached = configCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value
  }

  try {
    // Use direct database select only (skip functions for now)
    const { data: directData, error: selectError } = await supabase
      .from('admin_config')
      .select('config_value')
      .eq('config_key', key)
      .eq('is_active', true)
      .maybeSingle()

    if (selectError) {
      console.error('Direct select failed:', selectError)
      return null
    }

    if (!directData) {
      // Missing key is valid; treat as null
      configCache.set(key, { value: null, timestamp: Date.now() })
      return null
    }

    // Parse JSON value if it's a string
    let value = directData?.config_value
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {
        // Keep as string if not valid JSON
      }
    }

    // Cache the result
    configCache.set(key, { value, timestamp: Date.now() })
    return value
  } catch (error) {
    console.error('Error in getConfig:', error)
    return null
  }
}

/**
 * Set a configuration value (admin only)
 */
export async function setConfig(key: string, value: any, userId?: string): Promise<boolean> {
  try {
    // Use direct database insert only
    const { error: insertError } = await supabase
      .from('admin_config')
      .upsert({
        config_key: key,
        config_value: JSON.stringify(value),
        updated_by: userId || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      })

    if (insertError) {
      console.error('Failed to save config:', insertError)
      return false
    }

    // Clear cache for this key
    configCache.delete(key)
    configCache.clear()

    return true
  } catch (error) {
    console.error('Error in setConfig:', error)
    return false
  }
}

/**
 * Get all configuration values
 */
export async function getAllConfig(): Promise<Partial<AdminConfig>> {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('config_key, config_value')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching from admin_config:', error)
      return {}
    }

    const config: any = {}

    data.forEach((item: { config_key: string; config_value: any }) => {
      // Convert snake_case to camelCase
      const camelKey = item.config_key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase())

      // Parse JSON values
      let value = item.config_value
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {
          // Keep as string if not valid JSON
        }
      }

      config[camelKey] = value
    })

    return config
  } catch (error) {
    console.error('Error in getAllConfig:', error)
    return {}
  }
}

/**
 * Get game-specific configuration
 */
export async function getGameConfig(level: 'easy' | 'medium' | 'hard') {
  const config = await getAllConfig() as any

  const levelCap = level.charAt(0).toUpperCase() + level.slice(1)

  // Test overrides: allow speeding up waiting/countdown via env vars during tests
  const testWaitingEnv = process.env.TEST_WAITING_TIME
  const testCountdownEnv = process.env.TEST_COUNTDOWN_TIME
  const testWaiting = testWaitingEnv ? parseInt(testWaitingEnv, 10) : undefined
  const testCountdown = testCountdownEnv ? parseInt(testCountdownEnv, 10) : undefined

  return {
    stake: Number(config[`stake${levelCap}`]) || (level === 'easy' ? 5 : level === 'medium' ? 10 : 20),
    prizePool: Number(config[`prizePool${levelCap}`]) || (level === 'easy' ? 50 : level === 'medium' ? 100 : 200),
    maxPlayers: Number(config[`gameMaxPlayers${levelCap}`]) || (level === 'easy' ? 20 : level === 'medium' ? 15 : 10),
    minPlayers: Number(config.gameMinPlayers) || 2,
    waitingTime: (testWaiting ?? Number(config.gameWaitingTime)) || 30,
    countdownTime: (testCountdown ?? Number(config.gameCountdownTime)) || 10,
    callInterval: Number(config[`gameCallInterval${levelCap}`]) || (level === 'easy' ? 1000 : level === 'medium' ? 2000 : 3000),
    commissionRate: Number(config.gameCommissionRate) || 0.1
  }
}
