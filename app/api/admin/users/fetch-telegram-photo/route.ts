import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auditLog, requireAnyPermission } from '@/lib/server/admin-permissions'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : ''

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAnyPermission(req, ['users_manage', 'broadcast_manage'])

    if (!BOT_TOKEN) {
      return NextResponse.json({ error: 'BOT_TOKEN is not configured' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, telegram_id, photo_url')
      .eq('id', userId)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const telegramId = user.telegram_id ? String(user.telegram_id) : ''
    if (!telegramId) {
      return NextResponse.json({ error: 'User has no telegram_id' }, { status: 400 })
    }

    const photosRes = await fetch(`${TELEGRAM_API}/getUserProfilePhotos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: telegramId, limit: 1 }),
    })

    const photosJson: any = await photosRes.json().catch(() => null)
    if (!photosRes.ok) {
      return NextResponse.json(
        { error: photosJson?.description || 'Failed to fetch Telegram profile photos' },
        { status: 400 }
      )
    }

    const fileId = photosJson?.result?.photos?.[0]?.[0]?.file_id
    if (!fileId) {
      return NextResponse.json({ error: 'No Telegram profile photo found' }, { status: 404 })
    }

    const fileRes = await fetch(`${TELEGRAM_API}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    })

    const fileJson: any = await fileRes.json().catch(() => null)
    if (!fileRes.ok) {
      return NextResponse.json(
        { error: fileJson?.description || 'Failed to fetch Telegram file info' },
        { status: 400 }
      )
    }

    const filePath = fileJson?.result?.file_path
    if (!filePath) {
      return NextResponse.json({ error: 'Telegram file_path missing' }, { status: 500 })
    }

    const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`

    const { error: updErr } = await supabaseAdmin
      .from('users')
      .update({ photo_url: photoUrl })
      .eq('id', userId)

    if (updErr) {
      return NextResponse.json({ error: 'Failed to store photo_url' }, { status: 500 })
    }

    await auditLog(req, admin.id, 'user_fetch_telegram_photo', {
      target_user_id: userId,
      telegram_id: telegramId,
    })

    return NextResponse.json({ success: true, photo_url: photoUrl })
  } catch (e: any) {
    const msg = e?.message || 'Internal server error'
    const status = msg.toLowerCase().includes('forbidden') ? 403 : msg.toLowerCase().includes('unauthorized') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
