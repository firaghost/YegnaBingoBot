"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BotStatsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mgmt-portal-x7k9p2/bots/stats') }, [router])
  return null
}
