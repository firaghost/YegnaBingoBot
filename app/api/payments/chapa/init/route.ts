import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getConfig } from '@/lib/admin-config'

const supabase = supabaseAdmin

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.MINI_APP_URL || process.env.APP_URL || ''
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || process.env.NEXT_PUBLIC_CHAPA_SECRET_KEY || ''

export async function POST(req: NextRequest) {
  try {
    if (!CHAPA_SECRET_KEY) {
      return NextResponse.json({ error: 'Chapa is not configured' }, { status: 500 })
    }

    const body = await req.json()
    const userId: string | undefined = body?.userId
    const rawAmount: number | string | undefined = body?.amount

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const amount = Number(rawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Ensure user exists
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, username, telegram_id')
      .eq('id', userId)
      .single()
    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check payment method enabled
    const { data: pmRow } = await supabase
      .from('payment_methods')
      .select('enabled, min_amount, max_amount')
      .eq('name', 'Chapa')
      .single()

    if (!pmRow || !pmRow.enabled) {
      return NextResponse.json({ error: 'Chapa payment is currently disabled' }, { status: 403 })
    }

    // Limits from admin_config and payment_methods
    const minRequired = Number(await getConfig('min_required_deposit')) || Number(pmRow.min_amount) || 10
    const maxAllowed = Number((await getConfig('deposit_max')) || pmRow.max_amount || 100000)

    if (amount < minRequired) {
      return NextResponse.json({ error: `Minimum deposit is ${minRequired} ETB` }, { status: 400 })
    }
    if (amount > maxAllowed) {
      return NextResponse.json({ error: `Maximum deposit is ${maxAllowed} ETB` }, { status: 400 })
    }

    // Create pending transaction first to lock tx_ref and amount
    const txRef = `CHP-${String(userId).slice(0, 8)}-${Date.now()}`

    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        status: 'pending',
        metadata: {
          payment_method: 'Chapa',
          tx_ref: txRef,
          initiated_amount: amount,
          created_via: 'inline',
        }
      })
      .select()
      .single()

    if (txErr) {
      console.error('Failed to create pending transaction:', txErr)
      return NextResponse.json({ error: 'Could not create transaction' }, { status: 500 })
    }

    // Initialize Chapa transaction
    const tgDigits = String(user.telegram_id || '').replace(/[^0-9]/g, '')
    const uidAlnum = String(user.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
    const safeLocal = tgDigits ? `tg${tgDigits}` : (uidAlnum ? `u${uidAlnum}` : 'user')
    const email = `${safeLocal}@gmail.com`
    const first_name = (user.username || 'Bingo').slice(0, 30)
    const last_name = 'User'

    // Build base URL from env or request host
    const computedBase = (APP_URL && APP_URL.replace(/\/$/, '')) || `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const callback_url = `${computedBase}/api/webhooks/chapa`
    const return_url = `${computedBase}/api/payments/chapa/verify?tx_ref=${encodeURIComponent(txRef)}`

    const initRes = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        currency: 'ETB',
        email,
        first_name,
        last_name,
        tx_ref: txRef,
        callback_url,
        return_url,
        // Some integrations accept customization object; safe to include
        customization: {
          title: 'BingoX Deposit',
          description: `Deposit for ${first_name}`
        }
      })
    })

    const initJson = await initRes.json().catch(() => ({}))

    if (!initRes.ok || !(initJson?.data?.checkout_url || initJson?.checkout_url)) {
      // Clean up pending if gateway init failed
      await supabase.from('transactions').update({ status: 'failed', metadata: { ...(tx?.metadata || {}), init_error: initJson } }).eq('id', tx.id)
      const gatewayMsg = initJson?.message || initJson?.error || initJson?.errors || initJson
      return NextResponse.json({ error: 'Failed to initialize payment', details: gatewayMsg }, { status: 400 })
    }

    const checkout_url: string = initJson?.data?.checkout_url || initJson?.checkout_url

    // Save checkout_url for reference
    await supabase
      .from('transactions')
      .update({ metadata: { ...(tx?.metadata || {}), checkout_url } })
      .eq('id', tx.id)

    return NextResponse.json({
      success: true,
      checkout_url,
      tx_ref: txRef,
      transaction_id: tx.id
    })
  } catch (e) {
    console.error('Chapa init error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
