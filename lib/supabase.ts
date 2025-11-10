// Supabase Configuration
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client (for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  },
  db: {
    schema: 'public'
  }
})

// Server-side Supabase client (for API routes and bot)
const supabaseServiceKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase // Fallback to regular client if service key not available

// Database types
export interface User {
  id: string
  telegram_id: number
  username: string
  balance: number
  games_played: number
  games_won: number
  total_winnings: number
  created_at: string
}

export interface Game {
  id: string
  room_id: string
  status: 'countdown' | 'active' | 'finished'
  countdown_time: number
  players: string[]
  bots: string[]
  called_numbers: number[]
  latest_number: { letter: string; number: number } | null
  stake: number
  prize_pool: number
  winner_id: string | null
  started_at: string
  ended_at: string | null
}

export interface Room {
  id: string
  name: string
  stake: number
  max_players: number
  current_players: number
  status: 'active' | 'waiting'
  current_game_id: string | null
  description: string
  color: string
}

export interface Transaction {
  id: string
  user_id: string
  type: 'stake' | 'win' | 'deposit' | 'withdrawal'
  amount: number
  game_id: string | null
  created_at: string
}

export interface Leaderboard {
  user_id: string
  username: string
  total_wins: number
  total_winnings: number
  rank: number
  updated_at: string
}
