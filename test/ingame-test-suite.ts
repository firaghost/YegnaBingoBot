import { io as Client, Socket } from 'socket.io-client'

// Test client for in-game functionality
class InGameTestClient {
  private socket: Socket
  private username: string
  private roomId?: string
  private connected: boolean = false
  private isSpectator: boolean = false
  private gameBoard: number[][] = []
  private numbersCalled: number[] = []

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

    // Waiting room events
    this.socket.on('room_assigned', (data) => {
      console.log(`🏠 ${this.username} assigned to room: ${data.roomId}`)
      this.roomId = data.roomId
    })

    this.socket.on('transition_to_game', (data) => {
      console.log(`🔄 ${this.username} transitioning to game: ${data.message}`)
      // Automatically join the game
      setTimeout(() => {
        this.joinGame(data.roomId)
      }, 1000)
    })

    // In-game events
    this.socket.on('game_started', (data) => {
      console.log(`🎮 ${this.username} game started in room ${data.roomId} (${data.gameLevel})`)
      console.log(`   Call interval: ${data.callInterval}ms`)
    })

    this.socket.on('game_snapshot', (data) => {
      console.log(`📸 ${this.username} received game snapshot:`)
      console.log(`   Room: ${data.roomId}, Status: ${data.status}`)
      console.log(`   Numbers called: ${data.numbersCalled?.length || 0}`)
      console.log(`   Players: ${data.players?.length || 0}`)
      console.log(`   Spectators: ${data.spectators?.length || 0}`)
      
      if (data.playerBoard) {
        this.gameBoard = data.playerBoard
        console.log(`   Board assigned: ${this.gameBoard.length}x${this.gameBoard[0]?.length}`)
      }
      
      if (data.numbersCalled) {
        this.numbersCalled = data.numbersCalled
      }
      
      this.isSpectator = data.isSpectator || false
    })

    this.socket.on('number_called', (data) => {
      this.numbersCalled.push(data.number)
      console.log(`📢 ${this.username} heard: ${data.letter}${data.number} (${data.remaining} remaining)`)
      
      // Simulate checking board and maybe claiming bingo
      if (!this.isSpectator && this.numbersCalled.length > 10 && Math.random() < 0.05) {
        this.simulateBingoClaim()
      }
    })

    this.socket.on('bingo_claimed', (data) => {
      console.log(`🎯 ${this.username} sees bingo claimed by ${data.username} (${data.pattern})`)
    })

    this.socket.on('bingo_winner', (data) => {
      console.log(`🏆 ${this.username} sees BINGO WINNER: ${data.username} with ${data.pattern}!`)
    })

    this.socket.on('invalid_claim', (data) => {
      console.log(`❌ ${this.username} invalid bingo claim: ${data.reason}`)
    })

    this.socket.on('game_over', (data) => {
      console.log(`🏁 ${this.username} game over!`)
      console.log(`   Winner: ${data.winner || 'None'}`)
      console.log(`   Reason: ${data.reason}`)
      console.log(`   Duration: ${data.duration}s`)
      console.log(`   Numbers called: ${data.finalNumbers?.length || 0}`)
    })

    this.socket.on('player_reconnected', (data) => {
      console.log(`🔄 ${this.username} sees ${data.username} reconnected`)
    })

    this.socket.on('player_left', (data) => {
      console.log(`👋 ${this.username} sees ${data.username} left (${data.reason})`)
    })

    this.socket.on('spectator_joined', (data) => {
      console.log(`👁️ ${this.username} sees spectator ${data.username} joined (${data.spectatorCount} total)`)
    })

    this.socket.on('game_error', (data) => {
      console.error(`❌ ${this.username} game error: ${data.message}`)
      if (data.canSpectate) {
        console.log(`   💡 Can join as spectator`)
      }
    })
  }

  // Join waiting room (Phase 1)
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

  // Join active game (Phase 2)
  joinGame(roomId?: string): void {
    const targetRoom = roomId || this.roomId
    if (!targetRoom) {
      console.error(`${this.username} cannot join game: no room ID`)
      return
    }

    this.socket.emit('join_game', {
      username: this.username,
      roomId: targetRoom
    })
  }

  // Join as spectator
  joinAsSpectator(roomId: string): void {
    this.socket.emit('join_spectator', {
      username: this.username,
      roomId
    })
  }

  // Request reconnect
  requestReconnect(roomId?: string): void {
    const targetRoom = roomId || this.roomId
    if (!targetRoom) {
      console.error(`${this.username} cannot reconnect: no room ID`)
      return
    }

    this.socket.emit('reconnect_request', {
      username: this.username,
      roomId: targetRoom
    })
  }

  // Simulate bingo claim
  private simulateBingoClaim(): void {
    if (this.isSpectator || !this.gameBoard.length) return

    // Generate fake claim data
    const claimedCells = Array.from({ length: 5 }, (_, i) => i)
    const patterns = ['row', 'column', 'diagonal', 'full_house']
    const pattern = patterns[Math.floor(Math.random() * patterns.length)]

    console.log(`🎯 ${this.username} claiming BINGO with ${pattern}!`)

    this.socket.emit('bingo_claim', {
      username: this.username,
      claimedCells,
      bingoPattern: pattern,
      board: this.gameBoard
    })
  }

  // Force bingo claim (for testing)
  claimBingo(pattern: string = 'row'): void {
    if (this.isSpectator) {
      console.log(`${this.username} cannot claim bingo as spectator`)
      return
    }

    const claimedCells = Array.from({ length: 5 }, (_, i) => i)
    
    console.log(`🎯 ${this.username} FORCE claiming BINGO with ${pattern}!`)

    this.socket.emit('bingo_claim', {
      username: this.username,
      claimedCells,
      bingoPattern: pattern,
      board: this.gameBoard
    })
  }

  // Get game state
  getGameState(roomId?: string): void {
    const targetRoom = roomId || this.roomId
    if (!targetRoom) return

    this.socket.emit('get_game_state', { roomId: targetRoom })
  }

  // Disconnect
  disconnect(): void {
    this.socket.disconnect()
  }

  // Check connection status
  isConnected(): boolean {
    return this.connected
  }

  // Get room ID
  getRoomId(): string | undefined {
    return this.roomId
  }
}

// Test suite for in-game functionality
export class InGameTestSuite {
  private clients: InGameTestClient[] = []
  private serverUrl: string

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.serverUrl = serverUrl
  }

  /**
   * Test complete game flow (waiting room → game → bingo)
   */
  async testCompleteGameFlow(): Promise<void> {
    console.log('\n🧪 Testing complete game flow (waiting → game → bingo)...')
    
    const players = ['Alice', 'Bob']
    const clients = players.map(name => new InGameTestClient(name, this.serverUrl))
    this.clients.push(...clients)

    // Wait for connections
    await this.delay(1000)

    // Join waiting room
    console.log('📝 Phase 1: Joining waiting room...')
    for (const client of clients) {
      await client.joinWaitingRoom('medium')
      await this.delay(500)
    }

    // Wait for game to start and transition
    console.log('⏳ Waiting for game to start...')
    await this.delay(15000) // Wait for countdown + transition

    // Wait for some numbers to be called
    console.log('📢 Waiting for numbers to be called...')
    await this.delay(10000)

    // Have Alice claim bingo
    console.log('🎯 Alice claiming bingo...')
    clients[0].claimBingo('row')

    // Wait for game to end
    await this.delay(5000)
  }

  /**
   * Test spectator mode
   */
  async testSpectatorMode(): Promise<void> {
    console.log('\n🧪 Testing spectator mode...')
    
    // Start a game with players
    const players = ['Player1', 'Player2']
    const playerClients = players.map(name => new InGameTestClient(name, this.serverUrl))
    this.clients.push(...playerClients)

    await this.delay(1000)

    // Join waiting room
    for (const client of playerClients) {
      await client.joinWaitingRoom('easy')
      await this.delay(500)
    }

    // Wait for game to start
    await this.delay(12000)

    // Add spectators
    console.log('👁️ Adding spectators...')
    const spectators = ['Spectator1', 'Spectator2']
    const spectatorClients = spectators.map(name => new InGameTestClient(name, this.serverUrl))
    this.clients.push(...spectatorClients)

    await this.delay(1000)

    // Get room ID from a player
    const roomId = playerClients[0].getRoomId()
    if (roomId) {
      for (const spectator of spectatorClients) {
        spectator.joinAsSpectator(roomId)
        await this.delay(500)
      }
    }

    // Wait and observe
    await this.delay(10000)

    // End game
    if (roomId) {
      playerClients[0].claimBingo('diagonal')
    }

    await this.delay(5000)
  }

  /**
   * Test reconnect functionality
   */
  async testReconnectFunctionality(): Promise<void> {
    console.log('\n🧪 Testing reconnect functionality...')
    
    const players = ['Charlie', 'David']
    const clients = players.map(name => new InGameTestClient(name, this.serverUrl))
    this.clients.push(...clients)

    await this.delay(1000)

    // Start game
    for (const client of clients) {
      await client.joinWaitingRoom('hard')
      await this.delay(500)
    }

    // Wait for game to start
    await this.delay(12000)

    // Disconnect Charlie
    console.log('🔌 Disconnecting Charlie...')
    clients[0].disconnect()

    // Wait a bit
    await this.delay(5000)

    // Reconnect Charlie (within grace period)
    console.log('🔄 Charlie attempting to reconnect...')
    const charlieReconnect = new InGameTestClient('Charlie', this.serverUrl)
    this.clients.push(charlieReconnect)

    await this.delay(1000)

    const roomId = clients[1].getRoomId()
    if (roomId) {
      charlieReconnect.requestReconnect(roomId)
    }

    // Wait and observe
    await this.delay(10000)

    // End game
    if (roomId) {
      clients[1].claimBingo('full_house')
    }

    await this.delay(5000)
  }

  /**
   * Test reconnect timeout
   */
  async testReconnectTimeout(): Promise<void> {
    console.log('\n🧪 Testing reconnect timeout (grace period expiry)...')
    
    const players = ['Eve', 'Frank']
    const clients = players.map(name => new InGameTestClient(name, this.serverUrl))
    this.clients.push(...clients)

    await this.delay(1000)

    // Start game
    for (const client of clients) {
      await client.joinWaitingRoom('medium')
      await this.delay(500)
    }

    // Wait for game to start
    await this.delay(12000)

    // Disconnect Eve
    console.log('🔌 Disconnecting Eve...')
    const roomId = clients[0].getRoomId()
    clients[0].disconnect()

    // Wait for grace period to expire (30+ seconds)
    console.log('⏰ Waiting for grace period to expire...')
    await this.delay(35000)

    // Try to reconnect (should fail)
    console.log('🔄 Eve attempting to reconnect after timeout...')
    const eveReconnect = new InGameTestClient('Eve', this.serverUrl)
    this.clients.push(eveReconnect)

    await this.delay(1000)

    if (roomId) {
      eveReconnect.requestReconnect(roomId)
    }

    // Wait and observe
    await this.delay(5000)

    // Try to join as spectator instead
    console.log('👁️ Eve joining as spectator...')
    if (roomId) {
      eveReconnect.joinAsSpectator(roomId)
    }

    await this.delay(5000)
  }

  /**
   * Test multiple concurrent games
   */
  async testMultipleConcurrentGames(): Promise<void> {
    console.log('\n🧪 Testing multiple concurrent games...')
    
    // Create players for 3 different games
    const easyPlayers = ['Easy1', 'Easy2'].map(name => new InGameTestClient(name, this.serverUrl))
    const mediumPlayers = ['Medium1', 'Medium2'].map(name => new InGameTestClient(name, this.serverUrl))
    const hardPlayers = ['Hard1', 'Hard2'].map(name => new InGameTestClient(name, this.serverUrl))
    
    this.clients.push(...easyPlayers, ...mediumPlayers, ...hardPlayers)

    await this.delay(1000)

    // Start all games simultaneously
    await Promise.all([
      ...easyPlayers.map(client => client.joinWaitingRoom('easy')),
      ...mediumPlayers.map(client => client.joinWaitingRoom('medium')),
      ...hardPlayers.map(client => client.joinWaitingRoom('hard'))
    ])

    // Wait for all games to start
    await this.delay(15000)

    // Wait for numbers to be called
    await this.delay(20000)

    // Have winners in each game
    console.log('🏆 Declaring winners in all games...')
    easyPlayers[0].claimBingo('row')
    await this.delay(1000)
    mediumPlayers[0].claimBingo('column')
    await this.delay(1000)
    hardPlayers[0].claimBingo('diagonal')

    // Wait for all games to end
    await this.delay(10000)
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

// CLI test runner
const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  const testSuite = new InGameTestSuite()

  const runTests = async () => {
    console.log('🎮 Starting BingoX In-Game Tests')
    console.log('=====================================')

    try {
      // Run individual tests
      await testSuite.testCompleteGameFlow()
      await testSuite.delay(3000)
      testSuite.cleanup()

      await testSuite.testSpectatorMode()
      await testSuite.delay(3000)
      testSuite.cleanup()

      await testSuite.testReconnectFunctionality()
      await testSuite.delay(3000)
      testSuite.cleanup()

      // Note: Reconnect timeout test takes 35+ seconds
      console.log('\n⚠️ Skipping reconnect timeout test (takes 35+ seconds)')
      // await testSuite.testReconnectTimeout()
      // await testSuite.delay(3000)
      // testSuite.cleanup()

      await testSuite.testMultipleConcurrentGames()
      await testSuite.delay(3000)
      testSuite.cleanup()

      console.log('\n✅ All in-game tests completed!')

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

export { InGameTestClient }
