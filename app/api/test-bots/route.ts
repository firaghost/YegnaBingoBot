import { NextRequest, NextResponse } from 'next/server'
import { botManager } from '@/lib/bot-manager'

export async function POST(request: NextRequest) {
  try {
    const { action, roomId } = await request.json()

    switch (action) {
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

      case 'add_bot_to_room':
        if (!roomId) {
          return NextResponse.json(
            { error: 'Room ID is required' },
            { status: 400 }
          )
        }

        try {
          await botManager.addBotToSpecificRoom(roomId)
          return NextResponse.json({
            success: true,
            message: `Bot added to room ${roomId}`
          })
        } catch (error: any) {
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          )
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Error in test-bots API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process bot test' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Bot Test API',
    endpoints: {
      'POST /api/test-bots': {
        actions: [
          'start_monitoring',
          'stop_monitoring', 
          'add_bot_to_room (requires roomId)'
        ]
      }
    }
  })
}
