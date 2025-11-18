'use client'

import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import ProfessionalDashboard from './dashboard'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAdminAuth()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/mgmt-portal-x7k9p2/login')
    }
  }, [authLoading, isAuthenticated, router])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <ProfessionalDashboard />
}
