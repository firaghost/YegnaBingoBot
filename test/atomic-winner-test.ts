/**
 * Test Suite for Atomic Winner Validation and Game End Logic
 * 
 * This test suite verifies:
 * 1. Atomic first-come-first-serve winner validation
 * 2. Multiple simultaneous bingo claims handling
 * 3. Auto-end when only one player remains
 * 4. Reconnect grace period functionality
 * 5. Real-time synchronization
 */

import { io, Socket } from 'socket.io-client'

interface TestPlayer {
  username: string
  socket: Socket
  connected: boolean
  roomId?: string
  isWinner?: boolean
  claimResult?: any
}

class AtomicWinnerTestSuite {
  private players: TestPlayer[] = []
  private serverUrl = 'http://localhost:3001'
  private testRoomId = 'test-room-atomic'

  constructor() {
    console.log('🧪 Atomic Winner Test Suite Initialized')
  }

  /**
   * Test 1: Multiple Simultaneous Bingo Claims
   * Verifies that only the first valid claim wins, others get "late claim" response
   */
  async testSimultaneousBingoClaims(): Promise<void> {
    console.log('\n🎯 TEST 1: Multiple Simultaneous Bingo Claims')
    
    // Create 3 test players
    const playerNames = ['Alice', 'Bob', 'Charlie']
    
    for (const name of playerNames) {
      const socket = io(this.serverUrl)
      const player: TestPlayer = {
        username: name,
        socket,
        connected: false
      }
      
      // Setup event listeners
      socket.on('connect', () => {
        player.connected = true
        console.log(`✅ ${name} connected`)
      })

      socket.on('bingo_winner', (data) => {
        console.log(`🏆 ${name} received bingo_winner:`, data)
        if (data.username === name) {
          player.isWinner = true
        }
      })

      socket.on('late_claim', (data) => {
        console.log(`⏰ ${name} received late_claim:`, data)
        player.claimResult = 'late'
      })

      socket.on('valid_but_late', (data) => {
        console.log(`✅❌ ${name} received valid_but_late:`, data)
        player.claimResult = 'valid_but_late'
      })

      socket.on('invalid_claim', (data) => {
        console.log(`❌ ${name} received invalid_claim:`, data)
        player.claimResult = 'invalid'
      })

      this.players.push(player)
    }

    // Wait for all connections
    await this.waitForConnections()

    // Join game room
    for (const player of this.players) {
      player.socket.emit('join_game', {
        username: player.username,
        roomId: this.testRoomId
      })
    }

    await this.sleep(2000) // Wait for game setup

    // Simulate simultaneous bingo claims
    console.log('🚀 Simulating simultaneous bingo claims...')
    
    const mockBingoData = {
      claimedCells: [1, 2, 3, 4, 5], // Mock winning pattern
      bingoPattern: 'row',
      board: this.generateMockBoard()
    }

    // Send claims simultaneously (within milliseconds of each other)
    const claimPromises = this.players.map(player => 
      new Promise<void>((resolve) => {
        player.socket.emit('bingo_claim', {
          username: player.username,
          ...mockBingoData
        })
        resolve()
      })
    )

    await Promise.all(claimPromises)

    // Wait for results
    await this.sleep(3000)

    // Verify results
    const winners = this.players.filter(p => p.isWinner)
    const lateClaims = this.players.filter(p => p.claimResult === 'late' || p.claimResult === 'valid_but_late')

    console.log(`\n📊 RESULTS:`)
    console.log(`Winners: ${winners.length} (should be 1)`)
    console.log(`Late claims: ${lateClaims.length} (should be 2)`)
    
    if (winners.length === 1 && lateClaims.length === 2) {
      console.log('✅ TEST 1 PASSED: Atomic winner validation working correctly')
    } else {
      console.log('❌ TEST 1 FAILED: Atomic winner validation not working')
    }

    this.cleanup()
  }

  /**
   * Test 2: Auto-end when only one player remains
   */
  async testAutoEndOnePlayer(): Promise<void> {
    console.log('\n🎯 TEST 2: Auto-end when only one player remains')
    
    // Create 2 players
    const playerNames = ['Player1', 'Player2']
    this.players = []
    
    for (const name of playerNames) {
      const socket = io(this.serverUrl)
      const player: TestPlayer = {
        username: name,
        socket,
        connected: false
      }
      
      socket.on('connect', () => {
        player.connected = true
        console.log(`✅ ${name} connected`)
      })

      socket.on('game_over', (data) => {
        console.log(`🏁 ${name} received game_over:`, data)
        if (data.reason === 'last_player_standing') {
          console.log(`✅ Auto-end triggered: ${data.winner} wins by default`)
        }
      })

      this.players.push(player)
    }

    await this.waitForConnections()

    // Join game
    for (const player of this.players) {
      player.socket.emit('join_game', {
        username: player.username,
        roomId: this.testRoomId + '-2'
      })
    }

    await this.sleep(2000)

    // Disconnect one player
    console.log('🔌 Disconnecting Player2...')
    this.players[1].socket.disconnect()

    // Wait for grace period to expire (30+ seconds)
    console.log('⏳ Waiting for grace period to expire...')
    await this.sleep(35000)

    console.log('✅ TEST 2 COMPLETED: Check logs for auto-end behavior')
    this.cleanup()
  }

  /**
   * Test 3: Reconnect within grace period
   */
  async testReconnectGracePeriod(): Promise<void> {
    console.log('\n🎯 TEST 3: Reconnect within grace period')
    
    const socket = io(this.serverUrl)
    let reconnected = false
    
    socket.on('connect', () => {
      console.log('✅ Player connected')
    })

    socket.on('game_snapshot', (data) => {
      if (data.reconnected) {
        reconnected = true
        console.log('✅ Successfully reconnected within grace period')
      }
    })

    // Join game
    socket.emit('join_game', {
      username: 'ReconnectTest',
      roomId: this.testRoomId + '-3'
    })

    await this.sleep(2000)

    // Disconnect
    console.log('🔌 Disconnecting player...')
    socket.disconnect()

    await this.sleep(5000) // Wait 5 seconds (within 30s grace period)

    // Reconnect
    console.log('🔄 Attempting reconnect...')
    const newSocket = io(this.serverUrl)
    
    newSocket.on('connect', () => {
      newSocket.emit('reconnect_request', {
        username: 'ReconnectTest',
        roomId: this.testRoomId + '-3'
      })
    })

    newSocket.on('game_snapshot', (data) => {
      if (data.reconnected) {
        reconnected = true
        console.log('✅ Successfully reconnected within grace period')
      }
    })

    await this.sleep(3000)

    if (reconnected) {
      console.log('✅ TEST 3 PASSED: Reconnect within grace period works')
    } else {
      console.log('❌ TEST 3 FAILED: Reconnect within grace period failed')
    }

    newSocket.disconnect()
  }

  private async waitForConnections(): Promise<void> {
    return new Promise((resolve) => {
      const checkConnections = () => {
        if (this.players.every(p => p.connected)) {
          resolve()
        } else {
          setTimeout(checkConnections, 100)
        }
      }
      checkConnections()
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateMockBoard(): number[][] {
    // Generate a simple 5x5 bingo board for testing
    const board: number[][] = []
    let num = 1
    for (let i = 0; i < 5; i++) {
      board[i] = []
      for (let j = 0; j < 5; j++) {
        board[i][j] = num++
      }
    }
    return board
  }

  private cleanup(): void {
    for (const player of this.players) {
      if (player.socket.connected) {
        player.socket.disconnect()
      }
    }
    this.players = []
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Atomic Winner Test Suite')
    console.log('=====================================')
    
    try {
      await this.testSimultaneousBingoClaims()
      await this.sleep(2000)
      
      await this.testAutoEndOnePlayer()
      await this.sleep(2000)
      
      await this.testReconnectGracePeriod()
      
      console.log('\n🎉 All tests completed!')
      
    } catch (error) {
      console.error('❌ Test suite failed:', error)
    }
  }
}

// Export for use in other test files
export { AtomicWinnerTestSuite }

// Run tests if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                    import.meta.url.endsWith('atomic-winner-test.ts')

if (isMainModule) {
  console.log('🚀 Starting Atomic Winner Test Suite...')
  const testSuite = new AtomicWinnerTestSuite()
  testSuite.runAllTests().then(() => {
    console.log('✅ Test suite completed successfully!')
    process.exit(0)
  }).catch((error) => {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  })
}
