import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// For client-side (browser) - use anon key with RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For server-side (API routes) - use service key to bypass RLS
export const supabaseAdmin = typeof window === 'undefined' 
  ? createClient(
      supabaseUrl, 
      process.env.SUPABASE_SERVICE_KEY || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : supabase;
