import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const supabase = supabaseAdmin

export const dynamic = 'force-dynamic'

/**
 * API to transition game status - called by client when timer ends
 * This replaces the broken setTimeout-based approach
 */
export async function POST(request: NextRequest) {
    try {
        const { gameId, action } = await request.json()

        if (!gameId || !action) {
            return NextResponse.json(
                { error: 'Missing gameId or action' },
                { status: 400 }
            )
        }

        console.log(`🎮 Game transition: ${gameId} -> ${action}`)

        // Get current game state
        const { data: game, error: fetchError } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single()

        if (fetchError || !game) {
            return NextResponse.json(
                { error: 'Game not found' },
                { status: 404 }
            )
        }

        // Handle different transition actions
        if (action === 'start_countdown') {
            // Transition from waiting_for_players to countdown
            if (game.status !== 'waiting_for_players' && game.status !== 'waiting') {
                return NextResponse.json({
                    success: false,
                    message: `Cannot start countdown from status: ${game.status}`,
                    currentStatus: game.status
                })
            }

            const { error: updateError } = await supabase
                .from('games')
                .update({
                    status: 'countdown',
                    countdown_time: 10,
                    countdown_started_at: new Date().toISOString()
                })
                .eq('id', gameId)

            if (updateError) {
                console.error('Error starting countdown:', updateError)
                return NextResponse.json(
                    { error: 'Failed to start countdown' },
                    { status: 500 }
                )
            }

            console.log(`✅ Game ${gameId} transitioned to countdown`)
            return NextResponse.json({ success: true, newStatus: 'countdown' })
        }

        if (action === 'start_game') {
            // Transition from countdown to active
            if (game.status !== 'countdown') {
                return NextResponse.json({
                    success: false,
                    message: `Cannot start game from status: ${game.status}`,
                    currentStatus: game.status
                })
            }

            const { error: updateError } = await supabase
                .from('games')
                .update({
                    status: 'active',
                    countdown_time: 0,
                    started_at: new Date().toISOString()
                })
                .eq('id', gameId)

            if (updateError) {
                console.error('Error starting game:', updateError)
                return NextResponse.json(
                    { error: 'Failed to start game' },
                    { status: 500 }
                )
            }

            console.log(`🎮 Game ${gameId} is now ACTIVE`)
            return NextResponse.json({ success: true, newStatus: 'active' })
        }

        if (action === 'update_countdown') {
            // Update countdown time (called every second by clients)
            const newTime = Math.max(0, (game.countdown_time || 0) - 1)

            await supabase
                .from('games')
                .update({ countdown_time: newTime })
                .eq('id', gameId)

            return NextResponse.json({ success: true, countdown_time: newTime })
        }

        return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
        )

    } catch (error: any) {
        console.error('Error in game transition:', error)
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        )
    }
}
