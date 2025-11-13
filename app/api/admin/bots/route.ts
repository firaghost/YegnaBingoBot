import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { botManager } from '@/lib/bot-manager'

const supabase = supabaseAdmin

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      // Get bot statistics
      const { data: bots, error: botsError } = await supabase
        .from('bot_players')
        .select(`
          *,
          bot_game_sessions!inner(
            id,
            status,
            won,
            winnings,
            joined_at
          )
        `)

      if (botsError) throw botsError

      // Get active sessions count
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('bot_game_sessions')
        .select('bot_id')
        .eq('status', 'active')

      if (sessionsError) throw sessionsError

      const stats = {
        totalBots: bots?.length || 0,
        activeBots: bots?.filter(b => b.is_enabled).length || 0,
        autoJoinBots: bots?.filter(b => b.auto_join_enabled).length || 0,
        activeSessions: activeSessions?.length || 0,
        totalGamesPlayed: bots?.reduce((sum, bot) => sum + bot.games_played, 0) || 0,
        totalWinnings: bots?.reduce((sum, bot) => sum + parseFloat(bot.total_winnings || 0), 0) || 0
      }

      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    // Default: return all bots
    const { data: bots, error } = await supabase
      .from('bot_players')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: bots
    })
  } catch (error: any) {
    console.error('Error in bots API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bots' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, botId, roomId, botData } = await request.json()

    switch (action) {
      case 'create':
        if (!botData) {
          return NextResponse.json(
            { error: 'Bot data is required' },
            { status: 400 }
          )
        }

        const { data: newBot, error: createError } = await supabase
          .from('bot_players')
          .insert(botData)
          .select()
          .single()

        if (createError) throw createError

        return NextResponse.json({
          success: true,
          message: 'Bot created successfully',
          data: newBot
        })

      case 'update':
        if (!botId || !botData) {
          return NextResponse.json(
            { error: 'Bot ID and data are required' },
            { status: 400 }
          )
        }

        const { data: updatedBot, error: updateError } = await supabase
          .from('bot_players')
          .update(botData)
          .eq('id', botId)
          .select()
          .single()

        if (updateError) throw updateError

        return NextResponse.json({
          success: true,
          message: 'Bot updated successfully',
          data: updatedBot
        })

      case 'delete':
        if (!botId) {
          return NextResponse.json(
            { error: 'Bot ID is required' },
            { status: 400 }
          )
        }

        // First delete all bot sessions
        await supabase
          .from('bot_game_sessions')
          .delete()
          .eq('bot_id', botId)

        // Then delete the bot
        const { error: deleteError } = await supabase
          .from('bot_players')
          .delete()
          .eq('id', botId)

        if (deleteError) throw deleteError

        return NextResponse.json({
          success: true,
          message: 'Bot deleted successfully'
        })

      case 'toggle_status':
        if (!botId) {
          return NextResponse.json(
            { error: 'Bot ID is required' },
            { status: 400 }
          )
        }

        // Get current status
        const { data: currentBot, error: fetchError } = await supabase
          .from('bot_players')
          .select('is_enabled')
          .eq('id', botId)
          .single()

        if (fetchError) throw fetchError

        // Toggle status
        const { data: toggledBot, error: toggleError } = await supabase
          .from('bot_players')
          .update({ is_enabled: !currentBot.is_enabled })
          .eq('id', botId)
          .select()
          .single()

        if (toggleError) throw toggleError

        return NextResponse.json({
          success: true,
          message: `Bot ${toggledBot.is_enabled ? 'enabled' : 'disabled'} successfully`,
          data: toggledBot
        })

      case 'add_to_room':
        if (!roomId) {
          return NextResponse.json(
            { error: 'Room ID is required' },
            { status: 400 }
          )
        }

        try {
          await botManager.addBotToSpecificRoom(roomId, botId)
          return NextResponse.json({
            success: true,
            message: 'Bot added to room successfully'
          })
        } catch (error: any) {
          return NextResponse.json(
            { error: error.message || 'Failed to add bot to room' },
            { status: 500 }
          )
        }

      case 'start_monitoring':
        botManager.startMonitoring()
        return NextResponse.json({
          success: true,
          message: 'Bot monitoring started'
        })

      case 'stop_monitoring':
        botManager.stopMonitoring()
        return NextResponse.json({
          success: true,
          message: 'Bot monitoring stopped'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Error in bots POST API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process bot action' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { botId, ...updateData } = await request.json()

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      )
    }

    const { data: updatedBot, error } = await supabase
      .from('bot_players')
      .update(updateData)
      .eq('id', botId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Bot updated successfully',
      data: updatedBot
    })
  } catch (error: any) {
    console.error('Error updating bot:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update bot' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const botId = searchParams.get('botId')

    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      )
    }

    // First delete all bot sessions
    await supabase
      .from('bot_game_sessions')
      .delete()
      .eq('bot_id', botId)

    // Delete associated user account
    await supabase
      .from('users')
      .delete()
      .eq('bot_id', botId)

    // Then delete the bot
    const { error } = await supabase
      .from('bot_players')
      .delete()
      .eq('id', botId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Bot deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting bot:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete bot' },
      { status: 500 }
    )
  }
}
