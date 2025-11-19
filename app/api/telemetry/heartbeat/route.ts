import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupIp } from '@/lib/geoip'

const supabase = supabaseAdmin

export async function POST(request: NextRequest) {
  try {
    const { userId, eventKey } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const forwarded = request.headers.get('x-forwarded-for') || ''
    const ip = (forwarded.split(',')[0] || '').trim() ||
               request.headers.get('cf-connecting-ip') ||
               request.headers.get('x-real-ip') || ''

    const geo = await lookupIp(typeof ip === 'string' ? ip : '')

    // Update last seen
    await supabase
      .from('users')
      .update({
        last_seen_ip: ip || null,
        last_seen_city: geo?.city || null,
        last_seen_region: geo?.region || null,
        last_seen_country: geo?.country || null,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', userId)

    // If registration fields are empty, set them
    try {
      const { data: u } = await supabase
        .from('users')
        .select('id, registration_ip, registration_city')
        .eq('id', userId)
        .single()
      if (u && !u.registration_city) {
        await supabase
          .from('users')
          .update({
            registration_ip: ip || null,
            registration_city: geo?.city || null,
            registration_region: geo?.region || null,
            registration_country: geo?.country || null,
          })
          .eq('id', userId)
      }
    } catch {}

    // Log event
    await supabase.from('user_location_events').insert({
      user_id: userId,
      event_key: eventKey || 'app_heartbeat',
      ip: ip || null,
      city: geo?.city || null,
      region: geo?.region || null,
      country: geo?.country || null,
      latitude: geo?.latitude || null,
      longitude: geo?.longitude || null,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 })
  }
}
