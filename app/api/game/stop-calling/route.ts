import { NextRequest, NextResponse } from 'next/server'

// This endpoint communicates with the socket server to stop number calling
// The socket server is running on a different port and has the gameIntervals map

export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json()

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID required' },
        { status: 400 }
      )
    }

    // Get the socket server URL
    const socketServerUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001'

    // Call the socket server's internal stop endpoint
    try {
      const response = await fetch(`${socketServerUrl}/api/game/stop-calling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      })

      if (!response.ok) {
        console.warn(`Socket server returned ${response.status} for stop-calling`)
      }
    } catch (socketError) {
      console.warn('Failed to reach socket server for stop-calling:', socketError)
      // Don't fail the request if socket server is unreachable
    }

    return NextResponse.json({ 
      success: true,
      message: `Requested number calling stop for game ${gameId}`
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
