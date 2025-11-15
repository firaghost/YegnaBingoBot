import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const { data, error } = await supabaseAdmin.from('bots').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ bot: data })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const body = await req.json()
  const patch: any = {}
  if (typeof body.name === 'string') patch.name = body.name
  if (typeof body.avatar === 'string' || body.avatar === null) patch.avatar = body.avatar
  if (typeof body.active === 'boolean') patch.active = body.active
  if (['easy','medium','hard','unbeatable'].includes(body.difficulty)) patch.difficulty = body.difficulty
  if (['always_waiting','only_when_assigned'].includes(body.waiting_mode)) patch.waiting_mode = body.waiting_mode
  if (typeof body.win_probability === 'number') patch.win_probability = Math.max(0, Math.min(1, body.win_probability))
  if (body.behavior_profile) patch.behavior_profile = body.behavior_profile

  const { data, error } = await supabaseAdmin.from('bots').update(patch).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bot: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const { error } = await supabaseAdmin.from('bots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
