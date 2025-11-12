import { io as Client, Socket } from 'socket.io-client'

// Simple test to check if waiting room server is accessible
class SimpleWaitingRoomTest {
  private socket: Socket
  private connected: boolean = false

  constructor(serverUrl: string = 'http://localhost:3001') {
    console.log(`🔌 Attempting to connect to ${serverUrl}...`)
    
    this.socket = Client(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    })

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Connected successfully!')
      console.log(`   Socket ID: ${this.socket.id}`)
      this.connected = true
      this.testBasicFunctionality()
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection failed:', error.message)
      console.log('\n💡 Make sure the waiting room server is running:')
      console.log('   npm run dev:waiting-room')
      process.exit(1)
    })

    this.socket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected: ${reason}`)
      this.connected = false
    })

    this.socket.on('room_assigned', (data) => {
      console.log(`🏠 Room assigned: ${data.roomId} (${data.gameLevel})`)
    })

    this.socket.on('room_update', (data) => {
      console.log(`📊 Room update:`, {
        roomId: data.roomId,
        players: data.currentPlayers,
        maxPlayers: data.maxPlayers,
        status: data.status
      })
    })

    this.socket.on('error', (data) => {
      console.error(`❌ Server error: ${data.message}`)
    })
  }

  private async testBasicFunctionality(): Promise<void> {
    console.log('\n🧪 Testing basic waiting room functionality...')
    
    // Test joining a waiting room
    console.log('📤 Joining waiting room...')
    this.socket.emit('join_waiting_room', {
      username: 'TestPlayer',
      level: 'medium',
      telegram_id: 'test_123'
    })

    // Wait a bit for responses
    await this.delay(2000)

    // Test leaving the room
    console.log('📤 Leaving waiting room...')
    this.socket.emit('leave_waiting_room', {})

    await this.delay(1000)

    console.log('\n✅ Basic test completed successfully!')
    this.disconnect()
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private disconnect(): void {
    this.socket.disconnect()
    console.log('🔌 Test completed, disconnecting...')
    setTimeout(() => process.exit(0), 500)
  }
}

// Run the test
console.log('🎮 BingoX Waiting Room - Simple Connection Test')
console.log('===============================================')

const test = new SimpleWaitingRoomTest()

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted')
  process.exit(0)
})
