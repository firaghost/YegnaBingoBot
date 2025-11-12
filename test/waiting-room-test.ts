import { io as Client, Socket } from 'socket.io-client'

// Test client for simulating multiple players
class WaitingRoomTestClient {
  private socket: Socket
  private username: string
  private connected: boolean = false

  constructor(username: string, serverUrl: string = 'http://localhost:3001') {
    this.username = username
    this.socket = Client(serverUrl, {
      transports: ['websocket']
    })

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log(`✅ ${this.username} connected with socket ID: ${this.socket.id}`)
      this.connected = true
    })

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ ${this.username} disconnected: ${reason}`)
      this.connected = false
    })

    this.socket.on('room_assigned', (data) => {
      console.log(`🏠 ${this.username} assigned to room: ${data.roomId} (${data.gameLevel})`)
    })

    this.socket.on('room_update', (data) => {
      console.log(`📊 ${this.username} room update:`, {
        roomId: data.roomId,
        players: data.currentPlayers,
        maxPlayers: data.maxPlayers,
        status: data.status,
        playerNames: data.players.map((p: any) => p.username)
      })
    })

    this.socket.on('player_joined', (data) => {
      console.log(`👋 ${this.username} sees player joined: ${data.username} (${data.playerCount} total)`)
    })

    this.socket.on('player_left', (data) => {
      console.log(`👋 ${this.username} sees player left: ${data.username} (${data.playerCount} total)`)
    })

    this.socket.on('waiting_for_more_players', (data) => {
      console.log(`⏳ ${this.username} waiting for more players: ${data.currentPlayers}/${data.minPlayers}`)
    })

    this.socket.on('game_starting_in', (data) => {
      console.log(`⏰ ${this.username} game starting in: ${data.seconds} seconds`)
    })

    this.socket.on('start_game', (data) => {
      console.log(`🎮 ${this.username} GAME STARTED! Room: ${data.roomId}, Level: ${data.gameLevel}`)
      console.log(`   Players: ${data.players.map((p: any) => p.username).join(', ')}`)
    })

    this.socket.on('countdown_cancelled', (data) => {
      console.log(`🚫 ${this.username} countdown cancelled: ${data.reason}`)
    })

    this.socket.on('error', (data) => {
      console.error(`❌ ${this.username} error: ${data.message}`)
    })
  }

  async joinWaitingRoom(level: 'easy' | 'medium' | 'hard' = 'medium'): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connected) {
        this.socket.once('connect', () => {
          this.socket.emit('join_waiting_room', {
            username: this.username,
            level,
            telegram_id: `test_${this.username}`
          })
          resolve()
        })
      } else {
        this.socket.emit('join_waiting_room', {
          username: this.username,
          level,
          telegram_id: `test_${this.username}`
        })
        resolve()
      }
    })
  }

  leaveWaitingRoom(): void {
    this.socket.emit('leave_waiting_room', {})
  }

  disconnect(): void {
    this.socket.disconnect()
  }

  isConnected(): boolean {
    return this.connected
  }
}

// Test scenarios
export class WaitingRoomTestSuite {
  private clients: WaitingRoomTestClient[] = []
  private serverUrl: string

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl
  }

  /**
   * Test basic room joining
   */
  async testBasicRoomJoining(): Promise<void> {
    console.log('\n🧪 Testing basic room joining...')
    
    const client1 = new WaitingRoomTestClient('Player1', this.serverUrl)
    const client2 = new WaitingRoomTestClient('Player2', this.serverUrl)
    
    this.clients.push(client1, client2)

    // Wait a bit for connections
    await this.delay(1000)

    await client1.joinWaitingRoom('medium')
    await this.delay(500)
    await client2.joinWaitingRoom('medium')

    // Wait to see room updates
    await this.delay(2000)
  }

  /**
   * Test countdown scenario
   */
  async testCountdownScenario(): Promise<void> {
    console.log('\n🧪 Testing countdown scenario...')
    
    const players = ['Alice', 'Bob']
    const clients = players.map(name => new WaitingRoomTestClient(name, this.serverUrl))
    this.clients.push(...clients)

    // Wait for connections
    await this.delay(1000)

    // Join players to trigger countdown
    for (const client of clients) {
      await client.joinWaitingRoom('easy')
      await this.delay(500)
    }

    // Wait for countdown to complete
    await this.delay(12000)
  }

  /**
   * Test player disconnect during countdown
   */
  async testDisconnectDuringCountdown(): Promise<void> {
    console.log('\n🧪 Testing disconnect during countdown...')
    
    const client1 = new WaitingRoomTestClient('Charlie', this.serverUrl)
    const client2 = new WaitingRoomTestClient('David', this.serverUrl)
    
    this.clients.push(client1, client2)

    await this.delay(1000)

    // Join to start countdown
    await client1.joinWaitingRoom('hard')
    await client2.joinWaitingRoom('hard')

    // Wait for countdown to start
    await this.delay(3000)

    // Disconnect one player
    console.log('🔌 Disconnecting David...')
    client2.disconnect()

    // Wait to see countdown cancellation
    await this.delay(5000)
  }

  /**
   * Test room full scenario
   */
  async testRoomFullScenario(): Promise<void> {
    console.log('\n🧪 Testing room full scenario...')
    
    // Create max players for easy room (10 players)
    const playerNames = Array.from({ length: 10 }, (_, i) => `Player${i + 1}`)
    const clients = playerNames.map(name => new WaitingRoomTestClient(name, this.serverUrl))
    this.clients.push(...clients)

    await this.delay(1000)

    // Join all players quickly
    for (let i = 0; i < clients.length; i++) {
      await clients[i].joinWaitingRoom('easy')
      await this.delay(200) // Small delay between joins
    }

    // Wait to see immediate game start
    await this.delay(3000)
  }

  /**
   * Test multiple rooms with different levels
   */
  async testMultipleRooms(): Promise<void> {
    console.log('\n🧪 Testing multiple rooms with different levels...')
    
    const easyPlayers = ['Easy1', 'Easy2'].map(name => new WaitingRoomTestClient(name, this.serverUrl))
    const mediumPlayers = ['Medium1', 'Medium2'].map(name => new WaitingRoomTestClient(name, this.serverUrl))
    const hardPlayers = ['Hard1', 'Hard2'].map(name => new WaitingRoomTestClient(name, this.serverUrl))
    
    this.clients.push(...easyPlayers, ...mediumPlayers, ...hardPlayers)

    await this.delay(1000)

    // Join different levels simultaneously
    await Promise.all([
      ...easyPlayers.map(client => client.joinWaitingRoom('easy')),
      ...mediumPlayers.map(client => client.joinWaitingRoom('medium')),
      ...hardPlayers.map(client => client.joinWaitingRoom('hard'))
    ])

    // Wait to see multiple countdowns
    await this.delay(15000)
  }

  /**
   * Cleanup all test clients
   */
  cleanup(): void {
    console.log('\n🧹 Cleaning up test clients...')
    this.clients.forEach(client => {
      if (client.isConnected()) {
        client.disconnect()
      }
    })
    this.clients = []
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// CLI test runner - Always run when this file is executed directly
const runAsMain = true

if (runAsMain) {
  const testSuite = new WaitingRoomTestSuite()

  const runTests = async () => {
    console.log('🎮 Starting BingoX Waiting Room Tests')
    console.log('=====================================')

    try {
      // Run individual tests
      await testSuite.testBasicRoomJoining()
      await testSuite.delay(2000)
      testSuite.cleanup()

      await testSuite.testCountdownScenario()
      await testSuite.delay(2000)
      testSuite.cleanup()

      await testSuite.testDisconnectDuringCountdown()
      await testSuite.delay(2000)
      testSuite.cleanup()

      await testSuite.testRoomFullScenario()
      await testSuite.delay(2000)
      testSuite.cleanup()

      await testSuite.testMultipleRooms()
      await testSuite.delay(2000)
      testSuite.cleanup()

      console.log('\n✅ All tests completed!')

    } catch (error) {
      console.error('❌ Test error:', error)
    } finally {
      testSuite.cleanup()
      process.exit(0)
    }
  }

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Tests interrupted')
    testSuite.cleanup()
    process.exit(0)
  })

  runTests()
}

export { WaitingRoomTestClient }
