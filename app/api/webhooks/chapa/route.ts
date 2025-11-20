import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || process.env.NEXT_PUBLIC_CHAPA_SECRET_KEY || ''

async function finalizeDepositByTxRef(txRef: string) {
  if (!txRef) throw new Error('Missing tx_ref')

  // Find transaction by metadata->>tx_ref
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'deposit')
    .eq('metadata->>tx_ref', txRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (txErr || !tx) throw new Error('Transaction not found')

  if ((tx.status || '').toLowerCase() === 'completed') {
    return { alreadyCompleted: true, tx }
  }

  // Verify with Chapa
  const verifyRes = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { 'Authorization': `Bearer ${CHAPA_SECRET_KEY}` }
  })
  const verifyJson = await verifyRes.json().catch(() => ({}))
  if (!verifyRes.ok || (verifyJson?.status !== 'success' && verifyJson?.data?.status !== 'success')) {
    throw new Error('Verification failed')
  }

  const remote = verifyJson?.data || verifyJson
  const paidAmount = Number(remote?.amount || remote?.data?.amount || 0)
  const currency = (remote?.currency || 'ETB').toUpperCase()

  if (!Number.isFinite(paidAmount) || paidAmount <= 0) throw new Error('Invalid amount from gateway')
  if (currency !== 'ETB') throw new Error('Unsupported currency')

  // Server-side amount verification: honor stored amount
  const expected = Number(tx.amount)
  if (!Number.isFinite(expected) || expected <= 0) throw new Error('Invalid expected amount')
  if (paidAmount < expected) throw new Error('Paid amount less than expected')

  // Mark transaction completed
  const updates = {
    status: 'completed',
    metadata: {
      ...(tx.metadata || {}),
      chapa_verification: verifyJson,
      webhook_verified_at: new Date().toISOString(),
    }
  }
  const { error: updErr } = await supabase.from('transactions').update(updates as any).eq('id', tx.id)
  if (updErr) throw updErr

  // Credit user wallet using existing RPC
  const depositBonusPercentRaw = 0 // webhook path doesn't compute bonus; verify endpoint may handle; keep 0 to avoid double-bonus
  const totalCredit = expected

  const { error: applyErr } = await supabase.rpc('apply_deposit', {
    p_user_id: tx.user_id,
    p_amount: totalCredit,
    p_bonus: 0
  })
  if (applyErr) throw applyErr

  await supabase.from('audit_logs').insert({
    action: 'deposit_webhook_verified',
    user_id: tx.user_id,
    details: { tx_ref: txRef, transaction_id: tx.id, amount: expected, method: 'Chapa' }
  })

  return { alreadyCompleted: false, txId: tx.id, amount: expected }
}

export async function POST(req: NextRequest) {
  try {
    if (!CHAPA_SECRET_KEY) return NextResponse.json({ error: 'Chapa not configured' }, { status: 500 })

    const signature = req.headers.get('chapa-signature') || req.headers.get('x-chapa-signature') || ''
    // Chapa's webhook signature verification is not publicly documented in detail here.
    // We rely on server-side verification via tx_ref to ensure integrity.

    const payload = await req.json().catch(() => ({}))
    const event = payload?.event || payload?.type || ''
    const txRef = payload?.tx_ref || payload?.data?.tx_ref || payload?.data?.txRef || ''

    if (!txRef) return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })

    // Always cross-check with verify API regardless of signature
    const result = await finalizeDepositByTxRef(txRef)

    return NextResponse.json({ success: true, event, signature: Boolean(signature), result })
  } catch (e: any) {
    console.error('Chapa webhook error:', e)
    return NextResponse.json({ error: e?.message || 'Webhook processing failed' }, { status: 400 })
  }
}
