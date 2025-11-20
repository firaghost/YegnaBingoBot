import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

const supabase = supabaseAdmin
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || process.env.NEXT_PUBLIC_CHAPA_SECRET_KEY || ''

async function finalizeDepositByTxRef(txRef: string) {
  if (!txRef) throw new Error('Missing tx_ref')

  // Find transaction
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'deposit')
    .eq('metadata->>tx_ref', txRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (txErr || !tx) throw new Error('Transaction not found')

  // If already completed, no-op
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

  // Server-side amount verification: honor our stored amount, not client/gateway-provided
  const expected = Number(tx.amount)
  if (!Number.isFinite(expected) || expected <= 0) throw new Error('Invalid expected amount')
  if (paidAmount < expected) throw new Error('Paid amount less than expected')

  // Mark transaction completed and credit wallet atomically
  const depositBonusPercentRaw = await getConfig('deposit_bonus')
  const depositBonusPercent = Number(depositBonusPercentRaw) || 0
  const bonusAmount = (expected * depositBonusPercent) / 100
  const totalCredit = expected + bonusAmount

  const updates = {
    status: 'completed',
    metadata: {
      ...(tx.metadata || {}),
      chapa_verification: verifyJson,
      verified_at: new Date().toISOString(),
    }
  }
  const { error: updErr } = await supabase.from('transactions').update(updates as any).eq('id', tx.id)
  if (updErr) throw updErr

  const { error: applyErr } = await supabase.rpc('apply_deposit', {
    p_user_id: tx.user_id,
    p_amount: totalCredit,
    p_bonus: 0
  })
  if (applyErr) throw applyErr

  if (bonusAmount > 0) {
    await supabase.from('transactions').insert({
      user_id: tx.user_id,
      type: 'bonus',
      amount: bonusAmount,
      status: 'completed',
      description: `Deposit bonus (${depositBonusPercent}% of ${expected} ETB) credited to real balance`
    })
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    action: 'deposit_verified',
    user_id: tx.user_id,
    details: { tx_ref: txRef, transaction_id: tx.id, amount: expected, bonus: bonusAmount, method: 'Chapa' }
  })

  return { alreadyCompleted: false, txId: tx.id, amount: expected, bonusAmount }
}

export async function GET(req: NextRequest) {
  try {
    if (!CHAPA_SECRET_KEY) return NextResponse.json({ error: 'Chapa not configured' }, { status: 500 })
    const { searchParams } = new URL(req.url)
    const tx_ref = searchParams.get('tx_ref') || searchParams.get('txRef')
    if (!tx_ref) return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })

    const result = await finalizeDepositByTxRef(tx_ref)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!CHAPA_SECRET_KEY) return NextResponse.json({ error: 'Chapa not configured' }, { status: 500 })
    const body = await req.json().catch(() => ({}))
    const tx_ref = body?.tx_ref || body?.txRef
    if (!tx_ref) return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 })
    const result = await finalizeDepositByTxRef(tx_ref)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Verification failed' }, { status: 400 })
  }
}
