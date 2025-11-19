import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function POST(request: Request) {
  try {
    const { userId, deviceHash } = await request.json()

    if (!userId || !deviceHash) {
      return NextResponse.json({ error: 'userId and deviceHash are required' }, { status: 400 })
    }

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const ip = (forwarded.split(',')[0] || '').trim() ||
               request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-real-ip') ||
               ''

    const { error } = await supabase.rpc('register_device', {
      p_user_id: userId,
      p_device_hash: deviceHash,
      p_ip: ip,
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to register device' }, { status: 500 })
  }
}
