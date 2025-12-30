import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/server/admin-permissions'

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'broadcast_manage')

    const form = await req.formData()
    const file = form.get('file')
    const bucket = String(form.get('bucket') || 'broadcasts')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const providedName = String((file as any).name || '')
    const ext = (providedName.split('.').pop() || 'png').toLowerCase()
    const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'png'
    const filePath = `broadcast-${Date.now()}.${safeExt}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: (file as any).type || undefined })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath)
    const publicUrl = data?.publicUrl

    return NextResponse.json({ success: true, url: publicUrl, path: filePath, bucket })
  } catch (error: any) {
    console.error('Error in POST /api/admin/broadcast-upload:', error)
    return NextResponse.json({ error: error?.message || 'Upload failed' }, { status: 500 })
  }
}
