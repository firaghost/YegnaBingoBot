"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminBotsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/mgmt-portal-x7k9p2/bots') }, [router])
  return null
}
