import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    // Fetch deposits (transactions with type='deposit')
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('type', 'deposit')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: deposits, error: depositsError } = await query

    if (depositsError) {
      console.error('Error fetching deposits:', depositsError)
      throw depositsError
    }

    // Manually fetch user data for each deposit
    const depositsWithUsers = await Promise.all(
      (deposits || []).map(async (deposit) => {
        const { data: user } = await supabase
          .from('users')
          .select('username, telegram_id')
          .eq('id', deposit.user_id)
          .single()

        return {
          ...deposit,
          users: user || { username: 'Unknown', telegram_id: null }
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: depositsWithUsers
    })
  } catch (error: any) {
    console.error('Error in deposits API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deposits' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, transactionId } = await request.json()

    if (!action || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get transaction details
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (txError || !transaction) {
      throw new Error('Transaction not found')
    }

    if (action === 'approve') {
      // Update transaction status to completed
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', transactionId)

      if (updateError) throw updateError

      // Add balance to user
      const { error: balanceError } = await supabase.rpc('add_balance', {
        user_id: transaction.user_id,
        amount: transaction.amount
      })

      if (balanceError) throw balanceError

      return NextResponse.json({
        success: true,
        message: 'Deposit approved and balance added'
      })
    } else if (action === 'reject') {
      // Update transaction status to rejected
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'rejected' })
        .eq('id', transactionId)

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        message: 'Deposit rejected'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error processing deposit:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process deposit' },
      { status: 500 }
    )
  }
}
