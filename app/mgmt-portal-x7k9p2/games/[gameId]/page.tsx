"use client"

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function AdminGameViewer() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const gameId = params?.gameId as string

  useEffect(() => {
    if (!gameId) return
    const view = searchParams?.get('view')
    const qs = new URLSearchParams({ gameId: String(gameId) })
    if (view) qs.set('view', view)
    router.replace(`/mgmt-portal-x7k9p2/live-monitor?${qs.toString()}`)
  }, [gameId, router, searchParams])

  return null
}
