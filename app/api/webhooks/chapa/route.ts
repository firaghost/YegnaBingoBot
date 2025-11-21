import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { applyFirstDepositUnlock } from '@/lib/server/wallet-service'

const supabase = supabaseAdmin
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || process.env.NEXT_PUBLIC_CHAPA_SECRET_KEY || ''
const CHAPA_PUBLIC_KEY = process.env.CHAPA_PUBLIC_KEY || process.env.NEXT_PUBLIC_CHAPA_PUBLIC_KEY || ''
const IS_CHAPA_TEST = /^CHASECK_TEST-/.test(CHAPA_SECRET_KEY) || /^CHAPUBK_TEST-/.test(CHAPA_PUBLIC_KEY)

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

  // TEST MODE: do not credit wallet; mark completed_test
  if (IS_CHAPA_TEST) {
    const { error: updErr } = await supabase.from('transactions').update({
      status: 'completed_test',
      metadata: {
        ...(tx.metadata || {}),
        chapa_verification: verifyJson,
        webhook_verified_at: new Date().toISOString(),
        test_mode: true,
      }
    } as any).eq('id', tx.id)
    if (updErr) throw updErr

    await supabase.from('audit_logs').insert({
      action: 'deposit_test_webhook_verified',
      user_id: tx.user_id,
      details: { tx_ref: txRef, transaction_id: tx.id, amount: expected, method: 'Chapa', test_mode: true }
    })

    return { alreadyCompleted: false, txId: tx.id, amount: expected, test: true }
  }

  // LIVE MODE: mark completed and credit wallet (no bonus here to avoid double)
  const totalCredit = expected

  // Capture user's balance before credit
  const { data: userBefore } = await supabase
    .from('users')
    .select('balance')
    .eq('id', tx.user_id)
    .single()

  // Apply deposit with first-deposit unlock semantics
  await applyFirstDepositUnlock(tx.user_id, totalCredit, {
    ...(tx.metadata || {}),
    tx_ref: txRef,
    method: 'Chapa',
    via: 'webhook',
  })

  // Capture user's balance after credit
  const { data: userAfter } = await supabase
    .from('users')
    .select('balance')
    .eq('id', tx.user_id)
    .single()

  const updates = {
    status: 'completed',
    metadata: {
      ...(tx.metadata || {}),
      chapa_verification: verifyJson,
      webhook_verified_at: new Date().toISOString(),
      real_balance_before: Number(userBefore?.balance ?? 0),
      real_balance_after: Number(userAfter?.balance ?? 0)
    }
  }
  const { error: updErr2 } = await supabase.from('transactions').update(updates as any).eq('id', tx.id)
  if (updErr2) throw updErr2

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
