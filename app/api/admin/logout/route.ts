import { NextRequest, NextResponse } from 'next/server'
import { destroyAdminSession } from '@/lib/server/admin-session'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const baseResponse = NextResponse.json({ success: true })
  const response = await destroyAdminSession(baseResponse, request)
  return response
}
